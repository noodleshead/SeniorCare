import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { ROLES } from "../utils/constants.js";
import {
  createBarangaySchema,
  createStaffSchema,
  updateStaffAssignmentSchema,
  updateStaffStatusSchema,
} from "../validators/admin.validator.js";

const router = Router();

// Every route here manages organizational structure (Barangays, Staff
// accounts/assignments) rather than reviewing individual senior
// registrations, so it's intentionally restricted to ADMIN only —
// narrower than verification's `staffOrAbove` (BARANGAY_STAFF/ADMIN/
// LGU_OSCA). LGU_OSCA's broader verification visibility does not imply
// it should be able to create accounts or barangays.
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.post("/barangays", authenticate, adminOnly, validateBody(createBarangaySchema), adminController.createBarangay);
router.get("/barangays", authenticate, adminOnly, adminController.listBarangays);

router.post("/staff", authenticate, adminOnly, validateBody(createStaffSchema), adminController.createStaff);
router.get("/staff", authenticate, adminOnly, adminController.listStaff);
router.get("/staff/:staffId", authenticate, adminOnly, adminController.getStaff);
router.patch(
  "/staff/:staffId/assignment",
  authenticate,
  adminOnly,
  validateBody(updateStaffAssignmentSchema),
  adminController.updateStaffAssignment
);
router.patch(
  "/staff/:staffId/status",
  authenticate,
  adminOnly,
  validateBody(updateStaffStatusSchema),
  adminController.updateStaffStatus
);

export default router;
