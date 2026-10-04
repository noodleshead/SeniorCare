import Senior from "../models/Senior.js";
import Verification from "../models/Verification.js";
import Document from "../models/Document.js";
import Concern from "../models/Concern.js";
import Guardian from "../models/Guardian.js";
import { CONCERN_STATUS, AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { NotFoundError } from "../utils/errors.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import { listAuthorizedSeniorsForGuardian, resolveActingSenior } from "../utils/guardianAccess.js";
import * as pensionClaimService from "./pensionClaim.service.js";

function summarizeSenior(senior) {
  return {
    _id: senior._id,
    firstName: senior.firstName,
    lastName: senior.lastName,
    seniorCitizenId: senior.seniorCitizenId,
    bedridden: senior.bedridden,
    status: senior.status,
    barangay: senior.barangayId && senior.barangayId.name ? senior.barangayId : null,
  };
}

/** "My Managed Seniors" — every Senior this Guardian is currently authorized for. */
export async function listManagedSeniors(requestingUser) {
  const seniors = await listAuthorizedSeniorsForGuardian(requestingUser);
  return seniors.map(summarizeSenior);
}

/**
 * A single managed Senior's summary — reuses resolveActingSenior for the
 * authorization check itself (the same bidirectional Guardian<->Senior
 * verification every other module already relies on), so a Guardian can
 * never retrieve a Senior they aren't actually authorized for, and a
 * requestedSeniorId that isn't one of their own authorized Seniors fails
 * exactly like an entirely missing one would.
 */
export async function getManagedSeniorDetail(requestingUser, seniorId) {
  const senior = await resolveActingSenior(requestingUser, seniorId);
  const populated = await Senior.findById(senior._id).populate("barangayId", "name municipality");

  const [verification, documents] = await Promise.all([
    Verification.findOne({ seniorId: senior._id }).sort({ createdAt: -1 }),
    Document.find({ seniorId: senior._id }).sort({ uploadedAt: -1 }),
  ]);

  return {
    ...summarizeSenior(populated),
    verificationStatus: verification ? verification.status : null,
    documents: documents.map((d) => ({
      _id: d._id,
      documentType: d.documentType,
      fileName: d.fileName,
      uploadedAt: d.uploadedAt,
    })),
  };
}

/**
 * Aggregated Guardian dashboard: counts and recent items across every
 * Senior this Guardian manages. Reuses pensionClaim.service.js and
 * queries Concern directly (mirroring how Senior's own dashboard would
 * read the same data) rather than re-implementing pension/concern logic
 * here — this file only aggregates, it does not duplicate business logic.
 */
export async function getGuardianDashboard(requestingUser) {
  const seniors = await listAuthorizedSeniorsForGuardian(requestingUser);
  const seniorIds = seniors.map((s) => s._id);

  const [pendingConcerns, upcomingClaims] = await Promise.all([
    Concern.countDocuments({ seniorId: { $in: seniorIds }, status: { $ne: CONCERN_STATUS.RESOLVED } }),
    Promise.all(
      seniors.map(async (senior) => {
        try {
          const claim = await pensionClaimService.getMyUpcomingClaim(senior.userId);
          return claim ? { senior: summarizeSenior(senior), claim } : null;
        } catch {
          return null;
        }
      })
    ),
  ]);

  return {
    managedSeniorsCount: seniors.length,
    managedSeniors: seniors.map(summarizeSenior),
    pendingConcernsCount: pendingConcerns,
    upcomingPensionClaims: upcomingClaims.filter(Boolean),
  };
}


/**
 * A Guardian's own contact details. One Guardian *account* can hold
 * several Guardian *records* (one per authorized Senior — see
 * guardianAccess.js#listAuthorizedSeniorsForGuardian), each duplicating
 * the same person's name/contact fields, so an edit is applied to every
 * record tied to this account to keep them consistent.
 *
 * Only name/mobile/address are writable. relationship, idType/idNumber,
 * email (the login identity), seniorId, and authorizationConfirmed are
 * never touched here — a Guardian cannot alter which Seniors they are
 * authorized for, or how, by editing their own profile.
 */
export async function getMyGuardianProfile(requestingUser) {
  const record = await Guardian.findOne({ userId: requestingUser.id });
  if (!record) throw new NotFoundError("Guardian profile not found.");
  return {
    firstName: record.firstName,
    lastName: record.lastName,
    mobileNumber: record.mobileNumber,
    address: record.address,
    email: record.email,
  };
}

export async function updateMyGuardianProfile(requestingUser, data) {
  const records = await Guardian.find({ userId: requestingUser.id });
  if (records.length === 0) throw new NotFoundError("Guardian profile not found.");

  const first = records[0];
  const changed = ["firstName", "lastName", "mobileNumber", "address"].filter((k) => data[k] !== first[k]);

  if (changed.length > 0) {
    await Guardian.updateMany(
      { userId: requestingUser.id },
      { $set: { firstName: data.firstName, lastName: data.lastName, mobileNumber: data.mobileNumber, address: data.address } }
    );
    await safeCreateAuditLog({
      actor: requestingUser,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.USER_MANAGEMENT,
      entityType: "Guardian",
      entityId: first._id,
      description: `${requestingUser.role} updated their own profile.`,
      metadata: { changedFields: changed },
    });
  }
  return getMyGuardianProfile(requestingUser);
}
