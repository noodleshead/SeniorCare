import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import Document from "../models/Document.js";
import {
  MEDICAL_VERIFICATION_STATUS,
  ILLNESS_CLASSIFICATION,
  ILLNESS_PRIORITY,
  HOME_VISIT_STATUS,
  DOCUMENT_TYPES,
  ACCOUNT_STATUS,
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  NOTIFICATION_TYPE,
} from "../utils/constants.js";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import { createNotification } from "./notification.service.js";

/**
 * Phase 5 — Admin Medical Verification. Deliberately extends the Senior
 * document Phase 3/4 already use for medical data (hasMedicalCondition,
 * medicalConditionId, medicalVerificationStatus, plus this phase's own
 * medicalClassification/medicalPriorityLevel/homeVisit* fields — see
 * models/Senior.js) rather than a separate "MedicalVerification"
 * collection: there is exactly one medical record per Senior, so a
 * second collection would only add a join for no benefit and risk the
 * "duplicate classification/priority in multiple unrelated collections"
 * this module explicitly warns against.
 *
 * ROLE BOUNDARY: every exported function here assumes ADMIN — enforced
 * in the route layer (medicalVerification.routes.js), not re-checked
 * here, same convention as illness.service.js / adminReports.service.js.
 * Barangay Staff has no function in this file at all — Phase 6 owns the
 * actual Home Visit; this phase only records the Admin's decision that
 * one is (or isn't) required.
 */

const LIST_PROJECTION =
  "firstName lastName seniorCitizenId barangayId medicalConditionId medicalVerificationStatus medicalClassification medicalPriorityLevel homeVisitStatus";

function buildFilter({ status, classification, priority, homeVisit, search }) {
  // Only Seniors who actually declared a medical condition are ever
  // relevant here — this is a medical *verification* queue, not a
  // general Senior list (that's Admin User Management, Phase 2).
  const filter = { hasMedicalCondition: true };
  if (status) filter.medicalVerificationStatus = status;
  if (classification) filter.medicalClassification = classification;
  if (priority) filter.medicalPriorityLevel = priority;
  if (homeVisit === "NOT_DECIDED") filter.homeVisitStatus = HOME_VISIT_STATUS.PENDING_DECISION;
  else if (homeVisit === "YES") filter.homeVisitStatus = HOME_VISIT_STATUS.REQUIRED;
  else if (homeVisit === "NO") filter.homeVisitStatus = HOME_VISIT_STATUS.NOT_REQUIRED;
  if (search && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(term, "i");
    filter.$or = [{ firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }];
  }
  return filter;
}

/**
 * Server-side paginated/filtered/searched list for the Admin Medical
 * Verification page. Admin is system-wide (module requirement §21) —
 * no barangay scoping is applied here, unlike Barangay-Staff-facing
 * endpoints elsewhere in this project.
 */
export async function listMedicalVerifications({ status, classification, priority, homeVisit, search, page = 1, pageSize = 20 } = {}) {
  const filter = buildFilter({ status, classification, priority, homeVisit, search });
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    Senior.find(filter)
      .select(LIST_PROJECTION)
      .populate("barangayId", "name")
      .populate("medicalConditionId", "name")
      .sort({ medicalVerificationStatus: 1, updatedAt: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize),
    Senior.countDocuments(filter),
  ]);

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
 * Full review detail for one Senior's medical submission. Emits
 * MEDICAL_VERIFICATION_STARTED the first time a still-PENDING record is
 * opened (see the comment below on why this is detected here rather
 * than as a separate persisted "in review" state).
 */
