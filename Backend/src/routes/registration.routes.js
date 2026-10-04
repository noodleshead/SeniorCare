import { Router } from "express";
import * as registrationController from "../controllers/registration.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { registrationSchema } from "../validators/registration.validator.js";
import { upload } from "../middleware/upload.middleware.js";
import { ValidationError } from "../utils/errors.js";

const router = Router();

const uploadFields = upload.fields([
  { name: "validId", maxCount: 1 },
  { name: "seniorCitizenId", maxCount: 1 },
  { name: "proofResidency", maxCount: 1 },
  { name: "guardianId", maxCount: 1 },
  { name: "guardianAuthDoc", maxCount: 1 },
  { name: "medicalDocument", maxCount: 1 },
]);

// The frontend sends multipart/form-data: file fields as above, plus a
// single `data` field containing the JSON-encoded registration payload
// (barangay, personal, contact, status, guardian, account). This parses
// that field into req.body so the existing Zod validator can run unchanged.
function parseJsonDataField(req, _res, next) {
  if (typeof req.body?.data !== "string") {
    return next(new ValidationError("Missing registration data."));
  }
  try {
    req.body = JSON.parse(req.body.data);
    next();
  } catch {
    next(new ValidationError("Registration data could not be read. Please try again."));
  }
}

router.get("/barangays", registrationController.getBarangays);
router.get("/illnesses", registrationController.getIllnesses);

router.post(
  "/",
  uploadFields,
  parseJsonDataField,
  validateBody(registrationSchema),
  (req, res, next) => {
    // Documents required at the schema level are enforced here rather than
    // in Zod, since they arrive as multer files, not JSON.
    const files = req.files || {};
    const missing = [];
    if (!files.validId?.[0]) missing.push("Valid Identification");
    if (!files.seniorCitizenId?.[0]) missing.push("Senior Citizen ID");
    if (!files.proofResidency?.[0]) missing.push("Proof of Residency");
    if (req.validatedBody.guardian?.hasGuardian && !files.guardianAuthDoc?.[0]) {
      missing.push("Guardian Authorization Document");
    }
    // Backend-enforced medical rule: declaring a condition requires both
    // an illness (checked by the Zod schema) and a supporting document.
    // Declaring none never requires one.
    if (req.validatedBody.medical?.hasMedicalCondition && !files.medicalDocument?.[0]) {
      return next(
        new ValidationError("Medical condition requires an illness and supporting medical document.", {
          medicalDocument: "Please upload a supporting medical document.",
        })
      );
    }
    if (missing.length) {
      return next(new ValidationError("Please upload all required documents.", { documents: missing }));
    }
    next();
  },
  registrationController.register
);

export default router;
