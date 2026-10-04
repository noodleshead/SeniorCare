import { Router } from "express";
import * as guardianController from "../controllers/guardian.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { updateGuardianProfileSchema } from "../validators/profile.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

const guardianOnly = authorizeRoles(ROLES.GUARDIAN);

// Aggregated overview: managed Seniors, pending concerns, upcoming
// pension claims. Every per-module detail (Pension, Documents, Benefits,
// Applications, Announcements, Concerns, Notifications) is served by
// that module's own existing routes with an optional ?seniorId= query
// param — see utils/guardianAccess.js's resolveActingSenior. This file
// only covers what genuinely has no other home: the dashboard rollup
// and the managed-Seniors list/detail used to populate the senior
// switcher.
router.get("/dashboard", authenticate, guardianOnly, guardianController.getDashboard);
router.get("/seniors", authenticate, guardianOnly, guardianController.listSeniors);
router.get("/seniors/:seniorId", authenticate, guardianOnly, guardianController.getSenior);

// The Guardian's own contact details — resolved from req.user, never a param.
router.get("/me", authenticate, guardianOnly, guardianController.getMyProfile);
router.patch("/me", authenticate, guardianOnly, validateBody(updateGuardianProfileSchema), guardianController.updateMyProfile);

export default router;
