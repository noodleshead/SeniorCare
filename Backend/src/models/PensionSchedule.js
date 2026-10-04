import mongoose from "mongoose";
import { SCHEDULE_STATUS } from "../utils/constants.js";

// Slots live as subdocuments of their Schedule (not a separate top-level
// collection). This lets a single-document `findOneAndUpdate` atomically
// check-and-decrement `availableCount` for one slot, which is how double
// booking / overbooking is prevented under concurrent requests — MongoDB
// guarantees a single document write is atomic even when it targets a
// nested array element via the positional operator, so no explicit
// transaction/lock is needed just to reserve a seat. (A transaction is
// still used where the slot reservation and the PensionClaim creation
// must succeed or fail together — see pensionClaim.service.js.)
const claimingSlotSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true, trim: true }, // "08:00 AM"
    endTime: { type: String, required: true, trim: true }, // "08:30 AM"
    capacity: { type: Number, required: true, min: 1 },
    bookedCount: { type: Number, required: true, default: 0, min: 0 },
    availableCount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["AVAILABLE", "FULL", "CLOSED"], default: "AVAILABLE" },
  },
  { timestamps: true }
);

const pensionScheduleSchema = new mongoose.Schema(
  {
    barangayId: { type: mongoose.Schema.Types.ObjectId, ref: "Barangay", required: true, index: true },
    date: { type: Date, required: true },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(SCHEDULE_STATUS), default: SCHEDULE_STATUS.OPEN },
    slots: { type: [claimingSlotSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

pensionScheduleSchema.index({ barangayId: 1, date: 1 });

export default mongoose.model("PensionSchedule", pensionScheduleSchema);
