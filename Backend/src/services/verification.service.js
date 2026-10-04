import mongoose from "mongoose";
import fs from "node:fs";
import { resolveStoragePath } from "../utils/storage.js";
import Verification from "../models/Verification.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import Document from "../models/Document.js";
import User from "../models/User.js";
import Barangay from "../models/Barangay.js";
import { ACCOUNT_STATUS, VERIFICATION_STATUS, ROLES, NOTIFICATION_TYPE, AUDIT_ACTIONS, AUDIT_MODULES, DOCUMENT_TYPES } from "../utils/constants.js";
import { NotFoundError, AuthorizationError, ConflictError } from "../utils/errors.js";
import { createNotification } from "./notification.service.js";
import { safeCreateAuditLog } from "./auditLog.service.js";

/**
 * Returns pending verifications, scoped to the requesting staff member's
 * assigned barangay unless they hold ADMIN/LGU_OSCA (broader) access.
 *
 * Supports optional search (senior name / senior citizen ID) and pagination.
 * When no pagination params are supplied, behavior matches the original
 * implementation (full result array) so existing callers aren't affected.
 */
export async function listPendingVerifications(requestingUser, options = null) {
  const { search = "", page, limit, barangayId, status } = options || {};

  // Defaults to PENDING — every existing caller that doesn't pass
  // `status` (including calling this with no `options` at all) behaves
  // exactly as before. `status: "ALL"` removes the status filter
  // entirely so Staff can find an already-approved Senior again (e.g.
  // to reach the "Create Guardian Login" action on their review page,
  // which only appears once the registration is approved).
  const query = {};
  if (!status || status === VERIFICATION_STATUS.PENDING) {
    query.status = VERIFICATION_STATUS.PENDING;
  } else if (status !== "ALL") {
    query.status = status;
  }

  const hasBroadAccess = [ROLES.ADMIN, ROLES.LGU_OSCA].includes(requestingUser.role);
  if (!hasBroadAccess) {
    if (!requestingUser.assignedBarangayId) {
      // Staff with no assigned barangay sees nothing — fail closed, not open.
      return options ? { data: [], total: 0, page: 1, limit: 0, totalPages: 1 } : [];
    }
    query.barangayId = requestingUser.assignedBarangayId;
  } else if (barangayId) {
    // Admin/LGU_OSCA may optionally narrow to a single barangay.
    query.barangayId = barangayId;
  }

  if (search && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchingSeniors = await Senior.find({
      $or: [{ firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }],
    }).select("_id");
    query.seniorId = { $in: matchingSeniors.map((s) => s._id) };
  }

  const baseQuery = Verification.find(query)
    .populate({ path: "seniorId", select: "firstName lastName dateOfBirth mobileNumber seniorCitizenId" })
    .populate({ path: "barangayId", select: "name municipality" })
    .sort({ createdAt: 1 });

  // Preserve the original behavior exactly when called without `options`
  // (e.g. existing unit tests / any other internal caller): returns a
  // plain array with no pagination wrapper.
  if (!options) {
    return baseQuery;
  }

  const total = await Verification.countDocuments(query);
  const pageNum = Number(page) > 0 ? Number(page) : null;
  const limitNum = Number(limit) > 0 ? Number(limit) : null;

  if (pageNum && limitNum) {
    const results = await baseQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    return { data: results, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
  }

  const results = await baseQuery;
  return { data: results, total, page: 1, limit: total, totalPages: 1 };
}

export async function getVerificationById(verificationId, requestingUser) {
  const verification = await Verification.findById(verificationId)
    .populate("seniorId")
    .populate("barangayId", "name municipality province");

  if (!verification) throw new NotFoundError("Verification record not found.");

  assertBarangayScope(verification, requestingUser);

  const senior = verification.seniorId;
  const [guardian, documents] = await Promise.all([
    // Populate the linked login account's status/email so the Admin/Staff
    // review UI can show "Account Created — Pending/Active" without a
    // second request. Guardian.userId is set at registration time now
    // (see registration.service.js), not by an Admin action.
    senior?.guardianId ? Guardian.findById(senior.guardianId).populate("userId", "status email") : null,
    Document.find({ seniorId: senior?._id }).select("-storageKey"),
  ]);

  return {
    ...verification.toObject({ virtuals: true }),
    guardian,
    documents,
  };
}

/**
 * Returns dashboard statistics (pending / active / rejected / total seniors),
 * scoped to the requesting user's authorization the same way listPendingVerifications is.
 */
export async function getVerificationStats(requestingUser) {
  const hasBroadAccess = [ROLES.ADMIN, ROLES.LGU_OSCA].includes(requestingUser.role);
  const seniorMatch = {};
  if (!hasBroadAccess) {
    if (!requestingUser.assignedBarangayId) {
      return { pending: 0, active: 0, rejected: 0, total: 0 };
    }
    seniorMatch.barangayId = new mongoose.Types.ObjectId(requestingUser.assignedBarangayId);
  }

  const [pending, statusCounts, total] = await Promise.all([
    Verification.countDocuments({
      status: VERIFICATION_STATUS.PENDING,
      ...(seniorMatch.barangayId ? { barangayId: seniorMatch.barangayId } : {}),
    }),
    Senior.aggregate([
      { $match: seniorMatch },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $group: { _id: "$user.status", count: { $sum: 1 } } },
    ]),
    Senior.countDocuments(seniorMatch),
  ]);

  const active = statusCounts.find((s) => s._id === ACCOUNT_STATUS.ACTIVE)?.count || 0;
  const rejected = statusCounts.find((s) => s._id === ACCOUNT_STATUS.REJECTED)?.count || 0;

  return { pending, active, rejected, total };
}

