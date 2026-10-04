import Announcement from "../models/Announcement.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import User from "../models/User.js";
import {
  ROLES,
  ACCOUNT_STATUS,
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_SCOPE,
  TARGET_AUDIENCE,
  NOTIFICATION_TYPE,
} from "../utils/constants.js";
import { NotFoundError, ConflictError, AuthorizationError } from "../utils/errors.js";
import { hasBroadBarangayAccess, assertCanAccessBarangay } from "../utils/barangayScope.js";
import { createNotifications } from "./notification.service.js";

function excerpt(content, max = 160) {
  if (!content) return "";
  return content.length > max ? `${content.slice(0, max).trim()}…` : content;
}

/**
 * Barangay Staff may only ever author/manage announcements scoped to
 * their own assigned barangay (fail closed if unassigned). Admin/LGU-OSCA
 * may author SYSTEM_WIDE announcements or ones scoped to any barangay(s).
 * Mirrors the barangayScope.js pattern used across Pension/Benefits.
 */
function assertScopeAllowed(requestingUser, { scope, barangayIds }) {
  if (hasBroadBarangayAccess(requestingUser.role)) return;

  // Barangay Staff: never system-wide, and only their own barangay.
  if (scope === ANNOUNCEMENT_SCOPE.SYSTEM_WIDE) {
    throw new AuthorizationError("Only Admin or LGU-OSCA may publish a system-wide announcement.");
  }
  if (!requestingUser.assignedBarangayId) {
    throw new AuthorizationError("You must be assigned to a Barangay to manage announcements.");
  }
  const ids = (barangayIds || []).map((id) => id.toString());
  const onlyOwnBarangay = ids.length > 0 && ids.every((id) => id === requestingUser.assignedBarangayId);
  if (!onlyOwnBarangay) {
    throw new AuthorizationError("You may only manage announcements for your assigned Barangay.");
  }
}

function assertCanManage(announcement, requestingUser) {
  if (hasBroadBarangayAccess(requestingUser.role)) return;
  if (announcement.scope === ANNOUNCEMENT_SCOPE.SYSTEM_WIDE) {
    throw new AuthorizationError("You are not authorized to manage this announcement.");
  }
  const ids = announcement.barangayIds.map((id) => id.toString());
  if (!requestingUser.assignedBarangayId || !ids.includes(requestingUser.assignedBarangayId)) {
    throw new AuthorizationError("You are not authorized to manage this announcement.");
  }
}

export async function createAnnouncement(requestingUser, data) {
  const scope = data.scope || ANNOUNCEMENT_SCOPE.BARANGAY;
  const barangayIds =
    scope === ANNOUNCEMENT_SCOPE.SYSTEM_WIDE
      ? []
      : data.barangayIds && data.barangayIds.length > 0
      ? data.barangayIds
      : requestingUser.assignedBarangayId
      ? [requestingUser.assignedBarangayId]
      : [];

  assertScopeAllowed(requestingUser, { scope, barangayIds });

  if (scope === ANNOUNCEMENT_SCOPE.BARANGAY && barangayIds.length === 0) {
    throw new ConflictError("At least one Barangay must be specified for a Barangay-scoped announcement.");
  }

  return Announcement.create({
    ...data,
    scope,
    barangayIds,
    createdBy: requestingUser.id,
    status: ANNOUNCEMENT_STATUS.DRAFT,
  });
}

export async function updateAnnouncement(announcementId, requestingUser, data) {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) throw new NotFoundError("Announcement not found.");
  assertCanManage(announcement, requestingUser);

  if (data.scope || data.barangayIds) {
    assertScopeAllowed(requestingUser, {
      scope: data.scope || announcement.scope,
      barangayIds: data.barangayIds || announcement.barangayIds,
    });
  }

  Object.assign(announcement, data, { updatedBy: requestingUser.id });
  await announcement.save();
  return announcement;
}

