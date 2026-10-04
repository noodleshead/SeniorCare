import User from "../models/User.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import Barangay from "../models/Barangay.js";
import { ROLES, ACCOUNT_STATUS, AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { safeCreateAuditLog } from "./auditLog.service.js";

/**
 * Admin User Management — "Admin cannot see existing user accounts"
 * (Phase 2). Previously the only account visibility Admin had was
 * admin.service.js's Barangay Staff listing (StaffManagementPage.jsx)
 * and the per-registration Verification review — there was no unified
 * view across Senior/Guardian/Staff/Admin/LGU-OSCA accounts at all.
 *
 * Deliberately reuses the existing `User` collection as the single
 * source of account/role/status truth (no duplicate user model), and
 * only ever reads (never writes) `Senior`/`Guardian` documents to
 * resolve a display name — this file never edits a profile.
 *
 * Staff/Admin/LGU-OSCA accounts have no name field anywhere in this
 * system (checked: User has none, and there's no separate Staff/Admin
 * profile document) — StaffManagementPage.jsx has always identified
 * those accounts by email alone. This file preserves that; it does not
 * invent a name field that doesn't exist.
 */

const SEARCHABLE_ROLES_WITH_PROFILE = new Set([ROLES.SENIOR_CITIZEN, ROLES.GUARDIAN]);

async function findMatchingProfileUserIds(term) {
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [seniors, guardians] = await Promise.all([
    Senior.find({ $or: [{ firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }] }).select("userId"),
    Guardian.find({ $or: [{ firstName: regex }, { lastName: regex }] }).select("userId"),
  ]);
  return [...seniors.map((s) => s.userId), ...guardians.map((g) => g.userId)].filter(Boolean);
}

/**
 * Attaches a lightweight `profile` summary ({ name, seniorCitizenId?,
 * barangayName? }) to each User doc for display — resolved in at most
 * two extra queries for the whole page (batched by role), never one
 * query per row.
 */
async function attachProfileSummaries(users) {
  const seniorUserIds = users.filter((u) => u.role === ROLES.SENIOR_CITIZEN).map((u) => u._id);
  const guardianUserIds = users.filter((u) => u.role === ROLES.GUARDIAN).map((u) => u._id);
  const staffUserIds = users.filter((u) => u.role === ROLES.BARANGAY_STAFF).map((u) => u._id);

  const [seniors, guardians, barangaysById] = await Promise.all([
    seniorUserIds.length
      ? Senior.find({ userId: { $in: seniorUserIds } })
          .select("userId firstName lastName seniorCitizenId barangayId")
          .populate("barangayId", "name")
      : [],
    guardianUserIds.length ? Guardian.find({ userId: { $in: guardianUserIds } }).select("userId firstName lastName") : [],
    staffUserIds.length ? Barangay.find({}).select("name") : [], // small collection; cheaper than N populate calls
  ]);

  const seniorByUserId = new Map(seniors.map((s) => [s.userId.toString(), s]));
  const guardianByUserId = new Map(guardians.map((g) => [g.userId.toString(), g]));
  const barangayNameById = new Map(barangaysById.map((b) => [b._id.toString(), b.name]));

  return users.map((u) => {
    const obj = u.toObject();
    if (u.role === ROLES.SENIOR_CITIZEN) {
      const s = seniorByUserId.get(u._id.toString());
      obj.profile = s
        ? { name: `${s.firstName} ${s.lastName}`, seniorCitizenId: s.seniorCitizenId || null, barangayName: s.barangayId?.name || null }
        : null;
    } else if (u.role === ROLES.GUARDIAN) {
      const g = guardianByUserId.get(u._id.toString());
      obj.profile = g ? { name: `${g.firstName} ${g.lastName}` } : null;
    } else if (u.role === ROLES.BARANGAY_STAFF) {
      obj.profile = { barangayName: u.assignedBarangayId ? barangayNameById.get(u.assignedBarangayId.toString()) : null };
    } else {
      obj.profile = null; // ADMIN / LGU_OSCA — email is the only identifier that exists
    }
    return obj;
  });
}

/**
 * Server-side paginated/filtered/searched account listing. `search`
 * matches email directly, plus (for Senior/Guardian) the linked
 * profile's name/Senior-Citizen-ID — never fetches the whole
 * collection into memory to filter client-side.
 */
export async function listUsers({ role, status, search, page = 1, pageSize = 20 } = {}) {
  const match = {};
  if (role) match.role = role;
  if (status) match.status = status;

  if (search && search.trim()) {
    const term = search.trim();
    const emailRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchingProfileUserIds = await findMatchingProfileUserIds(term);
    match.$or = [{ email: emailRegex }, { _id: { $in: matchingProfileUserIds } }];
  }

  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [users, total] = await Promise.all([
    User.find(match)
      .select("-passwordHash")
      .populate("assignedBarangayId", "name municipality")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize),
    User.countDocuments(match),
  ]);

  const items = await attachProfileSummaries(users);

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(Math.ceil(total / safePageSize), 1),
    },
  };
}

