import { z } from "zod";
import { isValidPersonName, isValidAddressLine } from "../utils/textValidation.js";

/**
 * Profile-editing validators. Reuses the exact same validation rules
 * Phase 1 built for registration (registration.validator.js) — per this
 * phase's own instruction not to create weaker validation for profile
 * editing than registration. Every field here is deliberately a subset
 * of what registration.validator.js accepts; nothing new is invented.
 *
 * Neither schema includes role/status/barangayId/verificationStatus/
 * userId — those are never even parseable from this schema, let alone
 * writable, which is the actual enforcement mechanism (not just "the
 * UI doesn't show a field for it").
 */

const phMobileRegex = /^(\+?63|0)?9\d{9}$/;

const personName = (label) =>
  z.string().trim().max(100).refine(isValidPersonName, `Please enter a valid ${label}.`);

const addressLine = (label) =>
  z.string().trim().max(200).refine(isValidAddressLine, `Please enter a valid ${label}.`);

export const updateSeniorProfileSchema = z
  .object({
    firstName: personName("first name"),
    middleName: z.string().trim().max(100).optional().default(""),
    lastName: personName("last name"),
    suffix: z.string().trim().max(10).optional().default(""),
    mobileNumber: z.string().trim().regex(phMobileRegex, "Please enter a valid Philippine mobile number."),
    bedridden: z.boolean().optional(),
    address: z.object({
      houseLotBlock: addressLine("House / Lot / Block"),
      street: addressLine("Street / Sitio / Purok"),
      sitio: z.string().trim().max(200).optional().default(""),
      purok: z.string().trim().max(200).optional().default(""),
      municipality: addressLine("Municipality / City"),
      province: addressLine("Province"),
      postalCode: z.string().trim().regex(/^\d{4}$/, "Postal code must be exactly 4 digits."),
    }),
  })
  .strict();

export const updateGuardianProfileSchema = z
  .object({
    firstName: personName("first name"),
    lastName: personName("last name"),
    mobileNumber: z.string().trim().regex(phMobileRegex, "Please enter a valid Philippine mobile number."),
    // Guardian's own address is a single free-text field in this system
    // (unlike Senior's structured address) — see models/Guardian.js.
    address: addressLine("address"),
  })
  .strict();

/**
 * Admin-side edit of a Senior's core profile — the self-service schema
 * above, plus seniorCitizenId. Per this phase's own instructions, Admin
 * (unlike the Senior themselves) may correct it, with the same
 * uniqueness rule Phase 1 already enforces at registration, plus an
 * audit trail — Admin already carries verification authority a Senior
 * does not. Still never includes role/status/barangayId/
 * verificationStatus/userId.
 */
export const adminUpdateSeniorProfileSchema = updateSeniorProfileSchema.extend({
  seniorCitizenId: z
    .string()
    .trim()
    .max(50)
    .optional()
    .default("")
    .refine((v) => !v || isValidAddressLine(v), "Please enter a valid Senior Citizen ID."),
});
