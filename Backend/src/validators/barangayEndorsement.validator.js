import { z } from "zod";
import { BARANGAY_VERIFICATION_STATUS, HOME_VISIT_RESULT, BARANGAY_ENDORSEMENT_DECISION } from "../utils/constants.js";

// All business-rule conditionality (remarks required for Reject/Revision,
// findings required, follow-up remarks required when follow-up is
// checked, Home-Visit-must-be-completed-before-endorsement) is enforced
// with full record context in barangayEndorsement.service.js — these
// schemas only guarantee types/shape and block any unrelated/forged key
// via .strict(), the same split used by medicalVerification.validator.js.

export const barangayVerificationDecisionSchema = z
  .object({
    decision: z.enum(Object.values(BARANGAY_VERIFICATION_STATUS), {
      errorMap: () => ({ message: "Please select a valid verification decision." }),
    }),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict();

export const homeVisitRecordSchema = z
  .object({
    result: z.enum(Object.values(HOME_VISIT_RESULT), { errorMap: () => ({ message: "Please select a valid visit result." }) }),
    findings: z.string().trim().min(1, "Please record your findings from the visit.").max(2000),
    followUpRequired: z.boolean().optional().default(false),
    followUpRemarks: z.string().trim().max(1000).optional(),
    visitDate: z.string().optional(),
  })
  .strict();

export const barangayEndorsementDecisionSchema = z
  .object({
    decision: z.enum(Object.values(BARANGAY_ENDORSEMENT_DECISION), { errorMap: () => ({ message: "Please select a valid endorsement decision." }) }),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict();
