import mongoose from "mongoose";
import BenefitApplication from "../models/BenefitApplication.js";
import BenefitProgram from "../models/BenefitProgram.js";
import Document from "../models/Document.js";
import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import User from "../models/User.js";
import {
  APPLICATION_STATUS,
  ACCOUNT_STATUS,
  DOCUMENT_TYPES,
  ROLES,
  NOTIFICATION_TYPE,
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  HOME_VISIT_STATUS,
  BARANGAY_VERIFICATION_STATUS,
  HOME_VISIT_EXECUTION_STATUS,
  BARANGAY_ENDORSEMENT_DECISION,
} from "../utils/constants.js";
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from "../utils/errors.js";
import { assertCanAccessBarangay, hasBroadBarangayAccess } from "../utils/barangayScope.js";
import { resolveActingSenior } from "../utils/guardianAccess.js";
import { computeEligibility } from "./benefitProgram.service.js";
import { createNotification } from "./notification.service.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import { isApplicationSubmissionEnabled } from "./systemSettings.service.js";

function auditApplicationAction(application, requestingUser, action, description, statusTo, extra = {}, module = AUDIT_MODULES.BENEFITS) {
  return safeCreateAuditLog({
    actor: requestingUser,
    action,
    module,
    entityType: "BenefitApplication",
    entityId: application._id,
    description,
    metadata: { statusTo, seniorId: application.seniorId, programId: application.programId, ...extra },
    barangayId: application.barangayId,
  });
}

const SENIOR_SUMMARY_FIELDS = "firstName lastName seniorCitizenId barangayId";

// Statuses that count as "an existing application already occupies this
// program for this senior" — a new one may not be started while one of
// these is in flight. REJECTED and CLAIMED are terminal-for-this-round,
// so a fresh application is allowed after either.
const ACTIVE_APPLICATION_STATUSES = [
  APPLICATION_STATUS.SUBMITTED,
  APPLICATION_STATUS.UNDER_REVIEW,
  APPLICATION_STATUS.ENDORSED,
  APPLICATION_STATUS.APPROVED,
  APPLICATION_STATUS.RELEASED,
];

function pushHistory(application, { toStatus, requestingUser, remarks }) {
  application.statusHistory.push({
    fromStatus: application.status,
    toStatus,
    performedBy: requestingUser.id,
    role: requestingUser.role,
    remarks: remarks || "",
    at: new Date(),
  });
  application.status = toStatus;
}

/**
 * Senior/Guardian applies for a benefit program.
 *
 * `requestingUser` is resolved to an acting Senior via
 * `resolveActingSenior` — the caller never supplies a bare seniorId as
 * authorization; an optional one may be passed only to disambiguate
 * which of a Guardian's own authorized Seniors this is for (see
 * utils/guardianAccess.js). For SENIOR_CITIZEN this is exactly today's
 * behavior — the parameter is ignored for that role.
 */
export async function applyForBenefit(
  requestingUser,
  { benefitProgramId },
  uploadedFiles = [],
  documentTypes = [],
  requestedSeniorId
) {
  // System Settings' applications.enabled toggle (module 15) — gates
  // NEW submissions only; Staff can still review/approve/reject/release
  // applications already in the pipeline while this is OFF (see this
  // module's other exports, none of which check this flag).
  if (!(await isApplicationSubmissionEnabled())) {
    throw new ValidationError("New benefit/assistance applications are currently disabled by the Administrator.");
  }

  const senior = await resolveActingSenior(requestingUser, requestedSeniorId);

  const seniorUser = await User.findById(senior.userId);
  if (!seniorUser || seniorUser.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ValidationError("Only an active, verified Senior Citizen account may apply for benefits.");
  }

  const program = await BenefitProgram.findById(benefitProgramId);
  if (!program) throw new NotFoundError("Benefit program not found.");

  const { eligible, reasons } = computeEligibility(senior, program);
  if (!eligible) {
    throw new ValidationError("You are not currently eligible for this program.", { reasons });
  }

  const existing = await BenefitApplication.findOne({
    seniorId: senior._id,
    benefitProgramId: program._id,
    status: { $in: ACTIVE_APPLICATION_STATUSES },
  });
  if (existing) {
    throw new ConflictError("You already have an active application for this program.");
  }

  if (program.requiredDocumentTypes.length > 0) {
    const providedTypes = new Set(documentTypes.filter(Boolean));
    const missing = program.requiredDocumentTypes.filter((type) => !providedTypes.has(type));
    if (missing.length > 0) {
      throw new ValidationError("Please upload all required supporting documents.", {
        missingDocumentTypes: missing,
      });
    }
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [application] = await BenefitApplication.create(
        [
          {
            seniorId: senior._id,
            benefitProgramId: program._id,
            barangayId: senior.barangayId,
            appliedBy: requestingUser.id,
            appliedByRole: requestingUser.role,
            status: APPLICATION_STATUS.SUBMITTED,
            statusHistory: [
              {
                fromStatus: null,
                toStatus: APPLICATION_STATUS.SUBMITTED,
                performedBy: requestingUser.id,
                role: requestingUser.role,
                remarks: "",
                at: new Date(),
              },
            ],
          },
        ],
        { session }
      );

      if (uploadedFiles.length > 0) {
        const docs = uploadedFiles.map((file, i) => ({
          seniorId: senior._id,
          verificationId: null,
          documentType: documentTypes[i] || DOCUMENT_TYPES.BENEFIT_SUPPORTING_DOCUMENT,
          fileName: file.originalname,
          storageKey: file.filename,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: requestingUser.id,
        }));
        const created = await Document.insertMany(docs, { session });
        application.documentIds = created.map((d) => d._id);
        await application.save({ session });
      }

      result = application;
    });
    // IMPORTANT: must be awaited *inside* this try block. `result` was
    // created with { session } inside the transaction, so Mongoose binds
    // that session to the document. If this populate() call is returned
    // unawaited, the `finally` below runs (and ends the session) before
    // the populate query actually executes, producing
    // "Use of expired sessions is not permitted".
    result = await result.populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });
    return result;
  } finally {
    await session.endSession();
  }
}

