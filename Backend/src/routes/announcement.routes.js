import { Router } from "express";
import * as announcementController from "../controllers/announcement.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createAnnouncementSchema, updateAnnouncementSchema } from "../validators/announcement.validator.js";
import { ROLES } from "../utils/constants.js";
import { SENIOR_OR_GUARDIAN_ROLES } from "../utils/guardianAccess.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
// Senior-only in practice today; GUARDIAN is included so this route needs
// no changes once Guardian login exists (see utils/guardianAccess.js).
const seniorOrGuardian = authorizeRoles(...SENIOR_OR_GUARDIAN_ROLES);

// Senior/Guardian: published announcements applicable to them.
router.get("/me", authenticate, seniorOrGuardian, announcementController.listForMe);

// Staff/Admin/LGU-OSCA: management listing, barangay-scoped for BARANGAY_STAFF.
router.get("/", authenticate, staffOrAbove, announcementController.listForStaff);
router.get("/:id", authenticate, staffOrAbove, announcementController.getById);

router.post(
  "/",
  authenticate,
  staffOrAbove,
  validateBody(createAnnouncementSchema),
  announcementController.create
);
router.patch(
  "/:id",
  authenticate,
  staffOrAbove,
  validateBody(updateAnnouncementSchema),
  announcementController.update
);
router.patch("/:id/publish", authenticate, staffOrAbove, announcementController.publish);
router.patch("/:id/archive", authenticate, staffOrAbove, announcementController.archive);
router.delete("/:id", authenticate, staffOrAbove, announcementController.remove);

export default router;