/**
 * Full detail view for one account — includes the linked Senior /
 * Guardian (with authorized Seniors) / Barangay Staff profile
 * information, per the module's own role-specific requirements.
 * Never returns passwordHash (excluded at the query level, not
 * scrubbed after the fact, so it's never even loaded into memory here).
 */
export async function getUserDetail(userId) {
  const user = await User.findById(userId).select("-passwordHash").populate("assignedBarangayId", "name municipality province");
  if (!user) throw new NotFoundError("Account not found.");

  const detail = { user: user.toObject(), profile: null };

  if (user.role === ROLES.SENIOR_CITIZEN) {
    const senior = await Senior.findOne({ userId: user._id }).populate("barangayId", "name municipality province");
    detail.profile = senior ? senior.toObject() : null;
  } else if (user.role === ROLES.GUARDIAN) {
    // A single Guardian *account* (one User/email) can hold multiple
    // Guardian *records* — one per authorized Senior (see
    // utils/guardianAccess.js#listAuthorizedSeniorsForGuardian) — so
    // this must list all of them, not just the first (an earlier draft
    // of this function used findOne and would have silently hidden
    // every authorization but one).
    const guardianRecords = await Guardian.find({ userId: user._id });
    const authorizedSeniors = guardianRecords.length
      ? await Senior.find({ _id: { $in: guardianRecords.map((g) => g.seniorId) } })
          .select("firstName lastName seniorCitizenId barangayId")
          .populate("barangayId", "name")
      : [];
    detail.profile = guardianRecords.length
      ? {
          // Contact/relationship fields are the same across every
          // record for this Guardian in practice (one person, one set
          // of contact details) — display the first record's shared
          // fields alongside the full list of authorized Seniors.
          firstName: guardianRecords[0].firstName,
          lastName: guardianRecords[0].lastName,
          mobileNumber: guardianRecords[0].mobileNumber,
          email: guardianRecords[0].email,
          authorizedSeniors,
        }
      : null;
  }
  // BARANGAY_STAFF's only "profile" beyond the User doc itself is its
  // assignedBarangayId, already populated on `user` above. ADMIN /
  // LGU_OSCA have no additional profile document at all.

  return detail;
}

/**
 * Activate/deactivate any account. Deliberately only accepts ACTIVE or
 * INACTIVE — PENDING_VERIFICATION and REJECTED remain governed
 * exclusively by the Verification workflow (verification.service.js),
 * not this generic toggle, so this can never be used to bypass or
 * short-circuit verification. Matches this module's own instruction to
 * prefer the existing account lifecycle over introducing new states or
 * permanent deletion.
 */
export async function setUserAccountStatus(userId, status, requestingUser) {
  if (![ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.INACTIVE].includes(status)) {
    throw new ValidationError("Status must be ACTIVE or INACTIVE.");
  }
  if (userId === requestingUser.id) {
    throw new ValidationError("You cannot change your own account's status.");
  }

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("Account not found.");
  if (user.status === ACCOUNT_STATUS.PENDING_VERIFICATION || user.status === ACCOUNT_STATUS.REJECTED) {
    throw new ValidationError(
      "This account is still pending verification or was rejected — use the Verification workflow, not this action, to change it."
    );
  }

  const previousStatus = user.status;
  user.status = status;
  await user.save();

  await safeCreateAuditLog({
    actor: requestingUser,
    action: status === ACCOUNT_STATUS.ACTIVE ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
    module: AUDIT_MODULES.USER_MANAGEMENT,
    entityType: "User",
    entityId: user._id,
    description: `${requestingUser.role} set account (${user.email}, role ${user.role}) status to ${status}.`,
    metadata: { statusFrom: previousStatus, statusTo: status },
    barangayId: user.assignedBarangayId,
  });

  return user;
}
