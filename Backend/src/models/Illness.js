import mongoose from "mongoose";
import { ILLNESS_CLASSIFICATION, ILLNESS_PRIORITY } from "../utils/constants.js";

/**
 * Illness/medical-condition catalog. Extended in Phase 4 with
 * classification/priority for the Admin Illness Database — the same
 * model Phase 3 already uses for the registration dropdown, not a
 * duplicate. `classification`/`priorityLevel` are internal
 * administrative data: Senior/Guardian-facing responses (the public
 * registration list, and Senior/Guardian profile endpoints) must never
 * select or return them — see registration.service.js#listActiveIllnesses,
 * which explicitly `.select("name")` only, unchanged by this phase.
 *
 * `classification`/`priorityLevel` are nullable rather than required:
 * Phase 3's seeded records predate Phase 4 and were never classified by
 * any rule this system actually has, so backfilling a value here would
 * be inventing a medical judgment. `needsConfiguration` (see the virtual
 * below) is how the Admin UI surfaces "this one hasn't been classified
 * yet" instead of silently defaulting to something.
 */
const illnessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    // Case-insensitive duplicate check key (Admin Illness Database §8)
    // — kept alongside `name` rather than lower-casing `name` itself, so
    // the display casing an Admin typed ("Diabetes Mellitus") is
    // preserved while "diabetes mellitus" still collides with it.
    normalizedName: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
    classification: { type: String, enum: [...Object.values(ILLNESS_CLASSIFICATION), null], default: null },
    priorityLevel: { type: String, enum: [...Object.values(ILLNESS_PRIORITY), null], default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

illnessSchema.pre("validate", function normalizeName() {
  if (this.name) this.normalizedName = this.name.trim().toLowerCase();
});

// The actual duplicate-prevention constraint — unique on the normalized
// key, not the display name, so "Diabetes" and "diabetes" collide.
illnessSchema.index({ normalizedName: 1 }, { unique: true });

illnessSchema.virtual("needsConfiguration").get(function () {
  return this.classification == null || this.priorityLevel == null;
});
illnessSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Illness", illnessSchema);
