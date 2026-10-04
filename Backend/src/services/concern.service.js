import Concern from "../models/Concern.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import User from "../models/User.js";
import { CONCERN_STATUS, ROLES, ACCOUNT_STATUS, NOTIFICATION_TYPE } from "../utils/constants.js";
import { NotFoundError, ConflictError, AuthorizationError } from "../utils/errors.js";
import { hasBroadBarangayAccess, assertCanAccessBarangay } from "../utils/barangayScope.js";
import { createNotifications } from "./notification.service.js";

/**
 * Strictly sequential forward-only lifecycle (Part 5) — a concern can
 * never skip a stage (e.g. NEW straight to RESOLVED). RESOLVED is
 * terminal: no further transitions from it.
 */
const CONCERN_TRANSITIONS = Object.freeze({
  [CONCERN_STATUS.NEW]: [CONCERN_STATUS.UNDER_REVIEW],
  [CONCERN_STATUS.UNDER_REVIEW]: [CONCERN_STATUS.IN_PROGRESS],
  [CONCERN_STATUS.IN_PROGRESS]: [CONCERN_STATUS.RESOLVED],
  [CONCERN_STATUS.RESOLVED]: [],
});

const STATUS_LABELS = {
  [CONCERN_STATUS.UNDER_REVIEW]: "Under Review",
  [CONCERN_STATUS.IN_PROGRESS]: "In Progress",
  [CONCERN_STATUS.RESOLVED]: "Resolved",
};

function assertCanManage(concern, requestingUser) {
  if (hasBroadBarangayAccess(requestingUser.role)) return;
  if (!requestingUser.assignedBarangayId) {
    throw new AuthorizationError("You must be assigned to a Barangay to manage concerns.");
  }
  // concern.barangayId may be a raw ObjectId or (if the caller
  // populated it) a full Barangay document — normalize before
  // comparing. See activity.service.js's assertBarangayAllowed for why
  // comparing a populated document's .toString() directly is unsafe.
  const raw = concern.barangayId && concern.barangayId._id ? concern.barangayId._id : concern.barangayId;
  if (requestingUser.assignedBarangayId !== raw.toString()) {
    throw new AuthorizationError("You are not authorized to manage this concern.");
  }
}

function pushLog(concern, { type, message, actorId }) {
  concern.activityLog.push({ type, message, actorId });
}

// ---------------- Senior/Guardian-facing ----------------

/**
 * `senior` is already resolved server-side via resolveActingSenior — the
 * barangay is derived from the Senior's own record, never a
 * client-supplied value, so a Senior can never submit a concern
 * "assigned" to another barangay.
 */
export async function createConcern(senior, requestingUser, data) {
  const concern = await Concern.create({
    ...data,
    seniorId: senior._id,
    submittedBy: requestingUser.id,
    barangayId: senior.barangayId,
    status: CONCERN_STATUS.NEW,
  });
  pushLog(concern, { type: "CREATED", message: "Concern submitted.", actorId: requestingUser.id });
  await concern.save();

  await notifyBarangayStaffOfNewConcern(concern);
  return concern;
}

export async function listConcernsForSenior(senior, { status, category, search } = {}) {
  const query = { seniorId: senior._id };
  if (status) query.status = status;
  if (category) query.category = category;
  if (search && search.trim()) query.$text = { $search: search.trim() };
  return Concern.find(query).select("-activityLog").sort({ createdAt: -1 });
}

/** Ownership enforced by the query itself — a seniorId mismatch reads as "not found", never leaked (Part 11). */
export async function getConcernForSenior(concernId, senior) {
  const concern = await Concern.findOne({ _id: concernId, seniorId: senior._id });
  if (!concern) throw new NotFoundError("Concern not found.");
  // priorityReason is Staff-internal context (see model comment) — not
  // surfaced to the Senior, who only sees the resulting priority itself.
  const obj = concern.toObject();
  delete obj.priorityReason;
  return obj;
}

// ---------------- Staff/Admin/LGU-OSCA-facing ----------------

export async function listConcernsForStaff(
  requestingUser,
  { status, priority, category, search, barangayId, page, limit } = {}
) {
  const query = {};

  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId) return page && limit ? { data: [], total: 0, page: 1, limit, totalPages: 1 } : [];
    query.barangayId = requestingUser.assignedBarangayId;
  } else if (barangayId) {
    assertCanAccessBarangay(requestingUser, barangayId);
    query.barangayId = barangayId;
  }

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (search && search.trim()) query.$text = { $search: search.trim() };

  const baseQuery = Concern.find(query)
    .select("-activityLog -responses")
    .populate({ path: "seniorId", select: "firstName lastName seniorCitizenId" })
    .sort({ createdAt: -1 });

  // Same optional-pagination convention as notification.service.js's
  // listMyNotifications — reused rather than inventing a new response
  // shape (Part 22).
  if (page && limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const [data, total] = await Promise.all([
      baseQuery.skip((pageNum - 1) * limitNum).limit(limitNum),
      Concern.countDocuments(query),
    ]);
    return { data, total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) };
  }

  return baseQuery;
}

export async function getConcernForStaff(concernId, requestingUser) {
  const concern = await Concern.findById(concernId)
    .populate({ path: "seniorId", select: "firstName lastName seniorCitizenId" })
    .populate({ path: "barangayId", select: "name municipality" })
    .populate({ path: "submittedBy", select: "email role" })
    .populate({ path: "responses.respondedBy", select: "email" })
    .populate({ path: "activityLog.actorId", select: "email role" });
  if (!concern) throw new NotFoundError("Concern not found.");
  assertCanManage(concern, requestingUser);
  return concern;
}

