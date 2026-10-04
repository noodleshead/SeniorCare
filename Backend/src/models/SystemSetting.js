import mongoose from "mongoose";

/**
 * SENIORCARE's global, system-wide configuration. A structured single
 * document (not per-key rows) — chosen over a generic key/value
 * collection because the whole configurable surface is small, fixed,
 * and naturally groups into a handful of typed sections; a document
 * lets Mongoose itself enforce types/defaults per field, and the whole
 * thing can be read in one query and cached as one object (see
 * services/systemSettings.service.js). `singleton` only ever has the
 * value `true`, so there is exactly one document — enforced by the
 * unique index below, not just by convention.
 *
 * Every section here is genuinely wired to real backend behavior (see
 * systemSettings.service.js's getters and their call sites) — this is
 * not a decorative config surface. Sections deliberately NOT present:
 * pension claiming rules (no configurable concept currently exists to
 * expose — claim windows are per-slot end times, not a global "days"
 * setting), benefit eligibility age thresholds, and password/session
 * policy (both would require changes to synchronous validators/JWT
 * signing that aren't safe to make dynamic without deeper rework) — see
 * the module's final report for the full reasoning.
 */
const systemSettingSchema = new mongoose.Schema(
  {
    singleton: { type: Boolean, default: true, unique: true },

    general: {
      systemName: { type: String, trim: true, maxlength: 100, default: "SENIORCARE" },
      systemDescription: {
        type: String,
        trim: true,
        maxlength: 300,
        default: "Barangay Senior Citizen Affairs Management System",
      },
      contactEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: "" },
      contactNumber: { type: String, trim: true, maxlength: 30, default: "" },
    },

    // A global gate enforced in auth.middleware.js: while ON, every
    // authenticated request from a non-ADMIN caller is rejected with a
    // 503 (see MaintenanceModeError). Administrator access is never
    // blocked, by construction — see systemSettings.service.js's
    // isMaintenanceModeOn() and the middleware's own role check.
    maintenanceMode: { type: Boolean, default: false },

    notifications: {
      // Gates Notification creation itself (notification.service.js#createNotification)
      // — when OFF, no new Notification documents are created at all,
      // system-wide, for any event. It does not delete or hide existing
      // notifications already delivered.
      enabled: { type: Boolean, default: true },
    },

    applications: {
      // Gates new benefit/assistance application submissions
      // (benefitApplication.service.js#applyForBenefit). Existing
      // applications already in the pipeline are unaffected — Staff can
      // still review/approve/reject/release them; only new submissions
      // are blocked while OFF.
      enabled: { type: Boolean, default: true },
    },

    registration: {
      // Gates new Senior registrations (registration.service.js#registerSenior).
      seniorRegistrationEnabled: { type: Boolean, default: true },
      // Gates the Guardian/Authorized Representative portion of a new
      // registration specifically — a Senior can still register without
      // a Guardian even while this is OFF (unless seniorRegistrationEnabled
      // is also OFF).
      guardianRegistrationEnabled: { type: Boolean, default: true },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("SystemSetting", systemSettingSchema);
