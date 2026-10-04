import mongoose from "mongoose";
import { NOTIFICATION_TYPE } from "../utils/constants.js";

// One notification per (recipientId, eventType, relatedEntityId) is
// enforced by the partial unique index below — this is the idempotency
// guard against duplicate notifications from retries, double-submits,
// or a status transition being re-run. `relatedEntityId` is required
// for the guard to apply; purely informational/system notifications
// with no related entity simply aren't deduplicated (there is nothing
// meaningful to dedupe on).
const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
    },

    // A specific machine-readable event key (e.g. "BENEFIT_APPROVED",
    // "PENSION_CLAIM_CLAIMED", "ANNOUNCEMENT_PUBLISHED") used only for
    // the idempotency guard and for grouping/filtering — display text
    // lives in title/message below.
    eventType: { type: String, required: true, trim: true },

    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },

    // Loosely-typed pointer to whatever triggered this notification
    // (a BenefitApplication, PensionClaim, Announcement, Verification,
    // Document, etc.) so the frontend can navigate to the right existing
    // page without a dedicated route per notification type.
    relatedEntityType: { type: String, default: null },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

// Idempotency guard — only applies when relatedEntityId is present.
notificationSchema.index(
  { recipientId: 1, eventType: 1, relatedEntityId: 1 },
  { unique: true, partialFilterExpression: { relatedEntityId: { $type: "objectId" } } }
);

export default mongoose.model("Notification", notificationSchema);
