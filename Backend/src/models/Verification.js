import mongoose from "mongoose";
import { VERIFICATION_STATUS } from "../utils/constants.js";

const verificationSchema = new mongoose.Schema(
  {
    seniorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Senior",
      required: true,
      unique: true, // one active verification record per senior
      index: true,
    },
    barangayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      required: true,
      default: VERIFICATION_STATUS.PENDING,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },

    remarks: { type: String, trim: true, default: "" },
    rejectionReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

verificationSchema.index({ barangayId: 1, status: 1 });

export default mongoose.model("Verification", verificationSchema);
