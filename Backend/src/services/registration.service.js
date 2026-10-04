import mongoose from "mongoose";
import User from "../models/User.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import Barangay from "../models/Barangay.js";
import Illness from "../models/Illness.js";
import Verification from "../models/Verification.js";
import Document from "../models/Document.js";
import { hashPassword, generateTemporaryPassword } from "../utils/password.js";
import { ROLES, ACCOUNT_STATUS, VERIFICATION_STATUS, MINIMUM_SENIOR_AGE, DOCUMENT_TYPES, MEDICAL_VERIFICATION_STATUS } from "../utils/constants.js";
import { ValidationError, ConflictError, NotFoundError } from "../utils/errors.js";
import { isSeniorRegistrationEnabled, isGuardianRegistrationEnabled } from "./systemSettings.service.js";

function calculateAge(dateOfBirth) {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/**
 * Registers a new Senior Citizen account.
 *
 * Implements: validate barangay → duplicate checks → eligibility check →
 * hash password → create User + Senior (+ Guardian, + Documents) →
 * create Verification (PENDING) → return safe summary.
 *
 * All writes happen inside a single Mongo transaction so a failure partway
 * through never leaves an orphaned User with no Senior/Verification record.
 */
export async function registerSenior(data, uploadedFiles = {}) {
  // System Settings' registration toggles (module 15). Checked first,
  // before any other validation/writes, so a disabled registration
  // never partially processes a submission.
  if (!(await isSeniorRegistrationEnabled())) {
    throw new ValidationError("Senior Citizen registration is currently disabled by the Administrator.");
  }
  if (data.guardian?.hasGuardian && !(await isGuardianRegistrationEnabled())) {
    throw new ValidationError(
      "Guardian/Authorized Representative registration is currently disabled by the Administrator.",
      { "guardian.hasGuardian": "Guardian registration is temporarily unavailable. You may still register the Senior without a Guardian." }
    );
  }

  const barangay = await Barangay.findById(data.barangayId);
  if (!barangay || !barangay.isActive) {
    throw new ValidationError("The selected barangay is invalid or currently inactive.", {
      barangayId: "Please select a valid, active barangay.",
    });
  }

  // Server-computed age — the frontend's displayed age is never trusted.
  const age = calculateAge(data.dateOfBirth);
  if (age < MINIMUM_SENIOR_AGE) {
    throw new ValidationError(
      `Registrants must be at least ${MINIMUM_SENIOR_AGE} years old to register as a senior citizen.`,
      { dateOfBirth: "This date of birth does not meet the senior citizen age requirement." }
    );
  }

  // Duplicate checks (defense in depth — unique indexes are the final guard).
  const emailInUse = await User.findOne({ email: data.accountEmail.toLowerCase() });
  if (emailInUse) {
    throw new ConflictError("An account with this email already exists.", { accountEmail: "Email already registered." });
  }

  if (data.seniorCitizenId) {
    const idInUse = await Senior.findOne({ seniorCitizenId: data.seniorCitizenId });
    if (idInUse) {
      throw new ConflictError("This Senior Citizen ID is already registered.", {
        seniorCitizenId: "This ID is already associated with another account.",
      });
    }
  }

  // A Guardian/Authorized Representative account is created as part of
  // this same registration (see below) whenever one is submitted — so
  // its email needs the same defense-in-depth duplicate checks the
  // Senior's own accountEmail gets above, before any writes happen.
  const hasGuardian = Boolean(data.guardian?.hasGuardian);
  if (hasGuardian) {
    const guardianEmail = data.guardian.email.toLowerCase();
    if (guardianEmail === data.accountEmail.toLowerCase()) {
      throw new ValidationError("The Guardian's email must be different from the Senior's account email.", {
        "guardian.email": "This email is already used for the Senior's own account.",
      });
    }
    const guardianEmailInUse = await User.findOne({ email: guardianEmail });
    if (guardianEmailInUse) {
      throw new ConflictError("An account with this Guardian email already exists.", {
        "guardian.email": "Email already registered.",
      });
    }
  }

  // Medical condition: the illness must be a real, active entry — free
  // text is never accepted. Protected values (verification status)
  // are decided here, never taken from the request.
  const hasMedicalCondition = Boolean(data.medical?.hasMedicalCondition);
  if (hasMedicalCondition) {
    const illness = await Illness.findOne({ _id: data.medical.illnessId, isActive: true });
    if (!illness) {
      throw new ValidationError("Please select a valid medical condition.", {
        "medical.illnessId": "Please select a valid medical condition.",
      });
    }
  }

  const passwordHash = await hashPassword(data.password);
  const guardianTemporaryPassword = hasGuardian ? generateTemporaryPassword() : null;
  const guardianPasswordHash = hasGuardian ? await hashPassword(guardianTemporaryPassword) : null;

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [user] = await User.create(
        [
          {
            email: data.accountEmail.toLowerCase(),
            passwordHash,
            role: ROLES.SENIOR_CITIZEN,
            status: ACCOUNT_STATUS.PENDING_VERIFICATION,
          },
        ],
        { session }
      );

      const [senior] = await Senior.create(
        [
          {
            userId: user._id,
            barangayId: barangay._id,
            firstName: data.firstName,
            middleName: data.middleName,
            lastName: data.lastName,
            suffix: data.suffix,
            dateOfBirth: data.dateOfBirth,
            sex: data.sex,
            civilStatus: data.civilStatus,
            seniorCitizenId: data.seniorCitizenId || undefined,
            mobileNumber: data.mobileNumber,
            email: data.email,
            address: data.address,
            bedridden: data.bedridden,
            hasMedicalCondition,
            medicalConditionId: hasMedicalCondition ? data.medical.illnessId : null,
            medicalVerificationStatus: hasMedicalCondition ? MEDICAL_VERIFICATION_STATUS.PENDING : null,
          },
        ],
        { session }
      );

      let guardian = null;
      if (hasGuardian) {
        // The Guardian's own login account is created right here, during
        // registration, rather than later via a separate Admin action
        // (see admin.service.js's createGuardianAccount, which now only
        // exists as a legacy/recovery path for Guardian records that
        // predate this change). It starts PENDING_VERIFICATION — the
        // same status the Senior's own account gets — and only becomes
        // ACTIVE once Admin/Staff approves this registration (see
        // verification.service.js's approveVerification), exactly
        // mirroring how the Senior's account is activated.
        const [guardianUser] = await User.create(
          [
            {
              email: data.guardian.email.toLowerCase(),
              passwordHash: guardianPasswordHash,
              role: ROLES.GUARDIAN,
              status: ACCOUNT_STATUS.PENDING_VERIFICATION,
              assignedBarangayId: null,
            },
          ],
          { session }
        );

        const [g] = await Guardian.create(
          [
            {
              seniorId: senior._id,
              firstName: data.guardian.firstName,
              middleName: data.guardian.middleName,
              lastName: data.guardian.lastName,
              suffix: data.guardian.suffix,
              relationship: data.guardian.relationship,
              mobileNumber: data.guardian.mobileNumber,
              email: data.guardian.email,
              address: data.guardian.address,
              idType: data.guardian.idType,
              idNumber: data.guardian.idNumber,
              userId: guardianUser._id,
            },
          ],
          { session }
        );
        guardian = g;
        senior.guardianId = guardian._id;
        await senior.save({ session });
      }

      const [verification] = await Verification.create(
        [
          {
            seniorId: senior._id,
            barangayId: barangay._id,
            status: VERIFICATION_STATUS.PENDING,
          },
        ],
        { session }
      );

      // Persist document references for whatever files were uploaded.
      const documentEntries = Object.entries(uploadedFiles).filter(([, file]) => Boolean(file));
      if (documentEntries.length) {
        const docs = documentEntries.map(([type, file]) => ({
          seniorId: senior._id,
          verificationId: verification._id,
          documentType: DOCUMENT_TYPES[type] || type,
          fileName: file.originalname,
          storageKey: file.filename,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: user._id,
        }));
        await Document.insertMany(docs, { session });
      }

      result = {
        userId: user._id,
        seniorId: senior._id,
        verificationId: verification._id,
        // Only ever populated/returned from this one registration
        // response — never persisted in plaintext and never returned by
        // any other endpoint afterward. Preserves the same "shown once"
        // convention admin.service.js already uses for Staff/Guardian
        // temporary passwords.
        guardian: guardian
          ? { guardianRecordId: guardian._id, email: guardian.email, temporaryPassword: guardianTemporaryPassword }
          : null,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

export async function listActiveIllnesses() {
  // .lean() explicitly, on top of the existing name-only projection —
  // belt-and-suspenders so the internal classification/priority (or the
  // needsConfiguration virtual derived from them; see models/Illness.js)
  // can never leak into this public, unauthenticated response even
  // indirectly, regardless of what a future edit to this query selects.
  const illnesses = await Illness.find({ isActive: true }).sort({ name: 1 }).select("name").lean();
  return illnesses.map((i) => ({ _id: i._id, name: i.name }));
}

export async function listActiveBarangays() {
  return Barangay.find({ isActive: true }).sort({ name: 1 }).select("name municipality province code");
}

export async function getSeniorByUserId(userId) {
  const senior = await Senior.findOne({ userId }).populate("barangayId", "name municipality province");
  if (!senior) throw new NotFoundError("Senior profile not found.");
  return senior;
}
