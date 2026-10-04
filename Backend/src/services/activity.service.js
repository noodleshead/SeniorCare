import Activity from "../models/Activity.js";
import ActivityAttendance from "../models/ActivityAttendance.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import { ACTIVITY_STATUS, NOTIFICATION_TYPE } from "../utils/constants.js";
import { NotFoundError, ConflictError, AuthorizationError } from "../utils/errors.js";
import { hasBroadBarangayAccess, assertCanAccessBarangay } from "../utils/barangayScope.js";
import { createNotifications } from "./notification.service.js";

function excerpt(content, max = 160) {
  if (!content) return "";
  return content.length > max ? `${content.slice(0, max).trim()}…` : content;
}

/** Fields that, if changed on an already-PUBLISHED activity, are "significant" enough to notify affected users about. */
const SIGNIFICANT_FIELDS = ["date", "startTime", "endTime", "venue", "title"];

/**
 * Barangay Staff may only ever author/manage activities in their own
 * assigned barangay (fail closed if unassigned). Admin/LGU-OSCA may
 * manage an activity for any Barangay. Mirrors the barangayScope.js
 * pattern used across Pension/Benefits/Announcements.
 *
 * `barangayId` may be a raw ObjectId (most callers fetch the Activity
 * without populating it) or a populated Barangay document (getActivityById
 * populates it for the response). A populated document's default
 * .toString() is not its hex id, so comparing against it directly would
 * silently fail this check for every Barangay Staff request that goes
 * through a populated Activity — normalize to a plain id string first.
 */
function assertBarangayAllowed(requestingUser, barangayId) {
  if (hasBroadBarangayAccess(requestingUser.role)) return;
  if (!requestingUser.assignedBarangayId) {
    throw new AuthorizationError("You must be assigned to a Barangay to manage activities.");
  }
  const normalizedId = (barangayId && barangayId._id ? barangayId._id : barangayId).toString();
  if (requestingUser.assignedBarangayId !== normalizedId) {
    throw new AuthorizationError("You may only manage activities for your assigned Barangay.");
  }
}

function assertCanManage(activity, requestingUser) {
  assertBarangayAllowed(requestingUser, activity.barangayId);
}

export async function createActivity(requestingUser, data) {
  const { barangayId: _clientBarangayId, ...rest } = data;

  let barangayId;
  if (hasBroadBarangayAccess(requestingUser.role)) {
    // ADMIN/LGU-OSCA: no assignedBarangayId of their own (they oversee
    // every barangay), so a Barangay must be explicitly selected in
    // the request — this is the only path where a client-supplied
    // barangayId is trusted, and only because it's the sole way for
    // these roles to specify one at all.
    barangayId = data.barangayId;
    if (!barangayId) {
      throw new ConflictError("Please select a Barangay for this activity.");
    }
  } else {
    // BARANGAY_STAFF (or any future non-broad role): always derive the
    // Barangay from the authenticated account's own assignment. Any
    // barangayId the client sent is intentionally ignored — never
    // trusted — matching how Announcements already handles staff scope.
    // Fail closed with a specific, actionable error if the account
    // itself has no assignment, rather than falling through to the
    // generic "must be specified" message that gave no indication of
    // which of the two possible causes it was.
    if (!requestingUser.assignedBarangayId) {
      throw new AuthorizationError(
        "Your staff account has no assigned Barangay. Please contact an administrator before creating activities."
      );
    }
    barangayId = requestingUser.assignedBarangayId;
  }

  return Activity.create({
    ...rest,
    barangayId,
    createdBy: requestingUser.id,
    status: ACTIVITY_STATUS.DRAFT,
  });
}

