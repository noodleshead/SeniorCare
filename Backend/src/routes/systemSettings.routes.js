import { Router } from "express";
import * as systemSettingsController from "../controllers/systemSettings.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { ROLES } from "../utils/constants.js";

const router = Router();
const adminOnly = authorizeRoles(ROLES.ADMIN);

// Unauthenticated on purpose — display-only branding (system name,
// description, contact info), consumed by the Login/Register pages and
// the dashboard sidebar before a user has signed in. No maintenance
// mode / notifications / applications / registration toggle is ever
// present in this payload — see systemSettings.service.js#getPublicSettings.
router.get("/public", systemSettingsController.getPublicSettings);

// Everything else is ADMIN-only, both the read and every write. There
// is deliberately no generic `PUT /settings` — only whitelisted,
// per-section routes backed by systemSettings.validator.js's `.strict()`
// schemas (module requirement §18/§31: no arbitrary key can reach the
// database through this router).
router.get("/", authenticate, adminOnly, systemSettingsController.getSettings);
router.put("/:section", authenticate, adminOnly, systemSettingsController.updateSection);

export default router;
