import { Router } from "express";
import * as medicalVerificationController from "../controllers/medicalVerification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { medicalVerificationDecisionSchema } from "../validators/medicalVerification.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// ADMIN only. Deliberately NOT staffOrAbove (unlike analytics/pension) —
// module requirement's own role-separation section is explicit that
// Barangay Staff has no role in Medical Verification in this phase; that
// begins with Phase 6's Home Visit queue, which does not exist yet.
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.get("/", authenticate, adminOnly, medicalVerificationController.listMedicalVerifications);
router.get("/:seniorId", authenticate, adminOnly, medicalVerificationController.getMedicalVerification);
router.post(
  "/:seniorId/decision",
  authenticate,
  adminOnly,
  validateBody(medicalVerificationDecisionSchema),
  medicalVerificationController.recordDecision
);

export default router;
