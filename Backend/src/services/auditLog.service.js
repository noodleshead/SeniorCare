import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

/**
 * Reusable audit-logging helper, called from existing business-logic
 * services after their own writes have committed — never from the
 * frontend (see routes/auditLog.routes.js: no create endpoint exists at
 * all). Mirrors notification.service.js#createNotification's own
 * session-safety rule: every call site here invokes this only *after*
 * any `session.withTransaction(...)` block has resolved and, where
 * relevant, after `session.endSession()` — audit records are a
 * historical side effect, not something that needs to be atomic with
 * the business write itself.
 *
 * ERROR-HANDLING STRATEGY (module requirements §18/§29 — decided by
 * inspecting the existing architecture, not assumed): createNotification
 * does NOT swallow its own errors — it rethrows anything that isn't the
 * duplicate-key race it explicitly handles, and every caller `await`s
 * it as the last step of an already-committed operation. This function
 * follows the same "do not silently hide failures" principle — it does
 * not catch/hide errors itself, so a real bug is never silently lost.
 *
 * However, every call site wraps *this* in its own try/catch and logs
 * to console.error rather than letting an audit-log failure surface as
 * a failure of the business operation. A missed notification and a
 * missed audit record are not equivalent in severity: if the audit
 * write fails on an operation that had *already succeeded* (the pension
 * claim is already CLAIMED, the Senior is already ACTIVE), surfacing a
 * 500 to the Administrator who just successfully approved a
 * registration would be actively wrong — and there is nothing to roll
 * back. Server logs (never swallowed here) are the escalation path
 * today; a dead-letter/retry queue would be the next step if audit
 * completeness ever needs a stronger guarantee than that.
 */

// Keys that must never appear in `metadata`, checked recursively and
// case-insensitively so a nested object can't smuggle a forbidden field
// in either. Matched by inclusion (e.g. "passwordHash" matches "password")
// so close variants are caught too.
const FORBIDDEN_METADATA_KEY_FRAGMENTS = [
  "password",
  "token",
  "otp",
  "secret",
  "authorization",
];

function sanitizeMetadata(value, depth = 0) {
  if (value === null || value === undefined || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeMetadata(v, depth + 1));
  if (typeof value !== "object") return value;
  if (value instanceof Date || value?._bsontype) return value; // ObjectId, Date, etc. pass through untouched

  const cleaned = {};
  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_METADATA_KEY_FRAGMENTS.some((frag) => lowerKey.includes(frag))) {
      continue; // dropped, not just masked — never persisted at all
    }
    cleaned[key] = sanitizeMetadata(val, depth + 1);
  }
  return cleaned;
}

/**
 * Creates one audit record.
 *
 * `actor` is the requesting user object every service in this project
 * already receives (`{ id, role, ... }` from `req.user`, set by
 * auth.middleware.js from the verified JWT — never client-supplied).
 * `actorEmail` is passed by the caller when cheaply available (it
 * usually already has the User doc loaded), or resolved here as a
 * fallback lookup.
 */
export async function createAuditLog({
  actor,
  actorEmail,
  action,
  module: moduleName,
  entityType = null,
  entityId = null,
  description,
  metadata = {},
  barangayId = null,
}) {
  if (!actor?.id || !actor?.role) {
    throw new Error("createAuditLog requires an authenticated actor ({ id, role }).");
  }
  if (!action || !moduleName || !description) {
    throw new Error("createAuditLog requires action, module, and description.");
  }

  let email = actorEmail;
  if (!email) {
    const user = await User.findById(actor.id).select("email");
    email = user?.email || "unknown";
  }

  return AuditLog.create({
    actorUserId: actor.id,
    actorRole: actor.role,
    actorEmail: email,
    action,
    module: moduleName,
    entityType,
    entityId,
    description,
    metadata: sanitizeMetadata(metadata),
    barangayId: barangayId || actor.assignedBarangayId || null,
  });
}

/**
 * Fire-and-forget wrapper around createAuditLog for call sites that
 * should never let an audit-logging failure fail the business
 * operation that already succeeded (see the error-handling rationale
 * above). Prefer this at almost every real call site; use
 * `createAuditLog` directly only where a call site has a specific
 * reason to observe/react to the failure itself.
 */
export async function safeCreateAuditLog(params) {
  try {
    await createAuditLog(params);
  } catch (err) {
    // Intentionally not swallowed into silence: this is the "server
    // logs are the escalation path" half of the strategy documented
    // above. A monitoring/alerting hook on this log line is the
    // natural next step if audit completeness needs a stronger SLA.
    console.error(`[audit] failed to record ${params.module}/${params.action}:`, err);
  }
}

function looksLikeObjectId(str) {
  return /^[a-f0-9]{24}$/i.test(str);
}

/**
 * Server-side paginated/filtered listing for the Admin Audit Logs page.
 * Newest first by default. Every filter is optional; `search` matches
 * against actorEmail/description/entityId — a plain regex is acceptable
 * here given the Admin-only, moderate-volume audience, matching the
 * simple search convention already used elsewhere in this project (e.g.
 * benefitApplication.service.js's applicant search).
 */
export async function listAuditLogs({
  page = 1,
  pageSize = 25,
  action,
  module: moduleName,
  actorRole,
  entityType,
  barangayId,
  from,
  to,
  search,
} = {}) {
  const match = {};
  if (action) match.action = action;
  if (moduleName) match.module = moduleName;
  if (actorRole) match.actorRole = actorRole;
  if (entityType) match.entityType = entityType;
  if (barangayId) match.barangayId = barangayId;
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      if (typeof to === "string" && to.length <= 10) toDate.setHours(23, 59, 59, 999);
      match.createdAt.$lte = toDate;
    }
  }
  if (search) {
    const term = search.trim();
    if (term) {
      match.$or = [
        { actorEmail: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
        ...(looksLikeObjectId(term) ? [{ entityId: term }] : []),
      ];
    }
  }

  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    AuditLog.find(match)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .populate("barangayId", "name")
      .lean(),
    AuditLog.countDocuments(match),
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(Math.ceil(total / safePageSize), 1),
    },
  };
}

export async function getAuditLogById(id) {
  return AuditLog.findById(id).populate("barangayId", "name").populate("actorUserId", "email role").lean();
}

/** Quick "Total / Today / This Week" counts for the page header cards. */
export async function getAuditLogSummary() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const [total, today, thisWeek] = await Promise.all([
    AuditLog.countDocuments({}),
    AuditLog.countDocuments({ createdAt: { $gte: startOfToday } }),
    AuditLog.countDocuments({ createdAt: { $gte: startOfWeek } }),
  ]);
  return { total, today, thisWeek };
}
