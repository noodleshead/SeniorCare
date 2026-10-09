import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// Same role set as verification/pension/benefit-application management —
// SENIOR_CITIZEN and GUARDIAN are never authorized here (per the module's
// own requirements: administrative analytics is Staff/Admin/LGU-OSCA only).
const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);

router.get("/barangays", authenticate, staffOrAbove, analyticsController.getBarangays);
router.get("/summary", authenticate, staffOrAbove, analyticsController.getSummary);
router.get("/map", authenticate, staffOrAbove, analyticsController.getMapMarkers);
// Phase 8 — LGU report exports. Same role set as the rest of this router
// (Staff/Admin/LGU-OSCA); server-side-scoped exactly like /summary.
router.get("/export/barangay-comparison.csv", authenticate, staffOrAbove, analyticsController.exportBarangayComparisonCsv);
router.get("/export/workflow.csv", authenticate, staffOrAbove, analyticsController.exportWorkflowCsv);

export default router;
