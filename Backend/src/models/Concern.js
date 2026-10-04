import mongoose from "mongoose";
import { CONCERN_STATUS, CONCERN_PRIORITY, CONCERN_URGENCY, CONCERN_CATEGORY } from "../utils/constants.js";

// A single Staff response to a concern. Embedded (not a separate
// collection) — responses are always read together with their parent
// concern and never queried independently, unlike ActivityAttendance.
const responseSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A single chronological entry in the concern's activity timeline (Part
// 8) — status changes, priority classification, and responses all log
// here, giving Staff/Senior a unified "Concern Activity" view without
// needing three separate structures. Also the minimal groundwork for a
// future Audit Logs module (Part 23) — nothing further is built now.
const activityLogEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["CREATED", "STATUS_CHANGE", "PRIORITY_SET", "RESPONSE"],
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const concernSchema = new mongoose.Schema(
  {
    // Always resolved server-side via resolveActingSenior at creation —
    // never a client-supplied id. See concern.service.js.
    seniorId: { type: mongoose.Schema.Types.ObjectId, ref: "Senior", required: true, index: true },
    // The User who actually submitted this (the Senior today; an
    // authorized Guardian once that role is reachable — see
    // utils/guardianAccess.js). Kept distinct from seniorId so a future
    // Guardian-submitted concern is representable without a schema change.
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Derived from the Senior's own barangayId at creation time, never
    // trusted from the client — mirrors Activity's single-barangayId
    // convention (a concern belongs to one barangay, the Senior's own).
    barangayId: { type: mongoose.Schema.Types.ObjectId, ref: "Barangay", required: true, index: true },

    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: {
      type: String,
      enum: Object.values(CONCERN_CATEGORY),
      default: CONCERN_CATEGORY.OTHER,
    },

    // The Senior's own, informational-only signal — never the final
    // classification. See CONCERN_URGENCY vs CONCERN_PRIORITY note in
    // utils/constants.js.
    reportedUrgency: {
      type: String,
      enum: Object.values(CONCERN_URGENCY),
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(CONCERN_STATUS),
      default: CONCERN_STATUS.NEW,
      index: true,
    },

    // Staff's official classification — null until Staff reviews and
    // sets it (see setPriority in concern.service.js). priorityReason is
    // Staff-internal context, not necessarily shown to the Senior.
    priority: { type: String, enum: Object.values(CONCERN_PRIORITY), default: null },
    priorityReason: { type: String, trim: true, maxlength: 1000, default: "" },
    priorityClassifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    priorityClassifiedAt: { type: Date, default: null },

    responses: { type: [responseSchema], default: [] },
    activityLog: { type: [activityLogEntrySchema], default: [] },

    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

concernSchema.index({ barangayId: 1, status: 1 });
concernSchema.index({ subject: "text", description: "text" });

export default mongoose.model("Concern", concernSchema);
