import { api, toApiError } from "../utils/api.js";

/**
 * Notification API — every endpoint resolves the recipient from the
 * authenticated token server-side (see notification.routes.js). There
 * is no userId anywhere in these calls for a caller to tamper with.
 * Backend: notification.routes.js -> notification.controller.js -> notification.service.js
 */

export async function getMyNotifications({ read, page, limit } = {}) {
  try {
    const params = {};
    if (read !== undefined) params.read = read;
    if (page) params.page = page;
    if (limit) params.limit = limit;
    const res = await api.get("/notifications", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getUnreadCount() {
  try {
    const res = await api.get("/notifications/unread-count");
    return res.data?.data?.count || 0;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const res = await api.patch(`/notifications/${notificationId}/read`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function markAllNotificationsRead() {
  try {
    const res = await api.patch("/notifications/read-all");
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteNotification(notificationId) {
  try {
    const res = await api.delete(`/notifications/${notificationId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
