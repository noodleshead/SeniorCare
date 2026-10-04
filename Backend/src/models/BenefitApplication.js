import mongoose from "mongoose";
import { APPLICATION_STATUS } from "../utils/constants.js";

// One entry per status change. Kept embedded on the application itself
// (the same approach PensionClaim uses for claimedAt/cancelledAt, just
// generalized into a repeatable log since a benefit application passes
// through more stages) rather than a separate top-level audit
// collection — there is no existing generic audit model to reuse, and
// this keeps the full history available with the application in a
// single read.
const statusHistoryEntrySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, enum: Object.values(APPLICATION_STATUS), default: null },
    toStatus: { type: String, enum: Object.values(APPLICATION_STATUS), required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true },
    remarks: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const benefitApplicationSchema = new mongoose.Schema(
  {
    seniorId: { type: mongoose.Schema.Types.ObjectId, ref: "Senior", required: true, index: true },
    benefitProgramId: { type: mongoose.Schema.Types.ObjectId, ref: "BenefitProgram", required: true, index: true },

    // Snapshotted at application time, same rationale as PensionClaim's
    // barangayId — the Senior's barangay at the moment of applying is
    // what determines Staff scoping, independent of later profile edits.
    barangayId: { type: mongoose.Schema.Types.ObjectId, ref: "Barangay", required: true, index: true },

    // Who actually submitted this application: the Senior themselves,
    // or (once Guardian access is activated) their authorized Guardian's
    // own User account — never re-derived from the request body.
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appliedByRole: { type: String, required: true },

    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.SUBMITTED,
      index: true,
    },

    documentIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
      default: [],
    },

    // Review trail, set as the application progresses. Kept flat/simple
    // (mirrors Verification's reviewedBy/reviewedAt/remarks) alongside
    // the fuller statusHistory[] below for a quick "latest state" read.
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    remarks: { type: String, trim: true, default: "" },
    rejectionReason: { type: String, trim: true, default: "" },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },

    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    releasedAt: { type: Date, default: null },

    completedAt: { type: Date, default: null },

    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
  },
  { timestamps: true }
);

benefitApplicationSchema.index({ barangayId: 1, status: 1 });
benefitApplicationSchema.index({ seniorId: 1, benefitProgramId: 1 });

export default mongoose.model("BenefitApplication", benefitApplicationSchema);