/** The acting Senior/Guardian's own application history. */
export async function listMyApplications(requestingUser, requestedSeniorId) {
  const senior = await resolveActingSenior(requestingUser, requestedSeniorId);
  return BenefitApplication.find({ seniorId: senior._id })
    .populate({ path: "benefitProgramId" })
    .sort({ createdAt: -1 });
}

/** A single application, but only if it belongs to the acting Senior/Guardian. */
export async function getMyApplicationById(applicationId, requestingUser, requestedSeniorId) {
  const senior = await resolveActingSenior(requestingUser, requestedSeniorId);
  const application = await BenefitApplication.findOne({ _id: applicationId, seniorId: senior._id })
    .populate({ path: "benefitProgramId" })
    .populate({ path: "documentIds" });
  if (!application) throw new NotFoundError("Benefit application not found.");
  return application;
}

/** Staff/Admin/LGU-OSCA application list, barangay-scoped for BARANGAY_STAFF. */
export async function listApplications(requestingUser, { status, benefitProgramId, barangayId, search, from, to } = {}) {
  const query = {};

  if (hasBroadBarangayAccess(requestingUser.role)) {
    if (barangayId) query.barangayId = barangayId;
  } else {
    if (!requestingUser.assignedBarangayId) return [];
    query.barangayId = requestingUser.assignedBarangayId;
  }

  if (status) query.status = status;
  if (benefitProgramId) query.benefitProgramId = benefitProgramId;
  // Optional date-range filter (Phase 7's OSCA queue date filter) —
  // additive only; every existing caller that doesn't pass from/to
  // behaves exactly as before.
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  if (search && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchingSeniors = await Senior.find({
      $or: [{ firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }],
    }).select("_id");
    query.seniorId = { $in: matchingSeniors.map((s) => s._id) };
  }

  return BenefitApplication.find(query)
    .populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS })
    .populate({ path: "benefitProgramId" })
    .sort({ createdAt: -1 });
}

/**
 * Notifies the Senior who applied — resolved via the application's own
 * seniorId, never trusted from anywhere else. Called only after
 * `application.save()` has already committed (none of these status
 * transitions run inside a transaction), so there is no session-safety
 * concern here.
 */
async function notifyApplicant(application, { eventType, title, message }) {
  const senior = await Senior.findById(application.seniorId).select("userId");
  if (!senior) return;
  await createNotification({
    recipientId: senior.userId,
    type: NOTIFICATION_TYPE.BENEFIT,
    eventType,
    title,
    message,
    relatedEntityType: "BenefitApplication",
    relatedEntityId: application._id,
  });
}

/**
 * Phase 7 bridge to Phase 6's Senior.barangayReview — module requirement
 * Step 9: OSCA approval must confirm Barangay verification is complete,
 * any Admin-required Home Visit is completed, and Barangay endorsement
 * exists. Phase 6 built that state on the Senior document, independent
 * of BenefitApplication's own ENDORSED status (which only reflects a
 * Barangay Staff member endorsing this specific application, via
 * endorseApplication above) — this check is what actually connects the
 * two. Only enforced when the Senior went through that pipeline at all
 * (hasMedicalCondition); a Senior with no medical condition never enters
 * Phase 5/6 and has nothing here to check.
 */
