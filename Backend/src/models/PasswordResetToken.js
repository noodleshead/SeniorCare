import mongoose from "mongoose";

/**
 * Replaces auth.service.js's previous in-memory `resetTokenStore` Map.
 * That placeholder was explicitly labeled "replace before shipping to
 * production" — and was the actual reliability bug behind the
 * professor's "Forgot Password is not working" report: any server
 * restart (routine in dev with a file watcher, and unavoidable in any
 * multi-instance/serverless deployment) silently discarded every
 * outstanding reset token, so a user who requested a reset and then
 * came back even a minute later — after a routine redeploy — would
 * find their link simply didn't work, with no error to explain why.
 *
 * Only a SHA-256 hash of the token is ever stored (never the raw
 * token itself) — same principle as password hashing: if this
 * collection were ever exposed, no one could reconstruct a usable
 * reset link from it. The raw token only ever exists in memory for the
 * single request that generates it (see auth.service.js#requestPasswordReset).
 */
const passwordResetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// TTL index — expired tokens (used or not) are automatically removed by
// MongoDB itself roughly 1 hour after expiry, so this collection never
// accumulates stale reset tokens indefinitely. This is cleanup only;
// resetPassword() still explicitly checks `expiresAt` and `used` itself
// rather than relying on the TTL sweep's timing.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model("PasswordResetToken", passwordResetTokenSchema);