export async function getMedicalVerificationDetail(seniorId, requestingUser) {
  const senior = await Senior.findById(seniorId)
    .populate("barangayId", "name municipality province")
    .populate("medicalConditionId", "name classification priorityLevel");
  if (!senior) throw new NotFoundError("Senior not found.");
  if (!senior.hasMedicalCondition) {
    throw new NotFoundError("This Senior has no declared medical condition to review.");
  }

  const document = await Document.findOne({ seniorId: senior._id, documentType: DOCUMENT_TYPES.MEDICAL_SUPPORTING_DOCUMENT }).select(
    "-storageKey"
  );

  // "Started" is inferred (still PENDING = no Admin has acted on it yet)
  // rather than tracked as its own persisted status, so opening the
  // same pending record twice before deciding doesn't create a
  // misleading intermediate state — the Audit Log still gets one
  // STARTED entry per genuine review session via this best-effort,
  // non-blocking log (never awaited into the response).
  if (senior.medicalVerificationStatus === MEDICAL_VERIFICATION_STATUS.PENDING) {
    safeCreateAuditLog({
      actor: requestingUser,
      action: AUDIT_ACTIONS.MEDICAL_VERIFICATION_STARTED,
      module: AUDIT_MODULES.MEDICAL_VERIFICATION,
      entityType: "Senior",
      entityId: senior._id,
      description: `${requestingUser.role} opened a pending medical submission for review.`,
      barangayId: senior.barangayId?._id || senior.barangayId,
    });
  }

  return { senior, document };
}

async function notifySeniorAndGuardians(senior, { eventType, title, message }) {
  const recipientIds = [senior.userId];
  const guardianRecords = await Guardian.find({ seniorId: senior._id, authorizationConfirmed: true }).select("userId");
  for (const g of guardianRecords) {
    if (g.userId) recipientIds.push(g.userId);
  }
  await Promise.all(
    recipientIds.map((recipientId) =>
      createNotification({
        recipientId,
        type: NOTIFICATION_TYPE.MEDICAL,
        eventType,
        title,
        message,
        relatedEntityType: "Senior",
        relatedEntityId: senior._id,
      })
    )
  );
}

/**
 * The core Phase 5 action: record an Admin's medical verification
 * decision (confirm/override classification+priority, verify/reject/
 * request revision, and — for VERIFIED outcomes — the Home Visit
 * decision). One call does the whole decision atomically; there is no
 * separate "save classification" vs. "save home visit" step, so a
 * half-recorded decision can never exist.
 *
 * PREVENTING DOUBLE VERIFICATION (module requirement §25): only records
 * already PENDING or REVISION_REQUIRED may be acted on. A VERIFIED or
 * REJECTED record is final for this phase — there is no "undo" or
 * "re-verify" path here; correcting a finalized decision would need its
 * own explicit, audited Admin action, which Phase 5 does not build.
 */