function assertBarangayReviewReadyForOsca(senior) {
  if (!senior.hasMedicalCondition) return;
  const review = senior.barangayReview || {};
  if (review.verificationStatus !== BARANGAY_VERIFICATION_STATUS.VERIFIED) {
    throw new ValidationError("This Senior's Barangay verification must be completed before OSCA approval.");
  }
  if (senior.homeVisitStatus === HOME_VISIT_STATUS.REQUIRED && review.homeVisit?.status !== HOME_VISIT_EXECUTION_STATUS.COMPLETED) {
    throw new ValidationError("This Senior's required Home Visit must be completed before OSCA approval.");
  }
  if (review.endorsement?.decision !== BARANGAY_ENDORSEMENT_DECISION.ENDORSED) {
    throw new ValidationError("This Senior must have a Barangay Endorsement before OSCA approval.");
  }
}

/** Notifies every active Barangay Staff account assigned to an application's barangay — used when OSCA returns it for revision. */
async function notifyBarangayStaff(application, { eventType, title, message }) {
  const staff = await User.find({ role: ROLES.BARANGAY_STAFF, assignedBarangayId: application.barangayId, status: ACCOUNT_STATUS.ACTIVE }).select(
    "_id"
  );
  await Promise.all(
    staff.map((s) =>
      createNotification({
        recipientId: s._id,
        type: NOTIFICATION_TYPE.BENEFIT,
        eventType,
        title,
        message,
        relatedEntityType: "BenefitApplication",
        relatedEntityId: application._id,
      })
    )
  );
}

async function loadApplicationForAction(applicationId, requestingUser) {
  const application = await BenefitApplication.findById(applicationId);
  if (!application) throw new NotFoundError("Benefit application not found.");
  assertCanAccessBarangay(requestingUser, application.barangayId);
  return application;
}

export async function getApplicationById(applicationId, requestingUser) {
  const application = await BenefitApplication.findById(applicationId)
    .populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS })
    .populate({ path: "benefitProgramId" })
    .populate({ path: "documentIds" });
  if (!application) throw new NotFoundError("Benefit application not found.");
  assertCanAccessBarangay(requestingUser, application.barangayId);
  return application;
}

/** Barangay Staff (or Admin/LGU-OSCA) marks a submitted application as under active review. */
export async function startReview(applicationId, requestingUser) {
  const application = await loadApplicationForAction(applicationId, requestingUser);
  if (application.status !== APPLICATION_STATUS.SUBMITTED) {
    throw new ConflictError("Only a newly submitted application can be moved to review.");
  }
  pushHistory(application, { toStatus: APPLICATION_STATUS.UNDER_REVIEW, requestingUser });
  await application.save();
  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_UNDER_REVIEW",
    title: "Application Under Review",
    message: "Your benefit application is now under review.",
  });
  return application;
}

/** Barangay Staff (or Admin/LGU-OSCA) endorses a reviewed application onward to OSCA. */
export async function endorseApplication(applicationId, requestingUser, { remarks } = {}) {
  const application = await loadApplicationForAction(applicationId, requestingUser);
  // REVISION_REQUIRED added (Phase 7) — lets Barangay Staff re-endorse an
  // application OSCA sent back, once whatever OSCA flagged is addressed.
  if (![APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.REVISION_REQUIRED].includes(application.status)) {
    throw new ConflictError("Only a submitted, under-review, or revision-requested application can be endorsed.");
  }
  application.reviewedBy = requestingUser.id;
  application.reviewedAt = new Date();
  application.remarks = remarks || "";
  pushHistory(application, { toStatus: APPLICATION_STATUS.ENDORSED, requestingUser, remarks });
  await application.save();
  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_ENDORSED",
    title: "Application Endorsed",
    message: "Your benefit application has been endorsed for OSCA review.",
  });
  return application;
}

/**
 * Rejects an application. Barangay Staff (their own barangay) may
 * reject at the SUBMITTED/UNDER_REVIEW stage; once ENDORSED, only
 * ADMIN/LGU_OSCA (the OSCA review stage) may reject it.
 */