export async function getAnnouncementById(announcementId, requestingUser) {
  const announcement = await Announcement.findById(announcementId).populate({
    path: "barangayIds",
    select: "name municipality",
  });
  if (!announcement) throw new NotFoundError("Announcement not found.");
  assertCanManage(announcement, requestingUser);
  return announcement;
}

/** Staff/Admin/LGU-OSCA management listing — scoped to the requester's barangay unless broad access. */
export async function listAnnouncementsForStaff(requestingUser, { status, category, search, barangayId } = {}) {
  const query = {};

  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId) return [];
    query.$or = [
      { scope: ANNOUNCEMENT_SCOPE.SYSTEM_WIDE },
      { scope: ANNOUNCEMENT_SCOPE.BARANGAY, barangayIds: requestingUser.assignedBarangayId },
    ];
  } else if (barangayId) {
    assertCanAccessBarangay(requestingUser, barangayId);
    query.$or = [{ scope: ANNOUNCEMENT_SCOPE.SYSTEM_WIDE }, { barangayIds: barangayId }];
  }

  if (status) query.status = status;
  if (category) query.category = category;
  if (search && search.trim()) query.$text = { $search: search.trim() };

  return Announcement.find(query)
    .populate({ path: "createdBy", select: "email role" })
    .populate({ path: "barangayIds", select: "name" })
    .sort({ createdAt: -1 });
}

/**
 * Senior/Guardian viewing list — PUBLISHED only, scoped to the acting
 * Senior's own barangay (or system-wide) and audience. `senior` is
 * resolved server-side by the caller via resolveActingSenior — never
 * a client-supplied barangayId.
 */
export async function listAnnouncementsForSenior(senior, { category, search } = {}) {
  const query = {
    status: ANNOUNCEMENT_STATUS.PUBLISHED,
    targetAudience: { $in: [TARGET_AUDIENCE.ALL, TARGET_AUDIENCE.SENIOR_CITIZEN] },
    $or: [{ scope: ANNOUNCEMENT_SCOPE.SYSTEM_WIDE }, { barangayIds: senior.barangayId }],
  };
  if (category) query.category = category;
  if (search && search.trim()) query.$text = { $search: search.trim() };

  const announcements = await Announcement.find(query).sort({ isImportant: -1, publishedAt: -1 });
  return announcements.map((a) => ({
    _id: a._id,
    title: a.title,
    content: a.content,
    excerpt: excerpt(a.content),
    category: a.category,
    scope: a.scope,
    isImportant: a.isImportant,
    publishedAt: a.publishedAt,
  }));
}

export async function publishAnnouncement(announcementId, requestingUser) {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) throw new NotFoundError("Announcement not found.");
  assertCanManage(announcement, requestingUser);

  if (announcement.status === ANNOUNCEMENT_STATUS.PUBLISHED) {
    throw new ConflictError("This announcement is already published.");
  }

  announcement.status = ANNOUNCEMENT_STATUS.PUBLISHED;
  announcement.publishedAt = new Date();
  announcement.archivedAt = null;
  announcement.updatedBy = requestingUser.id;
  await announcement.save();

  // Fan-out notifications AFTER the publish write has committed —
  // notification creation is deliberately not part of any transaction
  // here (there isn't one), consistent with the session-safety rule
  // used across Pension/Benefits: never couple notification writes to
  // a transaction that doesn't itself need them.
  await notifyAnnouncementAudience(announcement);

  return announcement;
}

export async function unpublishAnnouncement(announcementId, requestingUser) {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) throw new NotFoundError("Announcement not found.");
  assertCanManage(announcement, requestingUser);

  if (announcement.status !== ANNOUNCEMENT_STATUS.PUBLISHED) {
    throw new ConflictError("Only a published announcement can be archived.");
  }

  announcement.status = ANNOUNCEMENT_STATUS.ARCHIVED;
  announcement.archivedAt = new Date();
  announcement.updatedBy = requestingUser.id;
  await announcement.save();
  return announcement;
}

