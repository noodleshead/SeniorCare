import Barangay from "../models/Barangay.js";
import User from "../models/User.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import { ROLES, ACCOUNT_STATUS, AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { hashPassword, generateTemporaryPassword } from "../utils/password.js";
import { hasBroadBarangayAccess } from "../utils/barangayScope.js";
import { NotFoundError, ConflictError, ValidationError } from "../utils/errors.js";
import { safeCreateAuditLog } from "./auditLog.service.js";

// ---------------------------------------------------------------------
// Barangays
// ---------------------------------------------------------------------

export async function createBarangay(data) {
  const barangay = await Barangay.create({
    name: data.name,
    municipality: data.municipality,
    province: data.province,
    code: data.code.toUpperCase(),
  });
  return barangay;
}

/**
 * Lists every Barangay along with real staff/senior counts pulled from
 * MongoDB — never hardcoded or estimated.
 */
export async function listBarangaysWithStats() {
  const barangays = await Barangay.find().sort({ name: 1 }).lean();

  const [staffCounts, seniorCounts] = await Promise.all([
    User.aggregate([
      { $match: { role: ROLES.BARANGAY_STAFF, assignedBarangayId: { $ne: null } } },
      { $group: { _id: "$assignedBarangayId", count: { $sum: 1 } } },
    ]),
    Senior.aggregate([{ $group: { _id: "$barangayId", count: { $sum: 1 } } }]),
  ]);

  const staffMap = new Map(staffCounts.map((s) => [s._id.toString(), s.count]));
  const seniorMap = new Map(seniorCounts.map((s) => [s._id.toString(), s.count]));

  return barangays.map((b) => ({
    ...b,
    staffCount: staffMap.get(b._id.toString()) || 0,
    seniorCount: seniorMap.get(b._id.toString()) || 0,
  }));
}

// ---------------------------------------------------------------------
// Barangay Staff
// ---------------------------------------------------------------------

async function assertBarangayExistsAndActive(barangayId) {
  const barangay = await Barangay.findById(barangayId);
  if (!barangay) throw new NotFoundError("Selected Barangay does not exist.");
  if (!barangay.isActive) {
    throw new ValidationError("Selected Barangay is not currently active.", {
      assignedBarangayId: "This Barangay is inactive.",
    });
  }
  return barangay;
}

/**
 * Creates a BARANGAY_STAFF account. `role` is never accepted from the
 * client — it's hardcoded here, the same pattern registration.service.js
 * already uses for SENIOR_CITIZEN accounts.
 */
export async function createStaffAccount(data) {
  await assertBarangayExistsAndActive(data.assignedBarangayId);

  const existing = await User.findOne({
    $or: [{ email: data.email }, ...(data.username ? [{ username: data.username }] : [])],
  });
  if (existing) {
    throw new ConflictError("An account with this email or username already exists.");
  }

  const temporaryPassword = data.password || generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.create({
    email: data.email,
    username: data.username,
    passwordHash,
    role: ROLES.BARANGAY_STAFF,
    status: data.status || ACCOUNT_STATUS.ACTIVE,
    assignedBarangayId: data.assignedBarangayId,
  });

  const populated = await User.findById(user._id).populate("assignedBarangayId", "name municipality province");

  return {
    user: populated,
    // Only returned once, at creation time — never persisted in plaintext,
    // never returned by any other endpoint. The admin is responsible for
    // securely relaying this to the staff member.
    temporaryPassword: data.password ? undefined : temporaryPassword,
  };
}

export async function listStaff() {
  return User.find({ role: ROLES.BARANGAY_STAFF })
    .populate("assignedBarangayId", "name municipality province")
    .sort({ createdAt: -1 });
}

export async function getStaffById(staffId) {
  const staff = await User.findOne({ _id: staffId, role: ROLES.BARANGAY_STAFF }).populate(
    "assignedBarangayId",
    "name municipality province"
  );
  if (!staff) throw new NotFoundError("Staff account not found.");
  return staff;
}

// ---------------------------------------------------------------------
// Guardian accounts
// ---------------------------------------------------------------------

/**
 * LEGACY / RECOVERY PATH ONLY.
 *
 * As of the registration-based Guardian flow (see
 * registration.service.js's registerSenior), a Guardian's login account
 * is created automatically as part of Senior Registration, and Admin
 * verification only activates it (see verification.service.js's
 * approveVerification) — Admin no longer needs to click "Create
 * Guardian Login" as part of the normal workflow.
 *
 * This function remains only for Guardian records that exist without a
 * linked User account — e.g. Guardian records created before this
 * change shipped. The Admin/Staff UI hides the normal "Create Guardian
 * Login" action once `guardian.userId` is already set (which it will be
 * for every Guardian registered going forward) and only surfaces this
 * as a fallback for those older, account-less records.
 *
 * Mirrors createStaffAccount above almost exactly (temp password,
 * hashing, uniqueness check), just for a Guardian instead of a Barangay
 * Staff member. `role` is hardcoded, never accepted from the client,
 * same as every other account-creation path in this file.
 *
 * A Guardian record only becomes eligible once Barangay Staff has
 * confirmed the authorization documents during the Senior's own
 * verification (Guardian.authorizationConfirmed) — this function does
 * not itself grant authorization, it only lets an already-authorized
 * Guardian actually log in.
 */
