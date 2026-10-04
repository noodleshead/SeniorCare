import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

// ADMIN only — same narrower-than-analytics convention as
// adminReports.routes.js. Intentionally no POST/PUT/PATCH/DELETE route
// exists anywhere in this router: audit records are created exclusively
// by auditLog.service.js#createAuditLog from inside other services, and
// are immutable once written (module requirements §27).
const adminOnly = authorizeRoles(ROLES.ADMIN);

router.get("/summary", authenticate, adminOnly, auditLogController.getSummary);
router.get("/:id", authenticate, adminOnly, auditLogController.getLog);
router.get("/", authenticate, adminOnly, auditLogController.listLogs);

export default router;