export async function updateActivity(activityId, requestingUser, data) {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new NotFoundError("Activity not found.");
  assertCanManage(activity, requestingUser);

  if (activity.status === ACTIVITY_STATUS.CANCELLED || activity.status === ACTIVITY_STATUS.COMPLETED) {
    throw new ConflictError("A cancelled or completed activity can no longer be edited.");
  }
  if (data.barangayId) {
    // Only ADMIN/LGU-OSCA may ever move an activity to a different
    // Barangay; a staff account attempting to change it — even back to
    // their own assigned Barangay — is rejected rather than silently
    // accepted, so the field is never a route to reassignment for a
    // scoped role.
    if (!hasBroadBarangayAccess(requestingUser.role)) {
      throw new AuthorizationError("You are not authorized to change this activity's Barangay.");
    }
    assertCanAccessBarangay(requestingUser, data.barangayId);
  }

  const wasPublished = activity.status === ACTIVITY_STATUS.PUBLISHED;
  const changedSignificantly = SIGNIFICANT_FIELDS.some(
    (field) => field in data && String(data[field]) !== String(activity[field])
  );

  Object.assign(activity, data, { updatedBy: requestingUser.id });
  await activity.save();

  // Notification creation happens after the write has committed — this
  // is a plain document save with no session/transaction involved.
  if (wasPublished && changedSignificantly) {
    await notifyActivityAudience(activity, {
      eventType: "ACTIVITY_UPDATED",
      title: `Updated: ${activity.title}`,
      message: `Details for "${activity.title}" have changed. Please review the updated schedule.`,
    });
  }

  return activity;
}

export async function getActivityById(activityId, requestingUser) {
  const activity = await Activity.findById(activityId).populate({ path: "barangayId", select: "name municipality" });
  if (!activity) throw new NotFoundError("Activity not found.");
  assertCanManage(activity, requestingUser);
  const attendeeCount = await ActivityAttendance.countDocuments({ activityId: activity._id });
  return { ...activity.toObject(), attendeeCount };
}

/** Staff/Admin/LGU-OSCA management listing — scoped to the requester's barangay unless broad access. */
export async function listActivitiesForStaff(requestingUser, { status, category, search, barangayId } = {}) {
  const query = {};

  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId) return [];
    query.barangayId = requestingUser.assignedBarangayId;
  } else if (barangayId) {
    assertCanAccessBarangay(requestingUser, barangayId);
    query.barangayId = barangayId;
  }

  if (status) query.status = status;
  if (category) query.category = category;
  if (search && search.trim()) query.$text = { $search: search.trim() };

  return Activity.find(query)
    .populate({ path: "createdBy", select: "email role" })
    .populate({ path: "barangayId", select: "name" })
    .sort({ date: -1 });
}

/**
 * Senior/Guardian viewing list — anything the Senior's own barangay has
 * ever published (excludes DRAFT), split into upcoming/past. `senior`
 * is resolved server-side by the caller via resolveActingSenior — never
 * a client-supplied barangayId.
 */
