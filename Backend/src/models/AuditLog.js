import mongoose from "mongoose";

/**
 * Historical record of important, security-sensitive, or state-changing
 * actions performed by an authenticated user. Records are created
 * exclusively by services/auditLog.service.js#createAuditLog, called
 * from existing business-logic services after their own writes commit —
 * never from the frontend, and never manually via a normal CRUD route
 * (see routes/auditLog.routes.js: no POST/PUT/PATCH/DELETE is exposed).
 *
 * Deliberately NOT `timestamps: true` with updatedAt — audit records are
 * immutable historical facts, they are never subsequently updated, so
 * only `createdAt` (the moment the action happened) is meaningful. Uses
 * an explicit `createdAt` field instead, matching that intent exactly.
 */
const auditLogSchema = new mongoose.Schema({
  // Who. Kept as a plain reference (not populated eagerly on every
  // write) — the actor's identity/role at the time of the action is
  // also captured directly below, since a User's role or even existence
  // can change/be removed later and the historical record must still
  // read correctly.
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actorRole: { type: String, required: true, index: true }, // snapshot of ROLES.* at action time — see utils/constants.js
  actorEmail: { type: String, required: true, trim: true }, // snapshot — a later email change must not rewrite history

  // What.
  action: { type: String, required: true, trim: true, index: true }, // see AUDIT_ACTIONS in auditLog.service.js
  module: { type: String, required: true, trim: true, index: true }, // see AUDIT_MODULES in auditLog.service.js
  entityType: { type: String, trim: true, default: null },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  description: { type: String, required: true, trim: true, maxlength: 500 },

  // Non-sensitive contextual detail only — see the forbidden-key
  // stripping in auditLog.service.js#createAuditLog. Prefer IDs and
  // status transitions over copying record contents.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Optional context, only ever populated when reliably available.
  barangayId: { type: mongoose.Schema.Types.ObjectId, ref: "Barangay", default: null, index: true },
  ipAddress: { type: String, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound indexes for the Admin Audit Logs page's most common filter
// combinations (module + newest-first, and entity history lookups) —
// kept to just these two beyond the single-field indexes above, per the
// "do not add excessive indexes without reason" guidance.
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
