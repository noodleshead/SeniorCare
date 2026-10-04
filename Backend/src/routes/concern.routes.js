import { Router } from "express";
import * as concernController from "../controllers/concern.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createConcernSchema,
  changeStatusSchema,
  setPrioritySchema,
  respondSchema,
} from "../validators/concern.validator.js";
import { ROLES } from "../utils/constants.js";
import { SENIOR_OR_GUARDIAN_ROLES } from "../utils/guardianAccess.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
// Senior-only in practice today; GUARDIAN is included so this route needs
// no changes once Guardian login exists (see utils/guardianAccess.js).
const seniorOrGuardian = authorizeRoles(...SENIOR_OR_GUARDIAN_ROLES);

// Senior/Guardian: submit and view their own concerns.
router.post("/", authenticate, seniorOrGuardian, validateBody(createConcernSchema), concernController.create);
router.get("/me", authenticate, seniorOrGuardian, concernController.listForMe);
router.get("/me/:id", authenticate, seniorOrGuardian, concernController.getForMe);

// Staff/Admin/LGU-OSCA: management, barangay-scoped for BARANGAY_STAFF.
router.get("/", authenticate, staffOrAbove, concernController.listForStaff);
router.get("/:id", authenticate, staffOrAbove, concernController.getForStaff);
router.patch("/:id/status", authenticate, staffOrAbove, validateBody(changeStatusSchema), concernController.changeStatus);
router.patch("/:id/priority", authenticate, staffOrAbove, validateBody(setPrioritySchema), concernController.setPriority);
router.post("/:id/respond", authenticate, staffOrAbove, validateBody(respondSchema), concernController.respond);

export default router;