export async function createGuardianAccount(requestingUser, guardianRecordId, data) {
  const guardian = await Guardian.findById(guardianRecordId);
  if (!guardian) throw new NotFoundError("Guardian record not found.");
  if (!guardian.authorizationConfirmed) {
    throw new ValidationError("This Guardian's authorization has not been confirmed yet.", {
      guardianRecordId: "Authorization not yet confirmed.",
    });
  }
  if (guardian.userId) {
    throw new ConflictError("This Guardian already has a login account.");
  }

  const senior = await Senior.findById(guardian.seniorId);
  if (!senior) throw new NotFoundError("Associated Senior profile not found.");

  // Barangay Staff may only provision a Guardian login for a Senior in
  // their own assigned Barangay — the same scoping rule as every other
  // Staff-performed action; Admin/LGU-OSCA are unrestricted.
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId || requestingUser.assignedBarangayId !== senior.barangayId.toString()) {
      throw new ValidationError("You may only create Guardian accounts for Seniors in your assigned Barangay.", {});
    }
  }

  if (!data.email) {
    throw new ValidationError("An email is required to create a Guardian login.", { email: "Email is required." });
  }
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new ConflictError("An account with this email already exists.");
  }

  const temporaryPassword = data.password || generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.create({
    email: data.email,
    passwordHash,
    role: ROLES.GUARDIAN,
    status: ACCOUNT_STATUS.ACTIVE,
    // Guardians are not Barangay-scoped staff — their access is scoped
    // entirely through the Guardian-Senior relationship instead (see
    // utils/guardianAccess.js), so assignedBarangayId stays null here.
    assignedBarangayId: null,
  });

  guardian.userId = user._id;
  await guardian.save();

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.CREATE,
    module: AUDIT_MODULES.GUARDIAN,
    entityType: "Guardian",
    entityId: guardian._id,
    description: `${requestingUser.role} created a legacy Guardian login account (${user.email}).`,
    metadata: { guardianUserId: user._id, seniorId: senior._id },
    barangayId: senior.barangayId,
  });

  return {
    user,
    guardian,
    temporaryPassword: data.password ? undefined : temporaryPassword,
  };
}

/**
 * Regenerates the login password for a Guardian who already has an
 * account — the recovery path for when the one-time temporary password
 * shown at creation was lost/never captured. Same barangay-scoping rule
 * as createGuardianAccount; the new password is shown exactly once,
 * the same way, and is never stored or retrievable afterward.
 */
export async function resetGuardianPassword(requestingUser, guardianRecordId, data = {}) {
  const guardian = await Guardian.findById(guardianRecordId);
  if (!guardian) throw new NotFoundError("Guardian record not found.");
  if (!guardian.userId) {
    throw new ConflictError("This Guardian does not have a login account yet.");
  }

  const senior = await Senior.findById(guardian.seniorId);
  if (!senior) throw new NotFoundError("Associated Senior profile not found.");

  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId || requestingUser.assignedBarangayId !== senior.barangayId.toString()) {
      throw new ValidationError("You may only reset Guardian passwords for Seniors in your assigned Barangay.", {});
    }
  }

  const temporaryPassword = data.password || generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.findByIdAndUpdate(guardian.userId, { passwordHash }, { new: true });
  if (!user) throw new NotFoundError("This Guardian's login account no longer exists.");

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    module: AUDIT_MODULES.GUARDIAN,
    entityType: "Guardian",
    entityId: guardian._id,
    description: `${requestingUser.role} reset the login password for a Guardian account (${user.email}).`,
    metadata: { guardianUserId: user._id, seniorId: senior._id },
    barangayId: senior.barangayId,
  });

  return {
    user,
    guardian,
    temporaryPassword: data.password ? undefined : temporaryPassword,
  };
}

// ---------------------------------------------------------------------
// Barangay Staff (continued)
// ---------------------------------------------------------------------

export async function updateStaffAssignment(staffId, assignedBarangayId) {
  await assertBarangayExistsAndActive(assignedBarangayId);

  const staff = await User.findOne({ _id: staffId, role: ROLES.BARANGAY_STAFF });
  if (!staff) throw new NotFoundError("Staff account not found.");

  staff.assignedBarangayId = assignedBarangayId;
  // Invalidate outstanding refresh tokens so the reassignment takes effect
  // immediately on their next login, consistent with how a password
  // change already forces re-authentication elsewhere in auth.service.js.
  staff.tokenVersion += 1;
  await staff.save();

  return User.findById(staff._id).populate("assignedBarangayId", "name municipality province");
}

export async function updateStaffStatus(staffId, status) {
  const staff = await User.findOne({ _id: staffId, role: ROLES.BARANGAY_STAFF });
  if (!staff) throw new NotFoundError("Staff account not found.");

  staff.status = status;
  staff.tokenVersion += 1; // deactivation should invalidate any active session immediately
  await staff.save();

  return User.findById(staff._id).populate("assignedBarangayId", "name municipality province");
}