export async function listActivitiesForSenior(senior, { when, category, search } = {}) {
  const query = {
    barangayId: senior.barangayId,
    status: { $ne: ACTIVITY_STATUS.DRAFT },
  };
  if (category) query.category = category;
  if (search && search.trim()) query.$text = { $search: search.trim() };

  const now = new Date();
  if (when === "upcoming") {
    query.date = { $gte: startOfDay(now) };
    query.status = { $in: [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.ONGOING] };
  } else if (when === "past") {
    query.$or = [
      { date: { $lt: startOfDay(now) } },
      { status: { $in: [ACTIVITY_STATUS.COMPLETED, ACTIVITY_STATUS.CANCELLED] } },
    ];
  }

  const activities = await Activity.find(query).sort({ date: when === "past" ? -1 : 1 });

  const attendedIds = new Set(
    (await ActivityAttendance.find({ seniorId: senior._id, activityId: { $in: activities.map((a) => a._id) } }).select(
      "activityId"
    )).map((a) => a.activityId.toString())
  );

  return activities.map((a) => ({
    _id: a._id,
    title: a.title,
    description: a.description,
    excerpt: excerpt(a.description),
    category: a.category,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    venue: a.venue,
    participantInfo: a.participantInfo,
    attendanceConfirmationEnabled: a.attendanceConfirmationEnabled,
    status: a.status,
    hasConfirmedAttendance: attendedIds.has(a._id.toString()),
  }));
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getActivityForSenior(activityId, senior) {
  const activity = await Activity.findOne({
    _id: activityId,
    barangayId: senior.barangayId,
    status: { $ne: ACTIVITY_STATUS.DRAFT },
  });
  if (!activity) throw new NotFoundError("Activity not found.");

  const attendance = await ActivityAttendance.findOne({ activityId: activity._id, seniorId: senior._id });
  return {
    _id: activity._id,
    title: activity.title,
    description: activity.description,
    category: activity.category,
    date: activity.date,
    startTime: activity.startTime,
    endTime: activity.endTime,
    venue: activity.venue,
    participantInfo: activity.participantInfo,
    attendanceConfirmationEnabled: activity.attendanceConfirmationEnabled,
    status: activity.status,
    hasConfirmedAttendance: Boolean(attendance),
  };
}

export async function publishActivity(activityId, requestingUser) {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new NotFoundError("Activity not found.");
  assertCanManage(activity, requestingUser);

  if (activity.status !== ACTIVITY_STATUS.DRAFT) {
    throw new ConflictError("Only a draft activity can be published.");
  }

  activity.status = ACTIVITY_STATUS.PUBLISHED;
  activity.publishedAt = new Date();
  activity.updatedBy = requestingUser.id;
  await activity.save();

  await notifyActivityAudience(activity, {
    eventType: "ACTIVITY_PUBLISHED",
    title: `New Senior Activity: ${activity.title}`,
    message: `${activity.title} has been scheduled for ${formatDateForMessage(activity.date)} at ${activity.startTime}.`,
  });

  return activity;
}

export async function cancelActivity(activityId, requestingUser, { reason } = {}) {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new NotFoundError("Activity not found.");
  assertCanManage(activity, requestingUser);

  if (![ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.ONGOING].includes(activity.status)) {
    throw new ConflictError("Only a published or ongoing activity can be cancelled.");
  }

  activity.status = ACTIVITY_STATUS.CANCELLED;
  activity.cancelledAt = new Date();
  activity.cancellationReason = reason || "";
  activity.updatedBy = requestingUser.id;
  await activity.save();

  await notifyActivityAudience(activity, {
    eventType: "ACTIVITY_CANCELLED",
    title: `Cancelled: ${activity.title}`,
    message: reason
      ? `${activity.title} has been cancelled. Reason: ${reason}`
      : `${activity.title} has been cancelled.`,
  });

  return activity;
}

/** Only an undistributed DRAFT may be deleted — a published activity is cancelled instead, never erased (activity history requirement). */
export async function deleteActivity(activityId, requestingUser) {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new NotFoundError("Activity not found.");
  assertCanManage(activity, requestingUser);

  if (activity.status !== ACTIVITY_STATUS.DRAFT) {
    throw new ConflictError("Only a draft activity may be deleted. Cancel a published activity instead.");
  }

  await Activity.deleteOne({ _id: activity._id });
  await ActivityAttendance.deleteMany({ activityId: activity._id });
  return { deleted: true };
}

function formatDateForMessage(date) {
  return new Date(date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Determines the authorized recipient User ids for an activity event
 * (published/updated/cancelled) and creates one notification per
 * recipient. Scoped strictly to Seniors (and, once reachable,
 * Guardians) in the activity's own barangay — never widened beyond
 * that, mirroring notifyAnnouncementAudience in announcement.service.js.
 * Notification.createNotifications is idempotent per (recipient,
 * eventType, relatedEntityId), so re-publishing or repeatedly editing
 * an activity never spams the same recipient with duplicate
 * ACTIVITY_UPDATED notifications.
 */
async function notifyActivityAudience(activity, { eventType, title, message }) {
  const recipientIds = new Set();

  const seniors = await Senior.find({ barangayId: activity.barangayId }).select("userId");
  seniors.forEach((s) => recipientIds.add(s.userId.toString()));

  // Dormant in practice today (no reachable GUARDIAN login yet — see
  // utils/guardianAccess.js) but resolved correctly, same as
  // notifyAnnouncementAudience.
  const seniorIds = seniors.map((s) => s._id);
  const guardians = await Guardian.find({
    authorizationConfirmed: true,
    userId: { $ne: null },
    seniorId: { $in: seniorIds },
  }).select("userId");
  guardians.forEach((g) => g.userId && recipientIds.add(g.userId.toString()));

  if (recipientIds.size === 0) return;

  await createNotifications([...recipientIds], {
    type: NOTIFICATION_TYPE.ACTIVITY,
    eventType,
    title,
    message,
    relatedEntityType: "Activity",
    relatedEntityId: activity._id,
  });
}
