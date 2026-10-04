import { z } from "zod";
import { BENEFIT_CATEGORY, BENEFIT_STATUS, DOCUMENT_TYPES } from "../utils/constants.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id.");

export const createBenefitProgramSchema = z.object({
  name: z.string().trim().min(1, "Program name is required.").max(150),
  description: z.string().trim().max(2000).optional().default(""),
  category: z.enum(Object.values(BENEFIT_CATEGORY)),
  minAge: z.coerce.number().int().min(0).nullable().optional(),
  maxAge: z.coerce.number().int().min(0).nullable().optional(),
  requiresBedridden: z.coerce.boolean().nullable().optional(),
  amount: z.coerce.number().min(0).nullable().optional(),
  requiredDocumentTypes: z.array(z.enum(Object.values(DOCUMENT_TYPES))).optional().default([]),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  barangayIds: z.array(objectId).optional().default([]),
  status: z.enum(Object.values(BENEFIT_STATUS)).optional().default(BENEFIT_STATUS.ACTIVE),
});

export const updateBenefitProgramSchema = createBenefitProgramSchema.partial();

export const applyForBenefitSchema = z.object({
  benefitProgramId: objectId,
  // Parallel array to the uploaded `documents` files, one DOCUMENT_TYPES
  // value per file (by index) declaring which requirement it satisfies.
  documentTypes: z.array(z.enum(Object.values(DOCUMENT_TYPES))).optional().default([]),
});

export const remarksSchema = z.object({
  remarks: z.string().trim().max(1000).optional().default(""),
});

export const rejectApplicationSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required."),
});

// Phase 7 — remarks are mandatory here, unlike remarksSchema above
// (optional, used for approve/endorse where a remark is a nice-to-have).
export const requestRevisionSchema = z.object({
  remarks: z.string().trim().min(1, "Please explain what needs revision or clarification."),
});
