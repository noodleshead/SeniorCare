import { Router } from "express";
import * as activityController from "../controllers/activity.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createActivitySchema, updateActivitySchema } from "../validators/activity.validator.js";
import { ROLES } from "../utils/constants.js";
import { SENIOR_OR_GUARDIAN_ROLES } from "../utils/guardianAccess.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
// Senior-only in practice today; GUARDIAN is included so this route needs
// no changes once Guardian login exists (see utils/guardianAccess.js).
const seniorOrGuardian = authorizeRoles(...SENIOR_OR_GUARDIAN_ROLES);

// Senior/Guardian: activities in their own Barangay (upcoming/past via ?when=).
router.get("/me", authenticate, seniorOrGuardian, activityController.listForMe);
router.get("/me/:id", authenticate, seniorOrGuardian, activityController.getForMe);
router.post("/:id/attendance", authenticate, seniorOrGuardian, activityController.confirmMyAttendance);
router.delete("/:id/attendance", authenticate, seniorOrGuardian, activityController.withdrawMyAttendance);

// Staff/Admin/LGU-OSCA: management, barangay-scoped for BARANGAY_STAFF.
router.get("/", authenticate, staffOrAbove, activityController.listForStaff);
router.get("/:id", authenticate, staffOrAbove, activityController.getById);
router.get("/:id/attendees", authenticate, staffOrAbove, activityController.listAttendees);

router.post("/", authenticate, staffOrAbove, validateBody(createActivitySchema), activityController.create);
router.patch("/:id", authenticate, staffOrAbove, validateBody(updateActivitySchema), activityController.update);
router.patch("/:id/publish", authenticate, staffOrAbove, activityController.publish);
router.patch("/:id/cancel", authenticate, staffOrAbove, activityController.cancel);
router.delete("/:id", authenticate, staffOrAbove, activityController.remove);

export default router;
