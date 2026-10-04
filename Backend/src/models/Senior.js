import mongoose from "mongoose";
import { SEX, CIVIL_STATUS, MEDICAL_VERIFICATION_STATUS, ILLNESS_CLASSIFICATION, ILLNESS_PRIORITY, HOME_VISIT_STATUS, BARANGAY_VERIFICATION_STATUS, HOME_VISIT_EXECUTION_STATUS, HOME_VISIT_RESULT, BARANGAY_ENDORSEMENT_DECISION } from "../utils/constants.js";

// Senior profile information only. Deliberately excludes pension amounts,
// pension/claiming history, assistance history, and application status —
// those belong to other SENIORCARE modules created after verification.

const addressSchema = new mongoose.Schema(
  {
    // Previously `default: ""` with no `required` — meaning a Senior
    // record could be saved with a blank House/Lot/Block, Province, or
    // Postal Code even if the Zod validator were ever bypassed
    // (registration.validator.js). Backend validation is the primary
    // guard, but the schema itself should not silently accept blanks
    // either — defense in depth, same principle as the unique index on
    // seniorCitizenId below.
    houseLotBlock: { type: String, trim: true, required: true },
    street: { type: String, trim: true, required: true },
    sitio: { type: String, trim: true, default: "" },
    purok: { type: String, trim: true, default: "" },
    municipality: { type: String, trim: true, required: true },
    province: { type: String, trim: true, required: true },
    postalCode: { type: String, trim: true, required: true },
  },
  { _id: false }
);

const seniorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    barangayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      required: true,
    },

    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    middleName: { type: String, trim: true, maxlength: 100, default: "" },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    suffix: { type: String, trim: true, maxlength: 10, default: "" },

    dateOfBirth: { type: Date, required: true },
    sex: { type: String, enum: Object.values(SEX), required: true },
    civilStatus: { type: String, enum: Object.values(CIVIL_STATUS), required: true },

    // Optional — a senior may not yet hold a physical ID at registration
    // time. Uniqueness is enforced by the sparse unique index below, not
    // by `unique: true` here — declaring both is a duplicate-index
    // definition (Mongoose logs a warning and, depending on version, can
    // create two overlapping indexes for the same effective constraint).
    // This was flagged in this project's own "previous bugs to avoid"
    // list; consolidated to the single explicit index only.
    seniorCitizenId: {
      type: String,
      trim: true,
    },

    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },

    address: { type: addressSchema, required: true },

    bedridden: { type: Boolean, required: true, default: false },

    // Declared medical condition (Phase 3). All defaulted so Senior
    // records created before this phase stay valid: hasMedicalCondition
    // reads false, the rest read null — no fake medical data is created
    // for existing Seniors. The supporting document is a Document with
    // documentType MEDICAL_SUPPORTING_DOCUMENT (linked by seniorId), not
    // duplicated here. Verification status is set by the server only —
    // PENDING at registration; the future Medical Verification phase
    // owns any further change. No classification/priority fields exist
    // yet on purpose (Phase 4).
    hasMedicalCondition: { type: Boolean, default: false },
    medicalConditionId: { type: mongoose.Schema.Types.ObjectId, ref: "Illness", default: null },
    medicalVerificationStatus: {
      type: String,
      enum: [...Object.values(MEDICAL_VERIFICATION_STATUS), null],
      default: null,
    },

    // Phase 5 — Admin Medical Verification outcome. Deliberately kept on
    // Senior rather than a separate collection: Phase 3/4 already put
    // every other medical field here (models/Illness.js's own
    // classification/priorityLevel is the *system-generated
    // recommendation*; these are the *Admin-confirmed-or-overridden
    // final values*, which is why they're named/stored separately
    // rather than overwriting the Illness record's own fields — the
    // Illness Database's classification must keep meaning "the default
    // for this condition", not "what one Admin decided for one Senior").
    //
    // Every field below is Admin-only data. senior.service.js#getMySeniorProfile
    // and guardian.service.js's summarizeSenior() never include these —
    // see their own comments. Only set via medicalVerification.service.js.
    medicalClassification: { type: String, enum: [...Object.values(ILLNESS_CLASSIFICATION), null], default: null },
    medicalPriorityLevel: { type: String, enum: [...Object.values(ILLNESS_PRIORITY), null], default: null },
    medicalVerificationRemarks: { type: String, trim: true, default: "" },
    medicalVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    medicalVerifiedAt: { type: Date, default: null },

    // Home Visit decision — Phase 5 only records the Admin's decision;
    // the actual visit workflow (scheduling, findings, endorsement) is
    // Phase 6 and does not exist yet. `homeVisitStatus` is what Phase 6
    // will query to find Seniors ready for its queue (REQUIRED).
    homeVisitStatus: {
      type: String,
      enum: [...Object.values(HOME_VISIT_STATUS), null],
      default: null,
    },
    homeVisitRemarks: { type: String, trim: true, default: "" },
    homeVisitDecidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    homeVisitDecidedAt: { type: Date, default: null },

    // Phase 6 — Barangay Verification, Home Visit execution, Endorsement.
    // A distinct, later stage from the account-activating registration
    // approval (models/Verification.js, untouched by this phase) and
    // from Phase 5's Admin medical decision above (never overwritten
    // here — see barangayEndorsement.service.js's own header comment).
    // Nested under one subdocument rather than ~18 flat fields, purely
    // for readability; still lives on Senior, not a new collection, per
    // this phase's own "do not duplicate across unrelated collections"
    // instruction. Nothing here is required — every Senior predating
    // Phase 6 reads with barangayReview entirely null/default, and nothing
    // forces it to be filled in (Step 17: existing Seniors must not break).
    barangayReview: {
      verificationStatus: {
        type: String,
        enum: [...Object.values(BARANGAY_VERIFICATION_STATUS), null],
        default: null,
      },
      verificationRemarks: { type: String, trim: true, default: "" },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      verifiedAt: { type: Date, default: null },

      homeVisit: {
        // Barangay's progress executing a visit Admin required — kept
        // separate from Senior.homeVisitStatus (Phase 5's Admin
        // decision) on purpose; this is "where Staff is in doing it",
        // not "whether one is needed".
        status: {
          type: String,
          enum: [...Object.values(HOME_VISIT_EXECUTION_STATUS), null],
          default: null,
        },
        visitDate: { type: Date, default: null },
        conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        result: { type: String, enum: [...Object.values(HOME_VISIT_RESULT), null], default: null },
        findings: { type: String, trim: true, default: "" },
        followUpRequired: { type: Boolean, default: false },
        followUpRemarks: { type: String, trim: true, default: "" },
        completedAt: { type: Date, default: null },
      },

      endorsement: {
        decision: {
          type: String,
          enum: [...Object.values(BARANGAY_ENDORSEMENT_DECISION), null],
          default: null,
        },
        remarks: { type: String, trim: true, default: "" },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        decidedAt: { type: Date, default: null },
      },

      // Set true only once ENDORSED — the explicit "ready for the next
      // phase" marker this module's own Step 11 asks for. Phase 7's
      // OSCA review reads this; nothing in this phase acts on it further.
      readyForOscaReview: { type: Boolean, default: false },
    },

    // Reference to an authorized guardian/representative, if provided.
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guardian",
      default: null,
    },
  },
  { timestamps: true }
);

seniorSchema.index({ userId: 1 }, { unique: true });
seniorSchema.index({ seniorCitizenId: 1 }, { unique: true, sparse: true });
seniorSchema.index({ barangayId: 1 });

// Virtual, server-computed age — never trust a client-supplied age.
seniorSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(this.dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
});

seniorSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Senior", seniorSchema);