export async function recordMedicalVerificationDecision(seniorId, data, requestingUser) {
  const senior = await Senior.findById(seniorId).populate("medicalConditionId", "name classification priorityLevel");
  if (!senior) throw new NotFoundError("Senior not found.");
  if (!senior.hasMedicalCondition) {
    throw new ValidationError("This Senior has no declared medical condition to verify.");
  }
  if (![MEDICAL_VERIFICATION_STATUS.PENDING, MEDICAL_VERIFICATION_STATUS.REVISION_REQUIRED].includes(senior.medicalVerificationStatus)) {
    throw new ConflictError(
      `This medical submission is already ${senior.medicalVerificationStatus} and cannot be re-verified through this action.`
    );
  }

  const wasPending = senior.medicalVerificationStatus === MEDICAL_VERIFICATION_STATUS.PENDING;
  const { decision, classification, priorityLevel, overrideReason, remarks, homeVisitRequired, homeVisitRemarks } = data;

  const previousClassification = senior.medicalClassification;
  const previousPriority = senior.medicalPriorityLevel;
  const systemClassification = senior.medicalConditionId?.classification ?? null;
  const systemPriority = senior.medicalConditionId?.priorityLevel ?? null;

  const overrideEvents = [];

  if (decision === MEDICAL_VERIFICATION_STATUS.VERIFIED) {
    // Confirming (or overriding) the illness's system-generated values —
    // module requirement §13: Admin reviews the Senior's *submitted*
    // illness, never assigns an unrelated one; only classification/
    // priority for that same illness can be confirmed or overridden.
    if (classification !== ILLNESS_CLASSIFICATION.CRITICAL && classification !== ILLNESS_CLASSIFICATION.NON_CRITICAL) {
      throw new ValidationError("Please confirm or select a valid classification.", { classification: "Required." });
    }
    if (priorityLevel !== ILLNESS_PRIORITY.HIGH && priorityLevel !== ILLNESS_PRIORITY.NORMAL) {
      throw new ValidationError("Please confirm or select a valid priority level.", { priorityLevel: "Required." });
    }

    const classificationOverridden = systemClassification !== null && classification !== systemClassification;
    const priorityOverridden = systemPriority !== null && priorityLevel !== systemPriority;
    if ((classificationOverridden || priorityOverridden) && !overrideReason?.trim()) {
      throw new ValidationError("An override reason is required when changing the system-generated classification or priority.", {
        overrideReason: "Required when overriding the system classification/priority.",
      });
    }

    // Home Visit — required (Yes/No + remarks) whenever the FINAL
    // (post-override) values are Critical/High; optional otherwise,
    // per module requirement §16/§17.
    const isCriticalOrHigh = classification === ILLNESS_CLASSIFICATION.CRITICAL || priorityLevel === ILLNESS_PRIORITY.HIGH;
    if (isCriticalOrHigh) {
      if (typeof homeVisitRequired !== "boolean") {
        throw new ValidationError("A Home Visit decision (Yes/No) is required for Critical or High Priority cases.", {
          homeVisitRequired: "Required for Critical/High Priority cases.",
        });
      }
      if (!homeVisitRemarks?.trim()) {
        throw new ValidationError("Home Visit remarks are required for Critical or High Priority cases.", {
          homeVisitRemarks: "Required for Critical/High Priority cases.",
        });
      }
    }

    senior.medicalClassification = classification;
    senior.medicalPriorityLevel = priorityLevel;
    senior.medicalVerificationStatus = MEDICAL_VERIFICATION_STATUS.VERIFIED;
    senior.medicalVerificationRemarks = (remarks || "").trim();
    senior.medicalVerifiedBy = requestingUser.id;
    senior.medicalVerifiedAt = new Date();

    if (typeof homeVisitRequired === "boolean") {
      senior.homeVisitStatus = homeVisitRequired ? HOME_VISIT_STATUS.REQUIRED : HOME_VISIT_STATUS.NOT_REQUIRED;
      senior.homeVisitRemarks = (homeVisitRemarks || "").trim();
      senior.homeVisitDecidedBy = requestingUser.id;
      senior.homeVisitDecidedAt = new Date();
    } else {
      senior.homeVisitStatus = HOME_VISIT_STATUS.PENDING_DECISION;
    }

    if (classificationOverridden) {
      overrideEvents.push({
        action: AUDIT_ACTIONS.MEDICAL_CLASSIFICATION_OVERRIDDEN,
        metadata: { previous: systemClassification, new: classification, reason: overrideReason.trim() },
      });
    }
    if (priorityOverridden) {
      overrideEvents.push({
        action: AUDIT_ACTIONS.MEDICAL_PRIORITY_OVERRIDDEN,
        metadata: { previous: systemPriority, new: priorityLevel, reason: overrideReason.trim() },
      });
    }
  } else if (decision === MEDICAL_VERIFICATION_STATUS.REJECTED || decision === MEDICAL_VERIFICATION_STATUS.REVISION_REQUIRED) {
    if (!remarks?.trim()) {
      throw new ValidationError(
        decision === MEDICAL_VERIFICATION_STATUS.REJECTED
          ? "A reason is required to reject a medical submission."
          : "A remark is required when requesting revision.",
        { remarks: "Required." }
      );
    }
    // A rejected/revision-required submission has nothing to confirm a
    // Home Visit against yet — classification/priority/Home Visit are
    // left exactly as they were (untouched, still null on a first
    // submission) until a future VERIFIED decision sets them.
    senior.medicalVerificationStatus = decision;
    senior.medicalVerificationRemarks = remarks.trim();
  } else {
    throw new ValidationError("Please select a valid verification decision.", { decision: "Required." });
  }

  await senior.save();

  const auditBase = {
    actor: requestingUser,
    entityType: "Senior",
    entityId: senior._id,
    barangayId: senior.barangayId,
  };

  if (wasPending) {
    await safeCreateAuditLog({
      ...auditBase,
      action: AUDIT_ACTIONS.MEDICAL_VERIFICATION_STARTED,
      module: AUDIT_MODULES.MEDICAL_VERIFICATION,
      description: `${requestingUser.role} began reviewing a pending medical submission.`,
    });
  }

  const decisionActionMap = {
    [MEDICAL_VERIFICATION_STATUS.VERIFIED]: [AUDIT_ACTIONS.MEDICAL_VERIFICATION_CONFIRMED, "confirmed"],
    [MEDICAL_VERIFICATION_STATUS.REJECTED]: [AUDIT_ACTIONS.MEDICAL_VERIFICATION_REJECTED, "rejected"],
    [MEDICAL_VERIFICATION_STATUS.REVISION_REQUIRED]: [AUDIT_ACTIONS.MEDICAL_REVISION_REQUESTED, "requested revision for"],
  };
  const [decisionAction, decisionVerb] = decisionActionMap[decision];
  await safeCreateAuditLog({
    ...auditBase,
    action: decisionAction,
    module: AUDIT_MODULES.MEDICAL_VERIFICATION,
    description: `${requestingUser.role} ${decisionVerb} a Senior's medical submission.`,
    metadata: { illnessId: senior.medicalConditionId?._id, remarks: senior.medicalVerificationRemarks || undefined },
  });

  for (const event of overrideEvents) {
    await safeCreateAuditLog({
      ...auditBase,
      action: event.action,
      module: AUDIT_MODULES.MEDICAL_VERIFICATION,
      description: `${requestingUser.role} overrode the system-generated ${event.action === AUDIT_ACTIONS.MEDICAL_CLASSIFICATION_OVERRIDDEN ? "classification" : "priority"}.`,
      metadata: event.metadata,
    });
  }

  if (decision === MEDICAL_VERIFICATION_STATUS.VERIFIED && typeof homeVisitRequired === "boolean") {
    await safeCreateAuditLog({
      ...auditBase,
      action: AUDIT_ACTIONS.HOME_VISIT_DECISION_RECORDED,
      module: AUDIT_MODULES.MEDICAL_VERIFICATION,
      description: `${requestingUser.role} recorded a Home Visit decision: ${homeVisitRequired ? "Required" : "Not required"}.`,
      metadata: { homeVisitRequired, remarks: senior.homeVisitRemarks || undefined },
    });
  }

  // Notifications — best-effort, after the write, same non-blocking
  // convention used throughout this project (see auditLog.service.js's
  // own error-handling rationale; createNotification already handles
  // its own duplicate-key race internally).
  try {
    if (decision === MEDICAL_VERIFICATION_STATUS.VERIFIED) {
      await notifySeniorAndGuardians(senior, {
        eventType: "MEDICAL_VERIFIED",
        title: "Medical Information Verified",
        message: "Your submitted medical information has been reviewed and verified.",
      });
      if (senior.homeVisitStatus === HOME_VISIT_STATUS.REQUIRED) {
        await notifySeniorAndGuardians(senior, {
          eventType: "MEDICAL_HOME_VISIT_REQUIRED",
          title: "Home Visit Required",
          message: "Based on your medical information, a home visit from your barangay may be scheduled. You will be informed of further details.",
        });
      }
    } else if (decision === MEDICAL_VERIFICATION_STATUS.REJECTED) {
      await notifySeniorAndGuardians(senior, {
        eventType: "MEDICAL_REJECTED",
        title: "Medical Submission Not Accepted",
        message: `Your submitted medical information was not accepted. Reason: ${senior.medicalVerificationRemarks}`,
      });
    } else {
      await notifySeniorAndGuardians(senior, {
        eventType: "MEDICAL_REVISION_REQUIRED",
        title: "Medical Information Needs Revision",
        message: `Please review and resubmit your medical information. Remarks: ${senior.medicalVerificationRemarks}`,
      });
    }
  } catch (err) {
    console.error("[medicalVerification] failed to send notification:", err);
  }

  return senior;
}
