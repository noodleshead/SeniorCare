import crypto from "node:crypto";
import User from "../models/User.js";
import Senior from "../models/Senior.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import {
  verifyPassword,
  hashPassword,
  isPasswordStrongEnough,
} from "../utils/password.js";
import { signAccessToken, signRefreshToken } from "../utils/token.js";
import { ACCOUNT_STATUS, ROLES, AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { listAuthorizedSeniorsForGuardian } from "../utils/guardianAccess.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import {
  AuthenticationError,
  AccountStatusError,
  ValidationError,
  NotFoundError,
} from "../utils/errors.js";

export async function login({ emailOrUsername, password }, { ipAddress } = {}) {
  const normalized = emailOrUsername.trim().toLowerCase();

  const user = await User.findOne({
    $or: [{ email: normalized }, { username: normalized }],
  }).select("+passwordHash");

  // Generic message regardless of whether the account exists, to avoid
  // account enumeration.
  if (!user) {
    throw new AuthenticationError("Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthenticationError("Invalid email or password.");
  }

  if (user.status === ACCOUNT_STATUS.PENDING_VERIFICATION) {
    throw new AccountStatusError(
      "Your registration has been submitted successfully, but your barangay has not yet completed verification.",
      "ACCOUNT_PENDING_VERIFICATION",
    );
  }

  if (user.status === ACCOUNT_STATUS.INACTIVE) {
    throw new AccountStatusError(
      "Your SENIORCARE account is currently inactive. Please contact your barangay office for assistance.",
      "ACCOUNT_INACTIVE",
    );
  }

  if (user.status === ACCOUNT_STATUS.REJECTED) {
    throw new AccountStatusError(
      "Your registration was not approved. Please contact your barangay office for more information.",
      "ACCOUNT_REJECTED",
    );
  }

  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    // Defensive fallback for any future status value.
    throw new AccountStatusError(
      "Your account cannot access SENIORCARE at this time.",
      "ACCOUNT_NOT_ACTIVE",
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Fired only after the login itself has fully succeeded (password
  // verified, status checked, lastLoginAt already saved) — never allowed
  // to turn a successful login into a failed request (see
  // auditLog.service.js's error-handling rationale).
  await safeCreateAuditLog({
    actor: { id: user._id.toString(), role: user.role },
    actorEmail: user.email,
    action: AUDIT_ACTIONS.LOGIN,
    module: AUDIT_MODULES.AUTH,
    entityType: "User",
    entityId: user._id,
    description: `${user.role} logged in.`,
    metadata: ipAddress ? { ipAddress } : {},
  });

  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });
  const refreshToken = signRefreshToken({
    userId: user._id.toString(),
    tokenVersion: user.tokenVersion,
  });

  const responseUser = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    status: user.status,
  };

  // Senior Citizens have a 1:1 Senior profile keyed by userId. Returning
  // its id lets the frontend fetch/link the profile immediately after
  // login without a second lookup-by-email round trip. Only the id is
  // returned — never the full Senior document (address, documents, etc.)
  // — the JWT and login response both stay minimal per the existing
  // security convention in this file.
  if (user.role === ROLES.SENIOR_CITIZEN) {
    const senior = await Senior.findOne({ userId: user._id }).select("_id");
    if (senior) {
      responseUser.seniorId = senior._id.toString();
    }
  }

  // Barangay Staff are scoped to a single barangay for verification
  // review — the frontend needs this to know which barangay's queue to
  // show, and verification.service.js already relies on the same field.
  if (user.role === ROLES.BARANGAY_STAFF && user.assignedBarangayId) {
    responseUser.barangayId = user.assignedBarangayId.toString();
  }

  // Guardians may manage more than one Senior (see
  // utils/guardianAccess.js) — the frontend uses this list to decide
  // whether to auto-select a single managed Senior or show a switcher.
  // This is purely a UX convenience: every actual request still re-runs
  // the same authorization check server-side, so this list is never
  // itself trusted as a grant of access.
  if (user.role === ROLES.GUARDIAN) {
    const seniors = await listAuthorizedSeniorsForGuardian({ id: user._id.toString(), role: user.role });
    responseUser.managedSeniorIds = seniors.map((s) => s._id.toString());
  }

  return {
    accessToken,
    refreshToken,
    user: responseUser,
  };
}

export async function getAuthenticatedUser(userId) {
  const user = await User.findById(userId).populate("assignedBarangayId", "name municipality province");
  if (!user) throw new NotFoundError("Account not found.");

  const result = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    status: user.status,
  };

  // Same resolution login() already performs — repeated here so a page
  // refresh (which calls /api/auth/me, not /api/auth/login) still shows
  // the staff member which Barangay they're assigned to. The backend
  // resolves this from the authenticated user's own record; the client
  // never supplies a barangay id.
  if (user.role === ROLES.BARANGAY_STAFF && user.assignedBarangayId) {
    result.barangayId = user.assignedBarangayId._id.toString();
    result.barangayName = user.assignedBarangayId.name;
    result.barangayMunicipality = user.assignedBarangayId.municipality;
    result.barangayProvince = user.assignedBarangayId.province;
  }

  if (user.role === ROLES.SENIOR_CITIZEN) {
    const senior = await Senior.findOne({ userId: user._id }).select("_id");
    if (senior) {
      result.seniorId = senior._id.toString();
    }
  }

  if (user.role === ROLES.GUARDIAN) {
    const seniors = await listAuthorizedSeniorsForGuardian({ id: user._id.toString(), role: user.role });
    result.managedSeniorIds = seniors.map((s) => s._id.toString());
  }

  return result;
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  // Always behave the same way whether or not the account exists.
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes, single use

  // Persisted (previously an in-memory Map — see PasswordResetToken.js
  // for why that was the actual bug). Any previous outstanding token(s)
  // for this user are invalidated by simply not being looked up again —
  // resetPassword() always looks up by the specific token hash presented,
  // so an old token remains unusable once a newer one exists, but we
  // also proactively remove them so the collection doesn't accumulate
  // dead rows between requests.
  await PasswordResetToken.deleteMany({ userId: user._id, used: false });
  await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

  // In production, email `token` (as a link to the frontend's reset
  // page, e.g. `${CLIENT_URL}/reset-password?token=...`) to the user via
  // a transactional email service. No such service is configured
  // anywhere in this project (checked package.json and .env.example —
  // no nodemailer/SMTP/SendGrid setup exists), so this project cannot
  // actually deliver that email yet. Never log or fake that delivery
  // succeeded. The token is returned here so the caller (see
  // auth.controller.js#forgotPassword) can decide, based on environment,
  // whether it's safe to surface it directly for local testing.
  return token;
}

export async function resetPassword({ token, newPassword }) {
  if (!isPasswordStrongEnough(newPassword)) {
    throw new ValidationError(
      "Password does not meet the minimum requirements.",
      {
        newPassword:
          "At least 8 characters, one uppercase letter, and one number.",
      },
    );
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
    throw new AuthenticationError(
      "This password reset link is invalid or has expired.",
    );
  }

  const user = await User.findById(record.userId);
  if (!user)
    throw new AuthenticationError(
      "This password reset link is invalid or has expired.",
    );

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1; // invalidates any outstanding refresh tokens
  await user.save();

  record.used = true;
  await record.save();

  await safeCreateAuditLog({
    actor: { id: user._id.toString(), role: user.role },
    actorEmail: user.email,
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    module: AUDIT_MODULES.AUTH,
    entityType: "User",
    entityId: user._id,
    description: `${user.role} reset their own password via the forgot-password flow.`,
  });
}