/**
 * Resolves an on-disk document for streaming, after checking the requesting
 * user is authorized to view documents for that senior's barangay.
 */
export async function getDocumentForDownload(documentId, requestingUser) {
  const document = await Document.findById(documentId);
  if (!document) throw new NotFoundError("Document not found.");

  const senior = await Senior.findById(document.seniorId).select("barangayId");
  if (!senior) throw new NotFoundError("Associated senior profile not found.");

  const hasBroadAccess = [ROLES.ADMIN, ROLES.LGU_OSCA].includes(requestingUser.role);
  // Phase 5 privacy boundary: MEDICAL_SUPPORTING_DOCUMENT is the one
  // document type Barangay Staff must NOT reach here yet — Phase 5 gives
  // Staff no medical workflow at all (Phase 6's Home Visit queue is
  // where that begins), unlike every other document type this endpoint
  // already lets Staff review for registration verification in their
  // own barangay. Scoped to this one documentType so nothing else this
  // function does for Staff changes.
  if (document.documentType === DOCUMENT_TYPES.MEDICAL_SUPPORTING_DOCUMENT && !hasBroadAccess) {
    throw new AuthorizationError("You are not authorized to view this document.");
  }
  if (!hasBroadAccess) {
    if (!requestingUser.assignedBarangayId || requestingUser.assignedBarangayId !== senior.barangayId.toString()) {
      throw new AuthorizationError("You are not authorized to view this document.");
    }
  }

  // Resolved via the same project-root-anchored UPLOAD_DIR that the upload
  // middleware writes to (utils/storage.js) — not a path re-derived from
  // process.cwd(), which is what previously let uploads and downloads
  // silently disagree on where a file actually lives.
  const filePath = resolveStoragePath(document.storageKey);
  if (!fs.existsSync(filePath)) {
    throw new NotFoundError("The document file could not be found on the server.");
  }

  return { filePath, fileName: document.fileName, mimeType: document.mimeType };
}

function assertBarangayScope(verification, requestingUser) {
  const hasBroadAccess = [ROLES.ADMIN, ROLES.LGU_OSCA].includes(requestingUser.role);
  if (hasBroadAccess) return;

  const scopedBarangayId = requestingUser.assignedBarangayId;
  const verificationBarangayId = verification.barangayId._id
    ? verification.barangayId._id.toString()
    : verification.barangayId.toString();

  if (!scopedBarangayId || scopedBarangayId !== verificationBarangayId) {
    throw new AuthorizationError("You are not authorized to manage registrations outside your assigned barangay.");
  }
}

