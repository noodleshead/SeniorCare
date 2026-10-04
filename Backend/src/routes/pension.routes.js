import { Router } from "express";
import * as pensionController from "../controllers/pension.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createPensionSchema, updatePensionSchema } from "../validators/pension.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
const seniorOnly = authorizeRoles(ROLES.SENIOR_CITIZEN);

// Senior self-service — resolved from the authenticated token, not a param.
router.get("/me", authenticate, seniorOnly, pensionController.getMyPension);

// Barangay Staff / Admin / LGU-OSCA management — barangay-scoped in the service layer.
router.get("/", authenticate, staffOrAbove, pensionController.listPensions);
router.get("/eligible-seniors", authenticate, staffOrAbove, pensionController.listEligibleSeniors);
router.post("/", authenticate, staffOrAbove, validateBody(createPensionSchema), pensionController.createPension);
router.get("/:id", authenticate, staffOrAbove, pensionController.getPension);
router.patch("/:id", authenticate, staffOrAbove, validateBody(updatePensionSchema), pensionController.updatePension);

export default router;
