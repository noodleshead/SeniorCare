import crypto from "node:crypto";
import bcrypt from "bcryptjs";

// bcrypt cost factor. 12 is a reasonable balance of security vs. latency
// for an interactive login endpoint as of 2026 hardware.
const SALT_ROUNDS = 12;

/**
 * Generates a secure random temporary password for a newly-provisioned
 * account (Barangay Staff, or a Guardian account created either during
 * Senior Registration or via the Admin recovery flow) when nobody
 * supplies one directly. Guaranteed to satisfy isPasswordStrongEnough
 * below (8+ chars, uppercase, number). Kept as the single shared
 * implementation so every account-creation path issues temporary
 * passwords the same way.
 */
export function generateTemporaryPassword() {
  const raw = crypto.randomBytes(9).toString("base64url"); // ~12 chars, mixed case
  return `Sc${raw}1`; // prefix/suffix guarantee an uppercase letter + a digit
}

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

// Server-side password policy — mirrors (but does not trust) the
// frontend's displayed requirements.
export function isPasswordStrongEnough(plainPassword) {
  if (typeof plainPassword !== "string") return false;
  if (plainPassword.length < 8) return false;
  if (!/[A-Z]/.test(plainPassword)) return false;
  if (!/\d/.test(plainPassword)) return false;
  return true;
}
