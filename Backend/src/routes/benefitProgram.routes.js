import { Router } from "express";
import * as programController from "../controllers/benefitProgram.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createBenefitProgramSchema, updateBenefitProgramSchema } from "../validators/benefit.validator.js";
import { ROLES } from "../utils/constants.js";
import { SENIOR_OR_GUARDIAN_ROLES } from "../utils/guardianAccess.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
const managersOnly = authorizeRoles(ROLES.ADMIN, ROLES.LGU_OSCA);
// Senior-only in practice today; GUARDIAN is included so this route needs
// no changes once Guardian login exists (see utils/guardianAccess.js).
const seniorOrGuardian = authorizeRoles(...SENIOR_OR_GUARDIAN_ROLES);

// Senior/Guardian: active programs scoped to their own barangay, each
// annotated with the backend-computed eligibility result.
router.get("/me/eligible", authenticate, seniorOrGuardian, programController.listMyEligiblePrograms);

// Staff/Admin/LGU-OSCA: full catalog (including INACTIVE) for management/reference.
router.get("/", authenticate, staffOrAbove, programController.listPrograms);
router.get("/:id", authenticate, staffOrAbove, programController.getProgram);

// Program catalog management: ADMIN/LGU_OSCA only (see benefitProgram.service.js).
router.post("/", authenticate, managersOnly, validateBody(createBenefitProgramSchema), programController.createProgram);
router.patch("/:id", authenticate, managersOnly, validateBody(updateBenefitProgramSchema), programController.updateProgram);

export default router;
