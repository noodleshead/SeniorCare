import { Router } from "express";
import * as verificationController from "../controllers/verification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { approveVerificationSchema, rejectVerificationSchema } from "../validators/verification.validator.js";
import { createGuardianAccountSchema, resetGuardianPasswordSchema } from "../validators/guardian.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);

router.get("/pending", authenticate, staffOrAbove, verificationController.listPending);
router.get("/stats", authenticate, staffOrAbove, verificationController.getStats);
router.get("/documents/:documentId/file", authenticate, staffOrAbove, verificationController.getDocument);
router.get("/:id", authenticate, staffOrAbove, verificationController.getOne);
router.patch(
  "/:id/approve",
  authenticate,
  staffOrAbove,
  validateBody(approveVerificationSchema),
  verificationController.approve
);
router.patch(
  "/:id/reject",
  authenticate,
  staffOrAbove,
  validateBody(rejectVerificationSchema),
  verificationController.reject
);

// Provisions a login for an already-authorization-confirmed Guardian
// record. Lives here (not admin.routes.js, which is intentionally
// ADMIN-only) because enabling a Guardian's login is a natural next
// step of the same Staff-performed verification workflow that confirmed
// their authorization documents in the first place.
router.post(
  "/guardians/:guardianRecordId/create-account",
  authenticate,
  staffOrAbove,
  validateBody(createGuardianAccountSchema),
  verificationController.createGuardianAccount
);

// Recovery path for a Guardian whose one-time temporary password was
// lost/never captured — regenerates and shows a new one exactly the
// same way. Only valid once an account already exists (see
// resetGuardianPassword's own check).
router.post(
  "/guardians/:guardianRecordId/reset-password",
  authenticate,
  staffOrAbove,
  validateBody(resetGuardianPasswordSchema),
  verificationController.resetGuardianPassword
);

export default router;
