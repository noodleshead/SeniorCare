import * as notificationService from "../services/notification.service.js";

/**
 * Always resolved from the authenticated user (req.user.id) — there is
 * no userId anywhere in this router for a caller to override, so a user
 * can never retrieve another user's notifications by tampering with a
 * query/param.
 */
export async function listMine(req, res, next) {
  try {
    const { read, page, limit } = req.query;
    const result = await notificationService.listMyNotifications(req.user, { read, page, limit });
    if (Array.isArray(result)) {
      res.status(200).json({ success: true, data: result });
    } else {
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    const result = await notificationService.getMyUnreadCount(req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user);
    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const result = await notificationService.markAllAsRead(req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await notificationService.deleteNotification(req.params.id, req.user);
    res.status(200).json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
