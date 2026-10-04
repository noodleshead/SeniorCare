import { z } from "zod";
import mongoose from "mongoose";
import { SEX, CIVIL_STATUS, RELATIONSHIP_TYPES } from "../utils/constants.js";
import { isValidPersonName, isValidAddressLine } from "../utils/textValidation.js";

const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), {
  message: "Invalid identifier.",
});

// Philippine mobile number — shared by the Senior's own mobileNumber
// (already validated this way below) and the Guardian's, which
// previously had no format check at all (only a "must be present"
// check in guardianSchema's superRefine) — a real gap the professor's
// "complete number of digits" feedback specifically called out.
const phMobileRegex = /^(\+?63|0)?9\d{9}$/;

const personName = (label) =>
  z
    .string()
    .trim()
    .max(100)
    .refine(isValidPersonName, `Please enter a valid ${label}.`);

const addressLine = (label) =>
  z
    .string()
    .trim()
    .max(200)
    .refine(isValidAddressLine, `Please enter a valid ${label}.`);

const addressSchema = z.object({
  // House/Lot/Block, Province, and Postal Code were previously
  // `.optional().default("")` — meaning an empty submission passed
  // validation outright. That was the actual bug behind "registration
  // can be submitted with missing address information": the Mongoose
  // schema already defaulted these to "" too (see models/Senior.js),
  // so nothing downstream ever caught it. All are now required, exactly
  // like Street and Municipality already were.
  houseLotBlock: addressLine("House / Lot / Block"),
  street: addressLine("Street / Sitio / Purok"),
  sitio: z.string().trim().max(200).optional().default(""),
  purok: z.string().trim().max(200).optional().default(""),
  municipality: addressLine("Municipality / City"),
  province: addressLine("Province"),
  // Philippine ZIP/postal codes are exactly 4 digits — a real, defined
  // format (unlike Senior Citizen ID, which has no fixed format in this
  // system; see the comment on seniorCitizenId below).
  postalCode: z.string().trim().regex(/^\d{4}$/, "Postal code must be exactly 4 digits."),
});

const guardianSchema = z
  .object({
    hasGuardian: z.boolean(),
    firstName: personName("first name").optional(),
    lastName: personName("last name").optional(),
    middleName: z.string().trim().max(100).optional().default(""),
    suffix: z.string().trim().max(10).optional().default(""),
    relationship: z.nativeEnum(RELATIONSHIP_TYPES).optional(),
    // Same Philippine mobile format as the Senior's own mobileNumber
    // below — previously guardianSchema only checked "is it present",
    // never "is it a valid/complete number" (a real gap the professor's
    // digit-completeness feedback specifically called out).
    mobileNumber: z.string().trim().regex(phMobileRegex, "Please enter a valid Philippine mobile number.").optional(),
    // Required (not just optional/valid-if-present) whenever hasGuardian
    // is true — this email becomes the Guardian's own login username, so
    // registration cannot create a Guardian account without one. See the
    // superRefine below.
    email: z.string().trim().toLowerCase().email().optional().or(z.literal("")).default(""),
    address: z.string().trim().max(300).optional().default(""),
    idType: z.string().trim().max(100).optional().default(""),
    idNumber: z.string().trim().max(100).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (!data.hasGuardian) return;
    if (!data.firstName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter a valid Guardian first name.", path: ["firstName"] });
    }
    if (!data.lastName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter a valid Guardian last name.", path: ["lastName"] });
    }
    if (!data.relationship) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Guardian relationship is required.", path: ["relationship"] });
    }
    if (!data.mobileNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter a valid Guardian mobile number.", path: ["mobileNumber"] });
    }
    // A Guardian/Authorized Representative account is created during
    // registration (see registration.service.js), and that account's
    // login username is this email — so it can no longer be optional
    // once a Guardian is being registered.
    if (!data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An email address is required to create the Guardian's login account.",
        path: ["email"],
      });
    }
  });

// Declared medical condition. Only these two client-controlled values
// exist: whether there is one, and which illness. Verification status,
// classification, and priority are never read from the request — zod's
// default object handling strips any such key, and registration.service.js
// sets the protected values itself. Older clients that omit `medical`
// entirely are treated as "no medical condition".
const medicalSchema = z
  .object({
    hasMedicalCondition: z.boolean({ invalid_type_error: "Please answer whether you have a medical condition." }),
    illnessId: objectId.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasMedicalCondition && !data.illnessId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select your medical condition.",
        path: ["illnessId"],
      });
    }
  })
  .transform((data) => ({
    hasMedicalCondition: data.hasMedicalCondition,
    // "No" never carries an illness, even if a stale one was sent.
    illnessId: data.hasMedicalCondition ? data.illnessId : undefined,
  }));

export const registrationSchema = z.object({
  barangayId: objectId,

  firstName: personName("first name"),
  middleName: z.string().trim().max(100).optional().default(""),
  lastName: personName("last name"),
  suffix: z.string().trim().max(10).optional().default(""),

  dateOfBirth: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Please provide a valid date of birth.")
    .refine((v) => new Date(v).getTime() <= Date.now(), "Date of birth cannot be in the future."),

  sex: z.nativeEnum(SEX, { errorMap: () => ({ message: "Please select a valid sex." }) }),
  civilStatus: z.nativeEnum(CIVIL_STATUS, { errorMap: () => ({ message: "Please select a valid civil status." }) }),

  // Deliberately NOT given a fixed digit-length/regex format: unlike
  // postal codes or PH mobile numbers, this system has no single
  // canonical Senior Citizen ID format to validate against (OSCA ID
  // formats vary by locality, and the registration UI itself only asks
  // for this "if you already have one" — see Register.jsx). Enforcing
  // an invented length here would reject legitimate IDs. It still gets
  // the same junk-value protection as any other free-text field when
  // non-empty (rejects "!!!", "test", a single stray character, etc.),
  // and its *uniqueness* is enforced separately — see registration.service.js
  // and models/Senior.js's unique+sparse index.
  seniorCitizenId: z
    .string()
    .trim()
    .max(50)
    .optional()
    .default("")
    .refine((v) => !v || isValidAddressLine(v), "Please enter a valid Senior Citizen ID."),

  mobileNumber: z
    .string()
    .trim()
    .regex(phMobileRegex, "Please enter a valid Philippine mobile number."),
  email: z.string().trim().email("Please enter a valid email address.").optional().or(z.literal("")).default(""),

  address: addressSchema,

  bedridden: z.boolean({ invalid_type_error: "Bedridden status must be true or false." }),

  guardian: guardianSchema.optional(),

  medical: medicalSchema.optional().default({ hasMedicalCondition: false }),

  accountEmail: z.string().trim().email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/\d/, "Password must contain at least one number."),
});
