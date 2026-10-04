import mongoose from "mongoose";
import { CLAIM_STATUS } from "../utils/constants.js";

// A claim represents one Senior's booking of one slot on one schedule.
// `qrToken` is a server-generated, unguessable random string (see
// pensionClaim.service.js) — never anything derived from or containing
// personal data, and never something the frontend can set. The database
// is always the source of truth when a QR is scanned: the token is
// looked up here, not decoded/trusted client-side.
const pensionClaimSchema = new mongoose.Schema(
  {
    seniorId: { type: mongoose.Schema.Types.ObjectId, ref: "Senior", required: true, index: true },
    pensionId: { type: mongoose.Schema.Types.ObjectId, ref: "Pension", required: true },
    barangayId: { type: mongoose.Schema.Types.ObjectId, ref: "Barangay", required: true, index: true },
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "PensionSchedule", required: true },
    slotId: { type: mongoose.Schema.Types.ObjectId, required: true },

    scheduledDate: { type: Date, required: true },
    scheduledStartTime: { type: String, required: true },
    scheduledEndTime: { type: String, required: true },
    location: { type: String, required: true },

    // Snapshot of the pension amount at claim time, for claiming-history
    // display — pension amounts can change later without rewriting history.
    amount: { type: Number, required: true, min: 0 },

    status: { type: String, enum: Object.values(CLAIM_STATUS), default: CLAIM_STATUS.SCHEDULED, index: true },

    qrToken: { type: String, required: true, unique: true, index: true },

    claimedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Set when a Senior cancels their own upcoming booking (see
    // pensionClaim.service.js#cancelClaim). Mirrors the claimedAt/verifiedBy
    // pattern above rather than introducing a separate audit collection.
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Set when the claiming window passes without the claim being
    // claimed (see utils/claimWindow.js#sweepMissedClaims).
    missedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A Senior may only have one *active* (SCHEDULED) booking per schedule.
// Enforced here as a DB-level constraint — not just an application-level
// check — so it holds even under concurrent requests. Cancelled/claimed/
// missed claims are excluded so a Senior can be re-booked into the same
// schedule after cancelling, or have independent history entries.
pensionClaimSchema.index(
  { seniorId: 1, scheduleId: 1 },
  { unique: true, partialFilterExpression: { status: CLAIM_STATUS.SCHEDULED } }
);

export default mongoose.model("PensionClaim", pensionClaimSchema);
