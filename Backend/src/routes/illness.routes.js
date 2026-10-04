import { Router } from "express";
import * as illnessController from "../controllers/illness.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createIllnessSchema, updateIllnessSchema, updateIllnessStatusSchema } from "../validators/illness.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// ADMIN only — Senior/Guardian/Barangay Staff are all denied, same
// adminOnly convention as adminReports.routes.js/auditLog.routes.js/
// systemSettings.routes.js. The Senior-facing illness list is a
// separate, already-existing public route
// (GET /api/registration/illnesses, untouched by this file).
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.get("/", authenticate, adminOnly, illnessController.listIllnesses);
router.get("/:id", authenticate, adminOnly, illnessController.getIllness);
router.post("/", authenticate, adminOnly, validateBody(createIllnessSchema), illnessController.createIllness);
router.patch("/:id", authenticate, adminOnly, validateBody(updateIllnessSchema), illnessController.updateIllness);
router.patch(
  "/:id/status",
  authenticate,
  adminOnly,
  validateBody(updateIllnessStatusSchema),
  illnessController.updateIllnessStatus
);
// No DELETE route — see illness.service.js's header comment (deactivate,
// never hard-delete, to preserve Seniors' historical medicalConditionId references).

export default router;
