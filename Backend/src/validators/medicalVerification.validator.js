import { z } from "zod";
import { MEDICAL_VERIFICATION_STATUS, ILLNESS_CLASSIFICATION, ILLNESS_PRIORITY } from "../utils/constants.js";

/**
 * Deliberately loose at the schema level (mostly optional strings/
 * booleans) — the real, decision-dependent requirements (override
 * reason only when overriding, Home Visit fields only required for
 * Critical/High, remarks required for Reject/Revision) are conditional
 * on values the frontend controls, and are enforced with full context
 * in medicalVerification.service.js#recordMedicalVerificationDecision,
 * which is the actual security boundary (this schema only guarantees
 * *types*, never trusts the client to have already validated the
 * business rule). `.strict()` still blocks any unrelated/forged key —
 * there is no path from this schema to setting medicalVerifiedBy,
 * homeVisitDecidedBy, or anything else the service computes itself.
 */
export const medicalVerificationDecisionSchema = z
  .object({
    decision: z.enum([MEDICAL_VERIFICATION_STATUS.VERIFIED, MEDICAL_VERIFICATION_STATUS.REJECTED, MEDICAL_VERIFICATION_STATUS.REVISION_REQUIRED], {
      errorMap: () => ({ message: "Please select a valid verification decision." }),
    }),
    classification: z.enum(Object.values(ILLNESS_CLASSIFICATION)).optional(),
    priorityLevel: z.enum(Object.values(ILLNESS_PRIORITY)).optional(),
    overrideReason: z.string().trim().max(500).optional(),
    remarks: z.string().trim().max(1000).optional(),
    homeVisitRequired: z.boolean().optional(),
    homeVisitRemarks: z.string().trim().max(1000).optional(),
  })
  .strict();
