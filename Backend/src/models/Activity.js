import mongoose from "mongoose";
import { ACTIVITY_STATUS, ACTIVITY_CATEGORY } from "../utils/constants.js";

// A Social Activity is a physical, scheduled event at one Barangay —
// unlike Announcement's multi-barangay broadcast scope, it deliberately
// has a single `barangayId`, matching PensionSchedule's convention
// (date/startTime/endTime as display strings, one Barangay per
// document). LGU/OSCA can still create activities for any Barangay;
// there is simply no "system-wide" activity concept, because an event
// only ever happens in one physical place.
const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: {
      type: String,
      enum: Object.values(ACTIVITY_CATEGORY),
      default: ACTIVITY_CATEGORY.GENERAL,
    },

    barangayId: { type: mongoose.Schema.Types.ObjectId, ref: "Barangay", required: true, index: true },

    date: { type: Date, required: true },
    startTime: { type: String, required: true, trim: true }, // "09:00 AM" — same display convention as PensionSchedule
    endTime: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true, maxlength: 200 },

    // Simple expected-audience blurb (e.g. "Open to all senior citizens
    // in the barangay, priority seating for PWDs") — not a structured
    // roster. Real per-senior attendance is the separate
    // ActivityAttendance collection (mirrors PensionSchedule/PensionClaim).
    participantInfo: { type: String, trim: true, maxlength: 1000, default: "" },

    attendanceConfirmationEnabled: { type: Boolean, default: false },

    status: {
      type: String,
      enum: Object.values(ACTIVITY_STATUS),
      default: ACTIVITY_STATUS.DRAFT,
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    publishedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

activitySchema.index({ barangayId: 1, date: 1 });
activitySchema.index({ status: 1, date: 1 });
activitySchema.index({ title: "text", description: "text" });

export default mongoose.model("Activity", activitySchema);
