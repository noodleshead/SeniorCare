import mongoose from "mongoose";
import {
  ANNOUNCEMENT_CATEGORY,
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_SCOPE,
  TARGET_AUDIENCE,
} from "../utils/constants.js";

// Staff/Admin/LGU-OSCA managed notices shown to the appropriate
// audience. Visibility is enforced entirely server-side in
// announcement.service.js — this schema only stores the targeting
// data, never a computed "visible to" list.
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },

    category: {
      type: String,
      enum: Object.values(ANNOUNCEMENT_CATEGORY),
      default: ANNOUNCEMENT_CATEGORY.GENERAL,
    },

    status: {
      type: String,
      enum: Object.values(ANNOUNCEMENT_STATUS),
      default: ANNOUNCEMENT_STATUS.DRAFT,
      index: true,
    },

    // Who should see this once published (subject to barangay scope
    // below — ALL/SENIOR_CITIZEN/GUARDIAN are still barangay-scoped
    // unless scope is SYSTEM_WIDE).
    targetAudience: {
      type: String,
      enum: Object.values(TARGET_AUDIENCE),
      required: true,
      default: TARGET_AUDIENCE.ALL,
    },

    // SYSTEM_WIDE = every barangay (subject to targetAudience).
    // BARANGAY = only the barangay(s) listed in barangayIds — mirrors
    // BenefitProgram's barangayIds convention.
    scope: {
      type: String,
      enum: Object.values(ANNOUNCEMENT_SCOPE),
      required: true,
      default: ANNOUNCEMENT_SCOPE.SYSTEM_WIDE,
    },
    barangayIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Barangay" }],
      default: [],
    },

    isImportant: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishedAt: -1 });
announcementSchema.index({ category: 1 });
announcementSchema.index({ scope: 1, barangayIds: 1 });
announcementSchema.index({ title: "text", content: "text" });

export default mongoose.model("Announcement", announcementSchema);
