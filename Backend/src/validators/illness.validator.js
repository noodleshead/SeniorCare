import { z } from "zod";
import { ILLNESS_CLASSIFICATION, ILLNESS_PRIORITY } from "../utils/constants.js";
import { isValidAddressLine } from "../utils/textValidation.js";

/**
 * Admin Illness Database validators. Reuses textValidation.js's
 * `isValidAddressLine` check (deliberately the permissive one, not the
 * stricter person-name check) for the illness name: medical terminology
 * legitimately contains digits, abbreviations, and punctuation ("Type 2
 * Diabetes", "COPD", "Stage III–IV Cancer"), so this only rejects
 * single-character/no-letter/placeholder-junk input — it does not
 * validate against any medical reference, per this module's own
 * "do not use overly aggressive validation" instruction.
 *
 * classification/priorityLevel are closed enums — z.enum with no
 * catch-all — so "SOMETHING_RANDOM" / "URGENT" are rejected outright
 * (Test 9 / Test 10 in the module's own test plan), never silently
 * coerced to a default.
 */
const illnessName = z
  .string()
  .trim()
  .min(1, "Please enter the medical condition name.")
  .max(150)
  .refine(isValidAddressLine, "Please enter a valid medical condition name.");

export const createIllnessSchema = z
  .object({
    name: illnessName,
    classification: z.enum(Object.values(ILLNESS_CLASSIFICATION), {
      errorMap: () => ({ message: "Classification must be Critical or Non-Critical." }),
    }),
    priorityLevel: z.enum(Object.values(ILLNESS_PRIORITY), {
      errorMap: () => ({ message: "Priority must be High or Normal." }),
    }),
    // Defaults to active on creation, per module requirement §7 — but a
    // caller may still explicitly create one as inactive if they choose.
    isActive: z.boolean().optional().default(true),
  })
  .strict();

// Edit — same fields, all optional (a PATCH may touch only some of
// them), still strict (no role/status/classification-adjacent fields
// from any other domain can ride along).
export const updateIllnessSchema = z
  .object({
    name: illnessName.optional(),
    classification: z.enum(Object.values(ILLNESS_CLASSIFICATION)).optional(),
    priorityLevel: z.enum(Object.values(ILLNESS_PRIORITY)).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Please provide at least one field to update.");

export const updateIllnessStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();
