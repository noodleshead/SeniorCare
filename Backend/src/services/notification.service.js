import Notification from "../models/Notification.js";
import { NotFoundError } from "../utils/errors.js";
import { areNotificationsEnabled } from "./systemSettings.service.js";

/**
 * Creates a notification for a single recipient.
 *
 * IMPORTANT (transaction/session safety): this is intentionally a
 * plain, session-less write. Every event-driven call site in this
 * project (benefitApplication.service.js, pensionClaim.service.js,
 * verification.service.js) invokes this only *after* its own
 * `session.withTransaction(...)` block has already resolved and,
 * where relevant, after `session.endSession()` — mirroring the fix for
 * the "Use of expired sessions is not permitted" bug. Notification
 * creation does not need to be atomic with the business transaction:
 * if it fails, the underlying pension/benefit/document/announcement
 * change has already succeeded and should not be rolled back over a
 * missed notification.
 *
 * Idempotent when `relatedEntityId` is supplied: a duplicate
 * (recipientId, eventType, relatedEntityId) from a retry or a
 * re-triggered status transition is silently ignored rather than
 * creating a second notification or throwing.
 */
export async function createNotification({
  recipientId,
  type,
  eventType,
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
}) {
  // System Settings' notifications.enabled toggle (module 15) — while
  // OFF, no new Notification document is created for ANY event,
  // system-wide. Existing notifications already delivered are
  // untouched; this only gates future creation. Checked here, at the
  // single lowest-level write function, so every caller in the project
  // (benefitApplication/pensionClaim/verification/announcement
  // services) is covered without touching each of them individually.
  if (!(await areNotificationsEnabled())) {
    return null;
  }
  try {
    return await Notification.create({
      recipientId,
      type,
      eventType,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
    });
  } catch (err) {
    // Duplicate-key error from the idempotency index — this exact
    // event already notified this recipient about this entity.
    if (err?.code === 11000) {
      return Notification.findOne({ recipientId, eventType, relatedEntityId });
    }
    throw err;
  }
}

/**
 * Fan-out helper: same event, many recipients. Failures for individual
 * recipients (e.g. a stray duplicate race) don't abort the rest of the
 * batch — each recipient's notification is independent of the others.
 */
export async function createNotifications(recipientIds, base) {
  const uniqueIds = [...new Set(recipientIds.map((id) => id.toString()))];
  const results = await Promise.allSettled(
    uniqueIds.map((recipientId) => createNotification({ ...base, recipientId }))
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

/** The authenticated user's own notifications — never any other user's. */
export async function listMyNotifications(requestingUser, { read, page, limit } = {}) {
  const query = { recipientId: requestingUser.id };
  if (read === "true" || read === true) query.read = true;
  if (read === "false" || read === false) query.read = false;

  if (page && limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const [data, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments(query),
    ]);
    return { data, total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) };
  }

  return Notification.find(query).sort({ createdAt: -1 }).limit(100);
}

export async function getMyUnreadCount(requestingUser) {
  const count = await Notification.countDocuments({ recipientId: requestingUser.id, read: false });
  return { count };
}

/** Ownership is enforced by the query itself — a recipientId mismatch reads as "not found", never leaked. */
export async function markAsRead(notificationId, requestingUser) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: requestingUser.id },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw new NotFoundError("Notification not found.");
  return notification;
}

export async function markAllAsRead(requestingUser) {
  const result = await Notification.updateMany(
    { recipientId: requestingUser.id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount };
}

export async function deleteNotification(notificationId, requestingUser) {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipientId: requestingUser.id,
  });
  if (!notification) throw new NotFoundError("Notification not found.");
  return notification;
}
