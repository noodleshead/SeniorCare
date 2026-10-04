import mongoose from "mongoose";

// A Senior's optional attendance confirmation for one Activity.
// A separate collection — mirroring PensionSchedule/PensionClaim's split
// between "the event" and "who's coming" — rather than an embedded
// array on Activity, so confirming/withdrawing is a single small write
// with no risk of two concurrent confirmations racing on the same
// parent document.
//
// The compound unique index below is the actual duplicate-prevention
// mechanism (not just an application-level check): a Senior can have at
// most one attendance record per Activity, enforced at the database
// level exactly like Notification's idempotency index.
const activityAttendanceSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: "Activity", required: true, index: true },
    seniorId: { type: mongoose.Schema.Types.ObjectId, ref: "Senior", required: true },
    // Who actually performed the confirmation — the Senior themselves,
    // or (once reachable) an authorized Guardian acting for them.
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

activityAttendanceSchema.index({ activityId: 1, seniorId: 1 }, { unique: true });

export default mongoose.model("ActivityAttendance", activityAttendanceSchema);
