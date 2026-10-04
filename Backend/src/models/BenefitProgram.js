import mongoose from "mongoose";
import { BENEFIT_CATEGORY, BENEFIT_STATUS, DOCUMENT_TYPES } from "../utils/constants.js";

// Authorized Staff/Admin manage these records — the frontend never
// hardcodes "Octogenarian"/"Nonagenarian"/etc. as fixed options; those
// are just BenefitProgram documents with `category: AGE_BASED` and a
// `minAge`. Adding a new assistance program later is a data change,
// not a code change.
const benefitProgramSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, default: "", maxlength: 2000 },
    category: { type: String, enum: Object.values(BENEFIT_CATEGORY), required: true },

    // Eligibility criteria — all optional; only the ones a program
    // actually needs are set. `null` means "no restriction on this axis".
    minAge: { type: Number, min: 0, default: null },
    maxAge: { type: Number, min: 0, default: null },
    requiresBedridden: { type: Boolean, default: null }, // null = no requirement either way

    amount: { type: Number, min: 0, default: null }, // financial assistance value, if applicable

    requiredDocumentTypes: {
      type: [{ type: String, enum: Object.values(DOCUMENT_TYPES) }],
      default: [],
    },

    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Empty array = available to every Barangay. Non-empty = only the
    // listed Barangays. Mirrors PensionSchedule's per-barangay model
    // rather than inventing a second scoping concept.
    barangayIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Barangay" }],
      default: [],
    },

    status: { type: String, enum: Object.values(BENEFIT_STATUS), default: BENEFIT_STATUS.ACTIVE },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

benefitProgramSchema.index({ status: 1 });
benefitProgramSchema.index({ category: 1 });

export default mongoose.model("BenefitProgram", benefitProgramSchema);