export async function rejectApplication(applicationId, requestingUser, { reason }) {
  const application = await loadApplicationForAction(applicationId, requestingUser);

  if (![APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.ENDORSED].includes(
    application.status
  )) {
    throw new ConflictError("This application is no longer at a stage that can be rejected.");
  }

  if (application.status === APPLICATION_STATUS.ENDORSED && !hasBroadBarangayAccess(requestingUser.role)) {
    throw new AuthorizationError("Only Admin or LGU-OSCA may reject an application at the OSCA review stage.");
  }
  // Captured BEFORE the mutation below — a rejection FROM ENDORSED is the
  // OSCA final decision (the role check above already restricts that
  // specific transition to Admin/LGU-OSCA); logged distinctly from an
  // earlier Barangay-stage rejection, which keeps the existing generic
  // REJECT/BENEFITS audit entry unchanged.
  const isOscaStage = application.status === APPLICATION_STATUS.ENDORSED;

  application.rejectionReason = reason;
  pushHistory(application, { toStatus: APPLICATION_STATUS.REJECTED, requestingUser, remarks: reason });
  await application.save();
  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_REJECTED",
    title: "Application Rejected",
    message: `Your benefit application was rejected. Reason: ${reason}`,
  });
  await auditApplicationAction(
    application,
    requestingUser,
    isOscaStage ? AUDIT_ACTIONS.OSCA_APPLICATION_REJECTED : AUDIT_ACTIONS.REJECT,
    `${requestingUser.role} rejected a benefit application.`,
    APPLICATION_STATUS.REJECTED,
    { reason },
    isOscaStage ? AUDIT_MODULES.OSCA_REVIEW : AUDIT_MODULES.BENEFITS
  );
  return application;
}

/**
 * Phase 7 — OSCA's third decision option (module requirement Step 8/11):
 * return an ENDORSED application to the Barangay instead of
 * approving/rejecting it outright. Never modifies Senior data or any
 * Barangay-recorded finding (Step 11's own explicit instruction) — it
 * only changes the BenefitApplication's own status and remarks. Barangay
 * Staff can then re-endorse (see endorseApplication's extended status
 * list above) once whatever OSCA flagged is addressed.
 */
export async function requestApplicationRevision(applicationId, requestingUser, { remarks }) {
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    throw new AuthorizationError("Only Admin or LGU-OSCA may return an application for revision.");
  }
  if (!remarks?.trim()) {
    throw new ValidationError("Please explain what needs revision or clarification.", { remarks: "Required." });
  }
  const application = await loadApplicationForAction(applicationId, requestingUser);
  if (application.status !== APPLICATION_STATUS.ENDORSED) {
    throw new ConflictError("Only an endorsed application can be returned for revision.");
  }

  application.remarks = remarks.trim();
  pushHistory(application, { toStatus: APPLICATION_STATUS.REVISION_REQUIRED, requestingUser, remarks });
  application.status = APPLICATION_STATUS.REVISION_REQUIRED;
  await application.save();

  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_REVISION_REQUIRED",
    title: "Application Needs Revision",
    message: `OSCA has requested revision/clarification for your application. Remarks: ${remarks.trim()}`,
  });
  try {
    await notifyBarangayStaff(application, {
      eventType: "BENEFIT_APPLICATION_RETURNED_BY_OSCA",
      title: "OSCA Returned an Application",
      message: `OSCA returned an endorsed application for revision. Remarks: ${remarks.trim()}`,
    });
  } catch (err) {
    console.error("[benefitApplication] failed to notify Barangay Staff:", err);
  }

  await auditApplicationAction(
    application,
    requestingUser,
    AUDIT_ACTIONS.OSCA_REVISION_REQUESTED,
    `${requestingUser.role} returned a benefit application for revision/clarification.`,
    APPLICATION_STATUS.REVISION_REQUIRED,
    { remarks: remarks.trim() },
    AUDIT_MODULES.OSCA_REVIEW
  );
  return application;
}

/**
 * Rich OSCA review payload (module requirement Steps 4-7): the
 * application itself, plus the full Senior record (medical condition,
 * Phase 6 barangayReview — verification/Home-Visit/endorsement — and
 * Guardian authorization), so the review screen can show everything OSCA
 * needs without a second round of requests. getApplicationById (used by
 * Barangay Staff's own earlier-stage review) is left unchanged — this
 * extra payload is OSCA-specific.
 *
 * Fires OSCA_REVIEW_STARTED the first time an ENDORSED application is
 * opened here — the same "inferred start" pattern already used in
 * medicalVerification.service.js and barangayEndorsement.service.js
 * (no separate persisted "in review" status is introduced for this).
 */
