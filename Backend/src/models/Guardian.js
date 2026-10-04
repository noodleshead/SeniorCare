import mongoose from "mongoose";
import { RELATIONSHIP_TYPES } from "../utils/constants.js";

// Kept separate from Senior so that "someone is listed as a guardian"
// is clearly distinct from "someone has verified authorization" —
// authorization is only established via the Verification + Document
// workflow, never by this record alone.

const guardianSchema = new mongoose.Schema(
  {
    seniorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Senior",
      required: true,
      index: true,
    },

    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    middleName: { type: String, trim: true, maxlength: 100, default: "" },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    suffix: { type: String, trim: true, maxlength: 10, default: "" },

    relationship: {
      type: String,
      enum: Object.values(RELATIONSHIP_TYPES),
      required: true,
    },

    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },

    idType: { type: String, trim: true, default: "" },
    idNumber: { type: String, trim: true, default: "" },

    // True only once the barangay has reviewed and approved the
    // authorization documents as part of the verification workflow.
    authorizationConfirmed: { type: Boolean, default: false },

    // If this guardian also has their own SENIORCARE login account.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

guardianSchema.index({ seniorId: 1 });

export default mongoose.model("Guardian", guardianSchema);
