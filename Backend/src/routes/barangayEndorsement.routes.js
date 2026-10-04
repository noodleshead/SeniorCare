import { Router } from "express";
import * as controller from "../controllers/barangayEndorsement.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  barangayVerificationDecisionSchema,
  homeVisitRecordSchema,
  barangayEndorsementDecisionSchema,
} from "../validators/barangayEndorsement.validator.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// GET routes: Barangay Staff (own barangay, enforced in the service, not
// from any client-supplied id) plus Admin/LGU-OSCA read-only system-wide
// visibility (module Step 8: "Admin may retain system-wide visibility").
// POST/action routes: Barangay Staff ONLY — the service's own
// assertBarangayStaffCanAct additionally rejects ADMIN/LGU_OSCA even
// though they can pass this route-level check, per the module's strict
// role-separation requirement (Admin does not get to also perform
// Barangay actions just because it can view them).
const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
const staffOnly = authorizeRoles(ROLES.BARANGAY_STAFF);

router.get("/", authenticate, staffOrAbove, controller.listQueue);
router.get("/summary", authenticate, staffOnly, controller.getSummary);
router.get("/:seniorId", authenticate, staffOrAbove, controller.getDetail);

router.post(
  "/:seniorId/verification",
  authenticate,
  staffOnly,
  validateBody(barangayVerificationDecisionSchema),
  controller.recordVerification
);
router.post("/:seniorId/home-visit", authenticate, staffOnly, validateBody(homeVisitRecordSchema), controller.recordHomeVisit);
router.post(
  "/:seniorId/endorsement",
  authenticate,
  staffOnly,
  validateBody(barangayEndorsementDecisionSchema),
  controller.recordEndorsement
);

export default router;
