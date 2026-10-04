import { Router } from "express";
import * as scheduleController from "../controllers/pensionSchedule.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createScheduleSchema, updateScheduleSchema } from "../validators/pension.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
const seniorOnly = authorizeRoles(ROLES.SENIOR_CITIZEN);

// Senior-facing: bookable schedules for the Senior's own Barangay only.
router.get("/me", authenticate, seniorOnly, scheduleController.listMyBarangaySchedules);

// Barangay options for the Create Schedule form. Registered before
// "/:id" so the literal "/barangays" segment isn't captured as an id.
router.get("/barangays", authenticate, staffOrAbove, scheduleController.listBarangayOptions);

// Barangay Staff / Admin / LGU-OSCA management.
router.get("/", authenticate, staffOrAbove, scheduleController.listSchedules);
router.post(
  "/",
  authenticate,
  staffOrAbove,
  validateBody(createScheduleSchema),
  scheduleController.createSchedule
);
router.get("/:id", authenticate, staffOrAbove, scheduleController.getSchedule);
router.patch(
  "/:id",
  authenticate,
  staffOrAbove,
  validateBody(updateScheduleSchema),
  scheduleController.updateSchedule
);
router.patch("/:id/close", authenticate, staffOrAbove, scheduleController.closeSchedule);

export default router;