/** Only an undistributed DRAFT may be deleted — a published announcement is archived instead, never erased. */
export async function deleteAnnouncement(announcementId, requestingUser) {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) throw new NotFoundError("Announcement not found.");
  assertCanManage(announcement, requestingUser);

  if (announcement.status !== ANNOUNCEMENT_STATUS.DRAFT) {
    throw new ConflictError("Only a draft announcement may be deleted. Archive a published announcement instead.");
  }

  await Announcement.deleteOne({ _id: announcement._id });
  return { deleted: true };
}

/**
 * Determines the authorized recipient User ids for a just-published
 * announcement and creates one notification per recipient.
 *
 * Never widens beyond who the announcement is actually authorized to
 * reach: audience (ALL/SENIOR_CITIZEN/GUARDIAN/STAFF_ADMIN) AND barangay
 * scope must both match, same rule enforced for viewing.
 */
async function notifyAnnouncementAudience(announcement) {
  const recipientIds = new Set();
  const barangayFilter =
    announcement.scope === ANNOUNCEMENT_SCOPE.SYSTEM_WIDE ? null : announcement.barangayIds;

  const wantsSeniors = [TARGET_AUDIENCE.ALL, TARGET_AUDIENCE.SENIOR_CITIZEN].includes(announcement.targetAudience);
  const wantsGuardians = [TARGET_AUDIENCE.ALL, TARGET_AUDIENCE.GUARDIAN].includes(announcement.targetAudience);
  const wantsStaff = [TARGET_AUDIENCE.ALL, TARGET_AUDIENCE.STAFF_ADMIN].includes(announcement.targetAudience);

  if (wantsSeniors) {
    const seniorQuery = barangayFilter ? { barangayId: { $in: barangayFilter } } : {};
    const seniors = await Senior.find(seniorQuery).select("userId");
    seniors.forEach((s) => recipientIds.add(s.userId.toString()));
  }

  if (wantsGuardians) {
    // Dormant in practice today (no reachable GUARDIAN login yet — see
    // utils/guardianAccess.js) but resolved correctly so it activates
    // automatically once Guardian accounts exist: only confirmed
    // guardians with their own linked userId, scoped to their Senior's
    // barangay.
    const seniorQuery = barangayFilter ? { barangayId: { $in: barangayFilter } } : {};
    const guardianQuery = { authorizationConfirmed: true, userId: { $ne: null } };
    if (barangayFilter) {
      const seniorIds = (await Senior.find(seniorQuery).select("_id")).map((s) => s._id);
      guardianQuery.seniorId = { $in: seniorIds };
    }
    const guardians = await Guardian.find(guardianQuery).select("userId");
    guardians.forEach((g) => g.userId && recipientIds.add(g.userId.toString()));
  }

  if (wantsStaff) {
    const staffQuery = {
      role: { $in: [ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA] },
      status: ACCOUNT_STATUS.ACTIVE,
    };
    if (barangayFilter) {
      // Broad roles (Admin/LGU-OSCA) still receive barangay-scoped
      // staff announcements — they oversee every barangay. Only
      // BARANGAY_STAFF is filtered to the specific assigned barangay.
      staffQuery.$or = [
        { role: { $in: [ROLES.ADMIN, ROLES.LGU_OSCA] } },
        { role: ROLES.BARANGAY_STAFF, assignedBarangayId: { $in: barangayFilter } },
      ];
      delete staffQuery.role;
    }
    const staff = await User.find(staffQuery).select("_id");
    staff.forEach((u) => recipientIds.add(u._id.toString()));
  }

  if (recipientIds.size === 0) return;

  await createNotifications([...recipientIds], {
    type: NOTIFICATION_TYPE.ANNOUNCEMENT,
    eventType: "ANNOUNCEMENT_PUBLISHED",
    title: announcement.isImportant ? `Important: ${announcement.title}` : announcement.title,
    message: excerpt(announcement.content),
    relatedEntityType: "Announcement",
    relatedEntityId: announcement._id,
  });
}
