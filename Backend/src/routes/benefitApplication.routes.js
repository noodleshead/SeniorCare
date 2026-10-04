import { Router } from "express";
import * as applicationController from "../controllers/benefitApplication.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  applyForBenefitSchema,
  remarksSchema,
  rejectApplicationSchema,
  requestRevisionSchema,
} from "../validators/benefit.validator.js";
import { ROLES } from "../utils/constants.js";
import { ValidationError } from "../utils/errors.js";
import { SENIOR_OR_GUARDIAN_ROLES } from "../utils/guardianAccess.js";

const router = Router();

const staffOrAbove = authorizeRoles(ROLES.BARANGAY_STAFF, ROLES.ADMIN, ROLES.LGU_OSCA);
// Senior-only in practice today; GUARDIAN is included so this route needs
// no changes once Guardian login exists (see utils/guardianAccess.js).
const seniorOrGuardian = authorizeRoles(...SENIOR_OR_GUARDIAN_ROLES);

// Mirrors registration.routes.js's multipart pattern: files under
// `documents`, plus a single JSON-encoded `data` field for everything
// else, parsed into req.body so the existing Zod validator runs unchanged.
function parseJsonDataField(req, _res, next) {
  if (typeof req.body?.data !== "string") {
    return next(new ValidationError("Missing application data."));
  }
  try {
    req.body = JSON.parse(req.body.data);
    next();
  } catch {
    next(new ValidationError("Application data could not be read. Please try again."));
  }
}

// Senior/Guardian self-service.
router.post(
  "/",
  authenticate,
  seniorOrGuardian,
  upload.array("documents", 10),
  parseJsonDataField,
  validateBody(applyForBenefitSchema),
  applicationController.applyForBenefit
);
router.get("/me", authenticate, seniorOrGuardian, applicationController.listMyApplications);
router.get("/me/:id", authenticate, seniorOrGuardian, applicationController.getMyApplication);

// Barangay Staff / Admin / LGU-OSCA.
router.get("/", authenticate, staffOrAbove, applicationController.listApplications);
router.get("/:id", authenticate, staffOrAbove, applicationController.getApplication);
// Phase 7 — OSCA final review. Route-level matches the existing
// approve/reject convention (staffOrAbove at the route, with the
// service itself independently re-checking hasBroadBarangayAccess to
// actually restrict these to Admin/LGU-OSCA) rather than introducing a
// second, inconsistent gating style for just this one endpoint.
router.get("/:id/osca-detail", authenticate, staffOrAbove, applicationController.getOscaDetail);
router.patch(
  "/:id/request-revision",
  authenticate,
  staffOrAbove,
  validateBody(requestRevisionSchema),
  applicationController.requestRevision
);
router.get("/documents/:documentId/file", authenticate, staffOrAbove, applicationController.downloadApplicationDocument);

router.patch("/:id/start-review", authenticate, staffOrAbove, applicationController.startReview);
router.patch(
  "/:id/endorse",
  authenticate,
  staffOrAbove,
  validateBody(remarksSchema),
  applicationController.endorseApplication
);
router.patch(
  "/:id/reject",
  authenticate,
  staffOrAbove,
  validateBody(rejectApplicationSchema),
  applicationController.rejectApplication
);
router.patch(
  "/:id/approve",
  authenticate,
  staffOrAbove,
  validateBody(remarksSchema),
  applicationController.approveApplication
);
router.patch(
  "/:id/release",
  authenticate,
  staffOrAbove,
  validateBody(remarksSchema),
  applicationController.releaseApplication
);
router.patch(
  "/:id/complete",
  authenticate,
  staffOrAbove,
  validateBody(remarksSchema),
  applicationController.completeApplication
);

export default router;