export async function approveVerification(verificationId, requestingUser, { remarks } = {}) {
  const session = await mongoose.startSession();
  let result;
  let guardianActivated = null;
  try {
    await session.withTransaction(async () => {
      const verification = await Verification.findById(verificationId).session(session);
      if (!verification) throw new NotFoundError("Verification record not found.");

      assertBarangayScope(verification, requestingUser);

      if (verification.status !== VERIFICATION_STATUS.PENDING) {
        throw new ConflictError("This registration has already been reviewed.");
      }

      const senior = await Senior.findById(verification.seniorId).session(session);
      if (!senior) throw new NotFoundError("Associated senior profile not found.");

      verification.status = VERIFICATION_STATUS.APPROVED;
      verification.reviewedBy = requestingUser.id;
      verification.reviewedAt = new Date();
      verification.remarks = remarks || "";
      await verification.save({ session });

      await User.findByIdAndUpdate(
        senior.userId,
        { status: ACCOUNT_STATUS.ACTIVE },
        { session }
      );

      // Approving a Senior's registration also confirms the authorization
      // documents for their Guardian/Authorized Representative, if one was
      // submitted, and — since registration.service.js now creates the
      // Guardian's login account up front (PENDING_VERIFICATION) instead
      // of Admin creating it later — this is also the one place that
      // activates it. Admin verification owns approval/activation only;
      // it no longer owns account creation (see admin.service.js's
      // createGuardianAccount, now a legacy/recovery path for Guardian
      // records that predate this change and never got a userId here).
      if (senior.guardianId) {
        const guardian = await Guardian.findByIdAndUpdate(
          senior.guardianId,
          { authorizationConfirmed: true },
          { session, new: true }
        );
        if (guardian?.userId) {
          await User.findByIdAndUpdate(
            guardian.userId,
            { status: ACCOUNT_STATUS.ACTIVE },
            { session }
          );
          guardianActivated = { guardianId: guardian._id, guardianUserId: guardian.userId };
        }
      }

      result = verification;
    });
  } finally {
    await session.endSession();
  }

  // Notification creation happens only after the transaction has
  // resolved AND the session has ended — never inside withTransaction,
  // never passed the session. Mirrors the discipline documented in
  // benefitApplication.service.js for avoiding "Use of expired
  // sessions is not permitted": notifying the Senior isn't part of
  // what must be atomic with the approval itself, so it must not be
  // coupled to a session that may already be ending.
  await notifyVerificationOutcome(result, {
    eventType: "VERIFICATION_APPROVED",
    title: "Registration Verified",
    message: "Your SENIORCARE registration has been verified and approved. Your account is now active.",
  });

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.APPROVE,
    module: AUDIT_MODULES.VERIFICATION,
    entityType: "Senior",
    entityId: result.seniorId,
    description: `${requestingUser.role} approved a Senior registration.`,
    metadata: { verificationId: result._id, statusFrom: VERIFICATION_STATUS.PENDING, statusTo: VERIFICATION_STATUS.APPROVED },
    barangayId: result.barangayId,
  });

  if (guardianActivated) {
    await safeCreateAuditLog({
      actor: requestingUser,
      action: AUDIT_ACTIONS.ACTIVATE,
      module: AUDIT_MODULES.GUARDIAN,
      entityType: "Guardian",
      entityId: guardianActivated.guardianId,
      description: `${requestingUser.role} activated a Guardian account as part of Senior verification approval.`,
      metadata: { guardianUserId: guardianActivated.guardianUserId, statusTo: ACCOUNT_STATUS.ACTIVE },
      barangayId: result.barangayId,
    });
  }

  return result;
}

async function notifyVerificationOutcome(verification, { eventType, title, message }) {
  const senior = await Senior.findById(verification.seniorId).select("userId");
  if (!senior) return;
  await createNotification({
    recipientId: senior.userId,
    type: NOTIFICATION_TYPE.DOCUMENT,
    eventType,
    title,
    message,
    relatedEntityType: "Verification",
    relatedEntityId: verification._id,
  });
}

export async function rejectVerification(verificationId, requestingUser, { reason }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const verification = await Verification.findById(verificationId).session(session);
      if (!verification) throw new NotFoundError("Verification record not found.");

      assertBarangayScope(verification, requestingUser);

      if (verification.status !== VERIFICATION_STATUS.PENDING) {
        throw new ConflictError("This registration has already been reviewed.");
      }

      const senior = await Senior.findById(verification.seniorId).session(session);
      if (!senior) throw new NotFoundError("Associated senior profile not found.");

      verification.status = VERIFICATION_STATUS.REJECTED;
      verification.reviewedBy = requestingUser.id;
      verification.reviewedAt = new Date();
      verification.rejectionReason = reason;
      await verification.save({ session });

      await User.findByIdAndUpdate(
        senior.userId,
        { status: ACCOUNT_STATUS.REJECTED },
        { session }
      );

      // A Guardian account created during registration (see
      // registration.service.js) must never become an active login if
      // the Senior's registration it belongs to is rejected — it was
      // only ever PENDING_VERIFICATION, so flip it to REJECTED the same
      // way the Senior's own account is rejected above.
      if (senior.guardianId) {
        const guardian = await Guardian.findById(senior.guardianId).session(session);
        if (guardian?.userId) {
          await User.findByIdAndUpdate(
            guardian.userId,
            { status: ACCOUNT_STATUS.REJECTED },
            { session }
          );
        }
      }

      result = verification;
    });
  } finally {
    await session.endSession();
  }

  await notifyVerificationOutcome(result, {
    eventType: "VERIFICATION_REJECTED",
    title: "Registration Rejected",
    message: `Your SENIORCARE registration was rejected. Reason: ${reason}`,
  });

  await safeCreateAuditLog({
    actor: requestingUser,
    action: AUDIT_ACTIONS.REJECT,
    module: AUDIT_MODULES.VERIFICATION,
    entityType: "Senior",
    entityId: result.seniorId,
    description: `${requestingUser.role} rejected a Senior registration.`,
    metadata: { verificationId: result._id, statusFrom: VERIFICATION_STATUS.PENDING, statusTo: VERIFICATION_STATUS.REJECTED, reason },
    barangayId: result.barangayId,
  });

  return result;
}