export async function changeStatus(concernId, requestingUser, { toStatus, note } = {}) {
  const concern = await Concern.findById(concernId);
  if (!concern) throw new NotFoundError("Concern not found.");
  assertCanManage(concern, requestingUser);

  const allowed = CONCERN_TRANSITIONS[concern.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new ConflictError(
      `Cannot change status from ${concern.status} to ${toStatus}. Concerns must move through the workflow in order.`
    );
  }

  const fromStatus = concern.status;
  concern.status = toStatus;
  if (toStatus === CONCERN_STATUS.RESOLVED) {
    concern.resolvedAt = new Date();
    concern.resolvedBy = requestingUser.id;
  }
  pushLog(concern, {
    type: "STATUS_CHANGE",
    message: note ? `Status changed to ${toStatus}. ${note}` : `Status changed to ${toStatus}.`,
    actorId: requestingUser.id,
  });
  await concern.save();

  await notifyConcernParticipants(concern, {
    eventType: `CONCERN_STATUS_${toStatus}`,
    title: `Concern Update: ${concern.subject}`,
    message: `Your concern "${concern.subject}" is now ${STATUS_LABELS[toStatus] || toStatus}.`,
  });

  return concern;
}

/**
 * Priority is Staff's own classification — never automatically derived
 * from the Senior's reportedUrgency (Part 6). Allowed only once Staff
 * has actually started reviewing (UNDER_REVIEW/IN_PROGRESS), not on a
 * still-untouched NEW concern or an already-closed RESOLVED one. A
 * reason is always required so Staff can later see why a classification
 * was made, per the explicit system requirement.
 */
export async function setPriority(concernId, requestingUser, { priority, reason }) {
  const concern = await Concern.findById(concernId);
  if (!concern) throw new NotFoundError("Concern not found.");
  assertCanManage(concern, requestingUser);

  if (![CONCERN_STATUS.UNDER_REVIEW, CONCERN_STATUS.IN_PROGRESS].includes(concern.status)) {
    throw new ConflictError("Priority can only be classified while a concern is under review or in progress.");
  }
  if (!reason || !reason.trim()) {
    throw new ConflictError("A reason is required when classifying priority.");
  }

  concern.priority = priority;
  concern.priorityReason = reason.trim();
  concern.priorityClassifiedBy = requestingUser.id;
  concern.priorityClassifiedAt = new Date();
  pushLog(concern, {
    type: "PRIORITY_SET",
    message: `Classified as ${priority} priority.`,
    actorId: requestingUser.id,
  });
  await concern.save();

  return concern;
}

/** Staff response — only while the concern is actively being handled, not before review and not after it's closed. */
export async function respondToConcern(concernId, requestingUser, { message }) {
  const concern = await Concern.findById(concernId);
  if (!concern) throw new NotFoundError("Concern not found.");
  assertCanManage(concern, requestingUser);

  if (![CONCERN_STATUS.UNDER_REVIEW, CONCERN_STATUS.IN_PROGRESS].includes(concern.status)) {
    throw new ConflictError("A response can only be sent while a concern is under review or in progress.");
  }

  concern.responses.push({ message, respondedBy: requestingUser.id });
  pushLog(concern, { type: "RESPONSE", message: "Barangay Staff responded.", actorId: requestingUser.id });
  await concern.save();

  await notifyConcernParticipants(concern, {
    eventType: "CONCERN_RESPONSE",
    title: `Response to: ${concern.subject}`,
    message: "A Barangay Staff member responded to your concern.",
  });

  return concern;
}

// ---------------- Notifications ----------------

/** New concern -> notify BARANGAY_STAFF assigned to that barangay (Part 9). Not Admin/LGU-OSCA — they have their own broad-access view, not a personal inbox to alert. */
async function notifyBarangayStaffOfNewConcern(concern) {
  const staff = await User.find({
    role: ROLES.BARANGAY_STAFF,
    assignedBarangayId: concern.barangayId,
    status: ACCOUNT_STATUS.ACTIVE,
  }).select("_id");
  if (staff.length === 0) return;

  await createNotifications(
    staff.map((u) => u._id),
    {
      type: NOTIFICATION_TYPE.CONCERN,
      eventType: "CONCERN_SUBMITTED",
      title: "New Concern Submitted",
      message: `A new concern "${concern.subject}" was submitted and needs review.`,
      relatedEntityType: "Concern",
      relatedEntityId: concern._id,
    }
  );
}

/**
 * Status/response updates -> notify the Senior, plus (once reachable)
 * any authorized Guardian for that Senior — mirrors
 * notifyActivityAudience's dormant-Guardian pattern in activity.service.js.
 */
async function notifyConcernParticipants(concern, { eventType, title, message }) {
  const senior = await Senior.findById(concern.seniorId).select("userId");
  if (!senior) return;

  const recipientIds = new Set([senior.userId.toString()]);

  const guardians = await Guardian.find({
    seniorId: concern.seniorId,
    authorizationConfirmed: true,
    userId: { $ne: null },
  }).select("userId");
  guardians.forEach((g) => g.userId && recipientIds.add(g.userId.toString()));

  await createNotifications([...recipientIds], {
    type: NOTIFICATION_TYPE.CONCERN,
    eventType,
    title,
    message,
    relatedEntityType: "Concern",
    relatedEntityId: concern._id,
  });
}
