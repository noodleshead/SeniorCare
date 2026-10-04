import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Open to every authenticated role — a notification's recipientId is
// always the requester themselves (see notification.controller.js),
// so there is nothing here to further restrict by role.
router.get("/", authenticate, notificationController.listMine);
router.get("/unread-count", authenticate, notificationController.unreadCount);
router.patch("/read-all", authenticate, notificationController.markAllRead);
router.patch("/:id/read", authenticate, notificationController.markRead);
router.delete("/:id", authenticate, notificationController.remove);

export default router;
