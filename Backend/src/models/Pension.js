import mongoose from "mongoose";
import { PENSION_TYPES, PENSION_FREQUENCY, PENSION_STATUS } from "../utils/constants.js";

// Deliberately does NOT duplicate Senior identity fields (name, DOB,
// address, etc.) — `seniorId` is the only link back to the Senior, whose
// profile remains the single source of truth. Retrieval code populates
// what it needs from Senior at read time.
const pensionSchema = new mongoose.Schema(
  {
    seniorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Senior",
      required: true,
      unique: true, // one pension record per Senior
    },
    // Denormalized on write only (never trusted from the client on read):
    // lets pension queries be scoped to a Barangay via a plain, indexed
    // field instead of an extra Senior lookup on every list/filter call.
    // Always set from `senior.barangayId` server-side, never from the
    // request body.
    barangayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      required: true,
      index: true,
    },

    pensionType: { type: String, enum: Object.values(PENSION_TYPES), required: true },
    pensionProvider: { type: String, trim: true, maxlength: 150, default: "" },
    pensionAmount: { type: Number, required: true, min: 0 },
    frequency: { type: String, enum: Object.values(PENSION_FREQUENCY), required: true },
    status: { type: String, enum: Object.values(PENSION_STATUS), default: PENSION_STATUS.ACTIVE },
    effectiveDate: { type: Date, required: true },

    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

pensionSchema.index({ barangayId: 1, status: 1 });

export default mongoose.model("Pension", pensionSchema);