export async function getOscaApplicationDetail(applicationId, requestingUser) {
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    throw new AuthorizationError("Only Admin or LGU-OSCA may access OSCA final review.");
  }
  const application = await getApplicationById(applicationId, requestingUser);
  const senior = await Senior.findById(application.seniorId)
    .populate("barangayId", "name municipality province")
    .populate("medicalConditionId", "name classification priorityLevel");
  const guardians = senior?.guardianId
    ? await Guardian.find({ seniorId: senior._id, authorizationConfirmed: true }).select("firstName lastName relationship mobileNumber")
    : [];

  if (application.status === APPLICATION_STATUS.ENDORSED) {
    await safeCreateAuditLog({
      actor: requestingUser,
      action: AUDIT_ACTIONS.OSCA_REVIEW_STARTED,
      module: AUDIT_MODULES.OSCA_REVIEW,
      entityType: "BenefitApplication",
      entityId: application._id,
      description: `${requestingUser.role} opened an endorsed application for OSCA final review.`,
      barangayId: application.barangayId,
    });
  }

  return { application, senior, guardians };
}

/**
 * OSCA-stage final approval — ADMIN/LGU_OSCA only, from ENDORSED.
 * Module requirement Step 9: validates the full chain (Barangay
 * verification → Home Visit if required → Barangay Endorsement) via
 * assertBarangayReviewReadyForOsca before allowing approval — not just
 * "is the BenefitApplication itself marked ENDORSED". APPROVED is
 * final-approval only; it is explicitly NOT release or claim (those
 * remain separate, unchanged, later actions — releaseApplication /
 * completeApplication below).
 */
export async function approveApplication(applicationId, requestingUser, { remarks } = {}) {
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    throw new AuthorizationError("Only Admin or LGU-OSCA may approve a benefit application.");
  }
  const application = await loadApplicationForAction(applicationId, requestingUser);
  if (application.status !== APPLICATION_STATUS.ENDORSED) {
    throw new ConflictError("Only an endorsed application can be approved.");
  }

  const senior = await Senior.findById(application.seniorId);
  if (!senior) throw new NotFoundError("Associated Senior record not found.");
  assertBarangayReviewReadyForOsca(senior);

  application.approvedBy = requestingUser.id;
  application.approvedAt = new Date();
  pushHistory(application, { toStatus: APPLICATION_STATUS.APPROVED, requestingUser, remarks });
  await application.save();
  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_APPROVED",
    title: "Application Approved",
    message: "Your benefit application has been approved.",
  });
  // OSCA-specific audit action (not the generic APPROVE used by other
  // stages elsewhere in this file) — see AUDIT_ACTIONS.OSCA_APPLICATION_APPROVED's
  // own comment in utils/constants.js.
  await auditApplicationAction(
    application,
    requestingUser,
    AUDIT_ACTIONS.OSCA_APPLICATION_APPROVED,
    `${requestingUser.role} gave final OSCA approval to a benefit application.`,
    APPLICATION_STATUS.APPROVED,
    {},
    AUDIT_MODULES.OSCA_REVIEW
  );
  return application;
}

/** Marks an approved benefit as released/handed over to the Senior. */
export async function releaseApplication(applicationId, requestingUser, { remarks } = {}) {
  const application = await loadApplicationForAction(applicationId, requestingUser);
  if (application.status !== APPLICATION_STATUS.APPROVED) {
    throw new ConflictError("Only an approved application can be released.");
  }
  application.releasedBy = requestingUser.id;
  application.releasedAt = new Date();
  pushHistory(application, { toStatus: APPLICATION_STATUS.RELEASED, requestingUser, remarks });
  await application.save();
  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_RELEASED",
    title: "Benefit Released",
    message: "Your approved benefit has been released. Please coordinate with your Barangay office to claim it.",
  });
  await auditApplicationAction(
    application,
    requestingUser,
    AUDIT_ACTIONS.RELEASE,
    `${requestingUser.role} released a benefit to a Senior.`,
    APPLICATION_STATUS.RELEASED
  );
  return application;
}

/** Final confirmation that the Senior received/claimed the released benefit. */
export async function completeApplication(applicationId, requestingUser, { remarks } = {}) {
  const application = await loadApplicationForAction(applicationId, requestingUser);
  if (application.status !== APPLICATION_STATUS.RELEASED) {
    throw new ConflictError("Only a released application can be marked as claimed/completed.");
  }
  application.completedAt = new Date();
  pushHistory(application, { toStatus: APPLICATION_STATUS.CLAIMED, requestingUser, remarks });
  await application.save();
  await notifyApplicant(application, {
    eventType: "BENEFIT_APPLICATION_CLAIMED",
    title: "Application Completed",
    message: "Your benefit application has been marked as completed. Thank you.",
  });
  await auditApplicationAction(
    application,
    requestingUser,
    AUDIT_ACTIONS.COMPLETE,
    `${requestingUser.role} marked a benefit application as completed.`,
    APPLICATION_STATUS.CLAIMED
  );
  return application;
}
