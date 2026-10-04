import Senior from "../models/Senior.js";
import User from "../models/User.js";
import Guardian from "../models/Guardian.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";
import { safeCreateAuditLog } from "./auditLog.service.js";

/**
 * Returns the authenticated Senior Citizen's own profile — never anyone
 * else's. `userId` always comes from `req.user.id` (set by the
 * `authenticate` middleware from the verified JWT + a fresh DB lookup),
 * never from a client-supplied id/param, so a Senior cannot request
 * another Senior's data by changing a URL or query string.
 *
 * This intentionally only returns what already exists in the current
 * data model (User + Senior + Barangay + Guardian). Pension, Benefits,
 * Applications, Announcements, Activities, and Notifications have no
 * backend module yet — the frontend renders empty states for those
 * rather than this service inventing placeholder data.
 */
export async function getMySeniorProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("Account not found.");

  const senior = await Senior.findOne({ userId: user._id })
    .populate("barangayId", "name municipality province")
    .populate("medicalConditionId", "name");
  if (!senior) throw new NotFoundError("Senior profile not found.");

  let guardian = null;
  if (senior.guardianId) {
    const g = await Guardian.findById(senior.guardianId);
    if (g) {
      guardian = {
        firstName: g.firstName,
        lastName: g.lastName,
        relationship: g.relationship,
        mobileNumber: g.mobileNumber,
      };
    }
  }

  return {
    id: senior._id.toString(),
    accountStatus: user.status,
    seniorCitizenId: senior.seniorCitizenId || null,
    firstName: senior.firstName,
    middleName: senior.middleName,
    lastName: senior.lastName,
    suffix: senior.suffix,
    dateOfBirth: senior.dateOfBirth,
    age: senior.age,
    sex: senior.sex,
    civilStatus: senior.civilStatus,
    mobileNumber: senior.mobileNumber,
    email: senior.email || user.email,
    address: senior.address,
    bedridden: senior.bedridden,
    barangay: senior.barangayId
      ? {
          id: senior.barangayId._id.toString(),
          name: senior.barangayId.name,
          municipality: senior.barangayId.municipality,
          province: senior.barangayId.province,
        }
      : null,
    guardian,
    // Phase 5 privacy boundary: a Senior may see THAT they declared a
    // condition, WHICH condition, and the current review status — never
    // the internal classification/priority (models/Illness.js's own
    // fields, or Senior.medicalClassification/medicalPriorityLevel),
    // any override reasoning, Home Visit decision/remarks, or which
    // Admin reviewed it. Those stay Admin-only (medicalVerification.service.js).
    medical: senior.hasMedicalCondition
      ? {
          hasMedicalCondition: true,
          conditionName: senior.medicalConditionId?.name || null,
          verificationStatus: senior.medicalVerificationStatus,
        }
      : { hasMedicalCondition: false },
    // Phase 6 — same minimal-disclosure principle as `medical` above:
    // the Senior sees THAT Barangay verification/home visit/endorsement
    // happened and its outcome, never Staff-only remarks, findings, or
    // who acted on it.
    barangayReview: senior.barangayReview?.verificationStatus
      ? {
          verificationStatus: senior.barangayReview.verificationStatus,
          homeVisitStatus: senior.barangayReview.homeVisit?.status || null,
          endorsementDecision: senior.barangayReview.endorsement?.decision || null,
        }
      : null,
  };
}


// Fields a Senior may correct on their own profile. Everything else
// (seniorCitizenId, dateOfBirth, sex, civilStatus, barangayId, guardianId,
// userId, and the account's role/status/verification state) is
// deliberately absent — dateOfBirth in particular drives age-based
// benefit eligibility, so a self-service edit could otherwise be used to
// manufacture eligibility without going through verification.
const SELF_EDITABLE_FIELDS = ["firstName", "middleName", "lastName", "suffix", "mobileNumber", "bedridden"];
const ADDRESS_FIELDS = ["houseLotBlock", "street", "sitio", "purok", "municipality", "province", "postalCode"];

function applyProfileFields(senior, data) {
  const changed = [];
  for (const key of SELF_EDITABLE_FIELDS) {
    if (data[key] !== undefined && data[key] !== senior[key]) {
      senior[key] = data[key];
      changed.push(key);
    }
  }
  if (data.address) {
    for (const key of ADDRESS_FIELDS) {
      if (data.address[key] !== undefined && data.address[key] !== senior.address?.[key]) {
        senior.address[key] = data.address[key];
        changed.push(`address.${key}`);
      }
    }
  }
  return changed;
}

/**
 * Self-service profile correction. `userId` always comes from the
 * authenticated token — a Senior can never edit anyone else's record —
 * and `data` has already been parsed by updateSeniorProfileSchema, which
 * has no role/status/barangay/verification/ID fields to write.
 */
export async function updateMySeniorProfile(requestingUser, data) {
  const senior = await Senior.findOne({ userId: requestingUser.id });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  const changed = applyProfileFields(senior, data);
  if (changed.length > 0) {
    await senior.save();
    await safeCreateAuditLog({
      actor: requestingUser,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.USER_MANAGEMENT,
      entityType: "Senior",
      entityId: senior._id,
      description: `${requestingUser.role} updated their own profile.`,
      // Field names only — never the personal values themselves.
      metadata: { changedFields: changed },
      barangayId: senior.barangayId,
    });
  }
  return getMySeniorProfile(requestingUser.id);
}

/**
 * Admin correction of another Senior's profile. Same fields as the
 * self-service edit, plus seniorCitizenId — protected against
 * duplicates exactly like registration is (Phase 1), and audited with
 * the previous/new value since it is an identity field.
 */
export async function adminUpdateSeniorProfile(seniorId, data, requestingUser) {
  const senior = await Senior.findById(seniorId);
  if (!senior) throw new NotFoundError("Senior profile not found.");

  const changed = applyProfileFields(senior, data);

  let idChange = null;
  const newId = (data.seniorCitizenId || "").trim();
  if (data.seniorCitizenId !== undefined && newId !== (senior.seniorCitizenId || "")) {
    if (newId) {
      const clash = await Senior.findOne({ seniorCitizenId: newId, _id: { $ne: senior._id } });
      if (clash) {
        throw new ConflictError("This Senior Citizen ID is already registered.", {
          seniorCitizenId: "This ID is already associated with another account.",
        });
      }
    }
    idChange = { from: senior.seniorCitizenId || null, to: newId || null };
    senior.seniorCitizenId = newId || undefined;
    changed.push("seniorCitizenId");
  }

  if (changed.length === 0) return senior;
  await senior.save();

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.UPDATE,
    module: AUDIT_MODULES.USER_MANAGEMENT,
    entityType: "Senior",
    entityId: senior._id,
    description: idChange
      ? `${requestingUser.role} corrected a Senior's profile, including their Senior Citizen ID (sensitive change).`
      : `${requestingUser.role} corrected a Senior's profile.`,
    metadata: { changedFields: changed, ...(idChange ? { seniorCitizenIdChange: idChange } : {}) },
    barangayId: senior.barangayId,
  });
  return senior;
}
