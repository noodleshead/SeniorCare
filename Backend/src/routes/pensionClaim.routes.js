import { Router } from "express";
import * as claimController from "../controllers/pensionClaim.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { bookSlotSchema, verifyClaimSchema } from "../validators/pension.validator.js";
import { ROLES } from "../utils/constants.js";
import { SENIOR_OR_GUARDIAN_ROLES } from "../utils/guardianAccess.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
// GUARDIAN included so an authorized Guardian can act for their managed
// Senior — see the controller, which resolves the actual acting Senior
// via resolveActingSenior() before ever touching pensionClaim.service.js
// (which is intentionally left untouched: it still only ever sees the
// target Senior's own userId, exactly as before).
const seniorOrGuardian = authorizeRoles(...SENIOR_OR_GUARDIAN_ROLES);

// Senior self-service.
router.post("/", authenticate, seniorOrGuardian, validateBody(bookSlotSchema), claimController.bookSlot);
router.get("/me/upcoming", authenticate, seniorOrGuardian, claimController.getMyUpcomingClaim);
router.get("/me/history", authenticate, seniorOrGuardian, claimController.getMyClaimHistory);
router.get("/me/:id/qr", authenticate, seniorOrGuardian, claimController.getMyClaimQr);
router.post("/:id/cancel", authenticate, seniorOrGuardian, claimController.cancelClaim);

// Barangay Staff / Admin / LGU-OSCA.
router.get("/", authenticate, staffOrAbove, claimController.listClaims);
// Step 1: resolve the scanned/entered QR token — read-only, for review.
router.post("/verify", authenticate, staffOrAbove, validateBody(verifyClaimSchema), claimController.resolveClaim);
// Step 2: explicit Staff confirmation — the only path that sets CLAIMED.
router.post("/confirm", authenticate, staffOrAbove, validateBody(verifyClaimSchema), claimController.confirmClaim);

export default router;
