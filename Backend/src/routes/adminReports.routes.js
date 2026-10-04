import { Router } from "express";
import * as adminReportsController from "../controllers/adminReports.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// ADMIN only — narrower than analytics.routes.js's staffOrAbove
// (BARANGAY_STAFF/ADMIN/LGU_OSCA). Admin System Reports is a distinct,
// higher-privilege module from Senior Mapping & Barangay Analytics (see
// module requirements: "Keep Admin Reports separate from Barangay
// Analytics"), so BARANGAY_STAFF and LGU_OSCA are intentionally NOT
// included here even though they can reach the analytics endpoints.
// Enforced here in middleware, not just by hiding the frontend menu item.
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.get("/barangays", authenticate, adminOnly, adminReportsController.getBarangays);
router.get("/", authenticate, adminOnly, adminReportsController.getReport);

router.get("/export/barangay-summary.csv", authenticate, adminOnly, adminReportsController.exportBarangaySummaryCsv);
router.get("/export/demographics.csv", authenticate, adminOnly, adminReportsController.exportDemographicsCsv);
router.get("/export/pension.csv", authenticate, adminOnly, adminReportsController.exportPensionCsv);
router.get("/export/applications.csv", authenticate, adminOnly, adminReportsController.exportApplicationsCsv);
router.get("/export/users.csv", authenticate, adminOnly, adminReportsController.exportUserStatsCsv);

export default router;
