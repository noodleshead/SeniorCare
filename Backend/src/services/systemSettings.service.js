import SystemSetting from "../models/SystemSetting.js";
import { SETTINGS_SECTIONS } from "../validators/systemSettings.validator.js";
import { ValidationError } from "../utils/errors.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import { AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";

/**
 * Simple service-level cache — no Redis or other new dependency (module
 * requirement §27: don't introduce caching infrastructure the project
 * doesn't already use). Settings are read on nearly every registration,
 * notification, and application submission, but change only when an
 * Administrator explicitly saves a section, so an in-process cache that
 * is invalidated exactly on write is both correct and sufficient — there
 * is no staleness window longer than "since the last save," and every
 * write path in this file goes through updateSettingsSection(), which
 * always invalidates it.
 */
let cachedSettings = null;

async function loadSettings() {
  let doc = await SystemSetting.findOne({ singleton: true });
  if (!doc) {
    // First run — create the one settings document with schema
    // defaults, which are chosen specifically to preserve the system's
    // existing behavior before this module existed (module requirement
    // §26): everything enabled, maintenance mode off.
    doc = await SystemSetting.create({ singleton: true });
  }
  return doc;
}

/** Full settings object for the Admin Settings page. Always ADMIN-only at the route level. */
export async function getSettings() {
  if (!cachedSettings) {
    cachedSettings = (await loadSettings()).toObject();
  }
  return cachedSettings;
}

function invalidateCache() {
  cachedSettings = null;
}

/**
 * Validates and saves one whitelisted section, then invalidates the
 * cache and records an Audit Log — reusing the existing AuditLog
 * service rather than building a second history mechanism (module
 * requirement §20).
 */
export async function updateSettingsSection(section, rawBody, requestingUser) {
  const config = SETTINGS_SECTIONS[section];
  if (!config) {
    throw new ValidationError(`Unknown settings section: "${section}".`);
  }

  const parsed = config.schema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_root"] = issue.message;
    }
    throw new ValidationError("Please correct the highlighted fields.", fieldErrors);
  }

  const doc = await loadSettings();
  const previousValue = config.field
    ? { ...(doc[config.field]?.toObject?.() ?? doc[config.field]) }
    : { maintenanceMode: doc.maintenanceMode };

  if (config.field) {
    doc[config.field] = { ...(doc[config.field]?.toObject?.() ?? doc[config.field]), ...parsed.data };
  } else {
    // "maintenance" is a top-level boolean field, not a sub-object.
    doc.maintenanceMode = parsed.data.maintenanceMode;
  }
  doc.updatedBy = requestingUser.id;
  await doc.save();
  invalidateCache();

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.SYSTEM_SETTINGS,
    entityType: "SystemSetting",
    entityId: doc._id,
    description: `${requestingUser.role} updated the "${section}" system settings.`,
    metadata: { section, previousValue, newValue: parsed.data },
  });

  return doc.toObject();
}

// ---- Hot-path getters, used by other services/middleware. Each reads
// the cached settings object rather than hitting MongoDB per call. ----

export async function isMaintenanceModeOn() {
  return (await getSettings()).maintenanceMode === true;
}

export async function areNotificationsEnabled() {
  return (await getSettings()).notifications?.enabled !== false;
}

export async function isApplicationSubmissionEnabled() {
  return (await getSettings()).applications?.enabled !== false;
}

export async function isSeniorRegistrationEnabled() {
  return (await getSettings()).registration?.seniorRegistrationEnabled !== false;
}

export async function isGuardianRegistrationEnabled() {
  return (await getSettings()).registration?.guardianRegistrationEnabled !== false;
}

/**
 * Unauthenticated-safe subset — no maintenance/notifications/applications/
 * registration toggles, just display information — for the public
 * branding endpoint (systemSettings.routes.js's `/public`), consumed by
 * the Login/Register pages and the dashboard sidebar so a renamed
 * system actually shows the new name everywhere, not just on the
 * Settings page itself.
 */
export async function getPublicSettings() {
  const settings = await getSettings();
  return {
    systemName: settings.general?.systemName || "SENIORCARE",
    systemDescription: settings.general?.systemDescription || "",
    contactEmail: settings.general?.contactEmail || "",
    contactNumber: settings.general?.contactNumber || "",
  };
}
