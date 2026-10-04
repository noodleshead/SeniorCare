import { Router } from "express";
import * as userManagementController from "../controllers/userManagement.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { updateUserStatusSchema } from "../validators/userManagement.validator.js";
import { adminUpdateSeniorProfileSchema } from "../validators/profile.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// ADMIN only — unified account visibility/management across every role,
// distinct from admin.routes.js (which only ever managed Barangay
// Staff/Barangays specifically). Senior/Guardian/Barangay Staff/
// LGU-OSCA are all denied by this same authorizeRoles check.
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.get("/", authenticate, adminOnly, userManagementController.listUsers);
router.get("/:userId", authenticate, adminOnly, userManagementController.getUser);
router.patch(
  "/:userId/status",
  authenticate,
  adminOnly,
  validateBody(updateUserStatusSchema),
  userManagementController.updateUserStatus
);

// Deliberately scoped to Senior profile corrections only (not a generic
// "edit any user" endpoint) — no role/status/barangay/password fields are
// accepted by adminUpdateSeniorProfileSchema.
router.patch(
  "/:userId/senior-profile",
  authenticate,
  adminOnly,
  validateBody(adminUpdateSeniorProfileSchema),
  userManagementController.updateSeniorProfile
);

export default router;
