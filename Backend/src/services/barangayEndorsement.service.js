import Senior from "../models/Senior.js";
import Guardian from "../models/Guardian.js";
import User from "../models/User.js";
import {
  ACCOUNT_STATUS,
  ROLES,
  HOME_VISIT_STATUS,
  BARANGAY_VERIFICATION_STATUS,
  HOME_VISIT_EXECUTION_STATUS,
  HOME_VISIT_RESULT,
  BARANGAY_ENDORSEMENT_DECISION,
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  NOTIFICATION_TYPE,
} from "../utils/constants.js";
import { assertCanAccessBarangay, hasBroadBarangayAccess } from "../utils/barangayScope.js";
import { NotFoundError, ValidationError, ConflictError, AuthorizationError } from "../utils/errors.js";
import { safeCreateAuditLog } from "./auditLog.service.js";
import { createNotification } from "./notification.service.js";

/**
 * Phase 6 — Barangay Verification, Home Visit execution, and Barangay
 * Endorsement. Extends the `Senior.barangayReview` subdocument (see
 * models/Senior.js) rather than a new collection or a separate
 * "Application" model — there is exactly one of these per Senior, same
 * reasoning as Phase 5's medical fields.
 *
 * STRICT ROLE SEPARATION (this phase's own §Important Role Separation):
 * every write here requires `requestingUser.role === ROLES.BARANGAY_STAFF`
 * specifically — NOT staffOrAbove. Admin already had system-wide medical
 * authority in Phase 5; this phase deliberately does not extend that
 * into Barangay verification/home-visit/endorsement actions, even
 * though Admin is allowed to *view* (a system-wide, read-only
 * capability preserved below via assertCanAccessBarangay). LGU_OSCA
 * gets the same read-only treatment — full OSCA authority is Phase 7,
 * not built here.
 */

function assertBarangayStaffCanAct(requestingUser) {
  if (requestingUser.role !== ROLES.BARANGAY_STAFF) {
    throw new AuthorizationError("Only Barangay Staff may perform this action.");
  }
  if (!requestingUser.assignedBarangayId) {
    // Fail closed — module requirement Step 2. A Staff account with no
    // assignment can view/act on nothing, never "everything".
    throw new AuthorizationError("Your account has no assigned Barangay.");
  }
}

const LIST_PROJECTION =
  "firstName lastName seniorCitizenId barangayId hasMedicalCondition medicalVerificationStatus homeVisitStatus barangayReview userId";

function deriveHomeVisitFilterValue(senior) {
  // What the Barangay queue actually needs to show is "where is OUR
  // execution of this", which only exists to check once Admin required
  // a visit at all (Senior.homeVisitStatus === REQUIRED, Phase 5).
  if (senior.homeVisitStatus !== HOME_VISIT_STATUS.REQUIRED) return null;
  return senior.barangayReview?.homeVisit?.status || HOME_VISIT_EXECUTION_STATUS.PENDING;
}

function buildFilter(requestingUser, { status, homeVisit, search }) {
  const filter = {};
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId) {
      // Fail closed (Step 2): no assignment = no results, never "all
      // Seniors" — same convention analytics.service.js/pension.service.js
      // already use for an unassigned Staff account's list requests.
      filter._id = null; // never matches anything
      return filter;
    }
    filter.barangayId = requestingUser.assignedBarangayId;
  }

  // Only accounts that are already ACTIVE (registration already
  // approved — see models/Verification.js, untouched by this phase) are
  // ever relevant to Barangay endorsement; a still-PENDING_VERIFICATION
  // registration belongs to the original verification queue, not this one.
  filter["userId"] = { $exists: true };

  if (status) {
    if (status === "PENDING") {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ "barangayReview.verificationStatus": null }, { "barangayReview.verificationStatus": { $exists: false } }] },
      ];
    } else {
      filter["barangayReview.verificationStatus"] = status;
    }
  }
  if (homeVisit === "REQUIRED_PENDING") {
    filter.homeVisitStatus = HOME_VISIT_STATUS.REQUIRED;
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { "barangayReview.homeVisit.status": null },
          { "barangayReview.homeVisit.status": HOME_VISIT_EXECUTION_STATUS.PENDING },
          { "barangayReview.homeVisit.status": HOME_VISIT_EXECUTION_STATUS.FOLLOW_UP_REQUIRED },
        ],
      },
    ];
  } else if (homeVisit === "COMPLETED") {
    filter.homeVisitStatus = HOME_VISIT_STATUS.REQUIRED;
    filter["barangayReview.homeVisit.status"] = HOME_VISIT_EXECUTION_STATUS.COMPLETED;
  }
  if (search && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(term, "i");
    filter.$or = [...(filter.$or || []), { firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }];
  }
  return filter;
}

export async function listBarangayQueue(requestingUser, { status, homeVisit, search, page = 1, pageSize = 20 } = {}) {
  const filter = buildFilter(requestingUser, { status, homeVisit, search });
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [seniors, total] = await Promise.all([
    Senior.find(filter)
      .select(LIST_PROJECTION)
      .populate("barangayId", "name")
      .populate({ path: "userId", select: "status" })
      .sort({ updatedAt: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize),
    Senior.countDocuments(filter),
  ]);

  // Only ACTIVE accounts belong in this queue (see buildFilter's own
  // comment) — filtered here rather than with a $lookup/aggregate, since
  // the barangay-scoped population per page is small.
  const items = seniors
    .filter((s) => s.userId?.status === ACCOUNT_STATUS.ACTIVE)
    .map((s) => ({
      _id: s._id,
      firstName: s.firstName,
      lastName: s.lastName,
      seniorCitizenId: s.seniorCitizenId,
      barangayId: s.barangayId,
      hasMedicalCondition: s.hasMedicalCondition,
      barangayVerificationStatus: s.barangayReview?.verificationStatus || BARANGAY_VERIFICATION_STATUS.PENDING,
      homeVisitRequired: s.homeVisitStatus === HOME_VISIT_STATUS.REQUIRED,
      homeVisitExecutionStatus: deriveHomeVisitFilterValue(s),
      endorsementDecision: s.barangayReview?.endorsement?.decision || null,
    }));

  return { items, pagination: { page: safePage, pageSize: safePageSize, total, totalPages: Math.max(Math.ceil(total / safePageSize), 1) } };
}

export async function getBarangayReviewDetail(seniorId, requestingUser) {
  const senior = await Senior.findById(seniorId)
    .populate("barangayId", "name municipality province")
    .populate("medicalConditionId", "name")
    .populate("guardianId")
    .populate({ path: "userId", select: "status email" });
  if (!senior) throw new NotFoundError("Senior not found.");
  assertCanAccessBarangay(requestingUser, senior.barangayId?._id || senior.barangayId);
  if (senior.userId?.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new NotFoundError("This Senior's registration is not yet active.");
  }

  const guardians = senior.guardianId
    ? await Guardian.find({ seniorId: senior._id, authorizationConfirmed: true }).select("firstName lastName relationship mobileNumber authorizationConfirmed")
    : [];

  return { senior, guardians };
}

function requireRemarksFor(decision, remarks) {
  if ((decision === BARANGAY_VERIFICATION_STATUS.REJECTED || decision === BARANGAY_VERIFICATION_STATUS.REVISION_REQUIRED) && !remarks?.trim()) {
    throw new ValidationError(
      decision === BARANGAY_VERIFICATION_STATUS.REJECTED
        ? "Please provide a reason for rejecting this Senior's Barangay verification."
        : "Please provide remarks explaining what needs revision.",
      { remarks: "Required." }
    );
  }
}

/**
 * Barangay's own initial-verification decision — separate from, and
 * does not touch, the original registration approval (models/Verification.js)
 * or anything from Phase 5's medical decision.
 */
export async function recordVerificationDecision(seniorId, { decision, remarks }, requestingUser) {
  assertBarangayStaffCanAct(requestingUser);
  const senior = await Senior.findById(seniorId).populate({ path: "userId", select: "status" });
  if (!senior) throw new NotFoundError("Senior not found.");
  assertCanAccessBarangay(requestingUser, senior.barangayId);
  if (senior.userId?.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ValidationError("This Senior's registration is not yet active.");
  }

  const current = senior.barangayReview?.verificationStatus || null;
  if (current === BARANGAY_VERIFICATION_STATUS.VERIFIED) {
    throw new ConflictError("This Senior's Barangay verification is already completed.");
  }
  if (![BARANGAY_VERIFICATION_STATUS.VERIFIED, BARANGAY_VERIFICATION_STATUS.REVISION_REQUIRED, BARANGAY_VERIFICATION_STATUS.REJECTED].includes(decision)) {
    throw new ValidationError("Please select a valid verification decision.", { decision: "Required." });
  }
  requireRemarksFor(decision, remarks);

  const wasPending = current === null || current === BARANGAY_VERIFICATION_STATUS.PENDING;

  senior.barangayReview = senior.barangayReview || {};
  senior.barangayReview.verificationStatus = decision;
  senior.barangayReview.verificationRemarks = (remarks || "").trim();
  senior.barangayReview.verifiedBy = requestingUser.id;
  senior.barangayReview.verifiedAt = new Date();
  await senior.save();

  const auditBase = { actor: requestingUser, entityType: "Senior", entityId: senior._id, barangayId: senior.barangayId };
  if (wasPending) {
    await safeCreateAuditLog({ ...auditBase, action: AUDIT_ACTIONS.BARANGAY_VERIFICATION_STARTED, module: AUDIT_MODULES.BARANGAY_ENDORSEMENT, description: `${requestingUser.role} started Barangay verification for a Senior.` });
  }
  const map = {
    [BARANGAY_VERIFICATION_STATUS.VERIFIED]: [AUDIT_ACTIONS.BARANGAY_VERIFICATION_COMPLETED, "completed", "MEDICAL"],
    [BARANGAY_VERIFICATION_STATUS.REVISION_REQUIRED]: [AUDIT_ACTIONS.BARANGAY_REVISION_REQUESTED, "requested revision for"],
    [BARANGAY_VERIFICATION_STATUS.REJECTED]: [AUDIT_ACTIONS.BARANGAY_VERIFICATION_REJECTED, "rejected"],
  };
  const [action, verb] = map[decision];
  await safeCreateAuditLog({ ...auditBase, action, module: AUDIT_MODULES.BARANGAY_ENDORSEMENT, description: `${requestingUser.role} ${verb} a Senior's Barangay verification.`, metadata: { remarks: senior.barangayReview.verificationRemarks || undefined } });

  try {
    if (decision === BARANGAY_VERIFICATION_STATUS.REVISION_REQUIRED) {
      await notifySeniorAndGuardians(senior, { eventType: "BARANGAY_VERIFICATION_REVISION_REQUIRED", title: "Barangay Verification Needs Revision", message: `Your Barangay verification needs revision. Remarks: ${senior.barangayReview.verificationRemarks}` });
    } else if (decision === BARANGAY_VERIFICATION_STATUS.REJECTED) {
      await notifySeniorAndGuardians(senior, { eventType: "BARANGAY_VERIFICATION_REJECTED", title: "Barangay Verification Rejected", message: `Your Barangay verification was not approved. Reason: ${senior.barangayReview.verificationRemarks}` });
    }
  } catch (err) {
    console.error("[barangayEndorsement] notification failed:", err);
  }

  return senior;
}

async function notifySeniorAndGuardians(senior, { eventType, title, message }) {
  const recipientIds = [senior.userId?._id || senior.userId];
  const guardianRecords = await Guardian.find({ seniorId: senior._id, authorizationConfirmed: true }).select("userId");
  for (const g of guardianRecords) if (g.userId) recipientIds.push(g.userId);
  await Promise.all(
    recipientIds
      .filter(Boolean)
      .map((recipientId) => createNotification({ recipientId, type: NOTIFICATION_TYPE.BARANGAY, eventType, title, message, relatedEntityType: "Senior", relatedEntityId: senior._id }))
  );
}

/**
 * Records/updates the Barangay's execution of a Home Visit. Only
 * reachable at all if Admin already set `homeVisitStatus = REQUIRED`
 * (Phase 5) — this never changes that field, only Senior.barangayReview.homeVisit.
 */
export async function recordHomeVisit(seniorId, data, requestingUser) {
  assertBarangayStaffCanAct(requestingUser);
  const senior = await Senior.findById(seniorId);
  if (!senior) throw new NotFoundError("Senior not found.");
  assertCanAccessBarangay(requestingUser, senior.barangayId);

  if (senior.homeVisitStatus !== HOME_VISIT_STATUS.REQUIRED) {
    throw new ValidationError("This Senior does not have an Admin-required Home Visit.");
  }
  if (senior.barangayReview?.homeVisit?.status === HOME_VISIT_EXECUTION_STATUS.COMPLETED) {
    throw new ConflictError("This Home Visit is already marked completed.");
  }

  const { result, findings, followUpRequired, followUpRemarks, visitDate } = data;
  if (!Object.values(HOME_VISIT_RESULT).includes(result)) {
    throw new ValidationError("Please select a valid visit result.", { result: "Required." });
  }
  if (!findings?.trim()) {
    throw new ValidationError("Please record your findings from the visit.", { findings: "Required." });
  }
  if (followUpRequired && !followUpRemarks?.trim()) {
    throw new ValidationError("Please provide follow-up remarks.", { followUpRemarks: "Required when follow-up is needed." });
  }

  const wasFirstRecord = !senior.barangayReview?.homeVisit?.status;
  senior.barangayReview = senior.barangayReview || {};
  senior.barangayReview.homeVisit = senior.barangayReview.homeVisit || {};
  senior.barangayReview.homeVisit.visitDate = visitDate ? new Date(visitDate) : senior.barangayReview.homeVisit.visitDate || new Date();
  senior.barangayReview.homeVisit.conductedBy = requestingUser.id;
  senior.barangayReview.homeVisit.result = result;
  senior.barangayReview.homeVisit.findings = findings.trim();
  senior.barangayReview.homeVisit.followUpRequired = Boolean(followUpRequired);
  senior.barangayReview.homeVisit.followUpRemarks = (followUpRemarks || "").trim();

  const finalStatuses = [HOME_VISIT_RESULT.VERIFIED, HOME_VISIT_RESULT.OTHER];
  if (followUpRequired) {
    senior.barangayReview.homeVisit.status = HOME_VISIT_EXECUTION_STATUS.FOLLOW_UP_REQUIRED;
  } else if (result === HOME_VISIT_RESULT.UNABLE_TO_VERIFY || result === HOME_VISIT_RESULT.NOT_AVAILABLE) {
    senior.barangayReview.homeVisit.status = HOME_VISIT_EXECUTION_STATUS.UNABLE_TO_VERIFY;
  } else {
    senior.barangayReview.homeVisit.status = HOME_VISIT_EXECUTION_STATUS.COMPLETED;
    senior.barangayReview.homeVisit.completedAt = new Date();
  }

  await senior.save();

  const auditBase = { actor: requestingUser, entityType: "Senior", entityId: senior._id, barangayId: senior.barangayId };
  if (wasFirstRecord) {
    await safeCreateAuditLog({ ...auditBase, action: AUDIT_ACTIONS.HOME_VISIT_STARTED, module: AUDIT_MODULES.BARANGAY_ENDORSEMENT, description: `${requestingUser.role} recorded the start of a Home Visit.` });
  }
  const isCompleted = senior.barangayReview.homeVisit.status === HOME_VISIT_EXECUTION_STATUS.COMPLETED;
  await safeCreateAuditLog({
    ...auditBase,
    action: isCompleted ? AUDIT_ACTIONS.HOME_VISIT_COMPLETED : AUDIT_ACTIONS.HOME_VISIT_UPDATED,
    module: AUDIT_MODULES.BARANGAY_ENDORSEMENT,
    description: `${requestingUser.role} ${isCompleted ? "completed" : "updated"} a Home Visit record.`,
    metadata: { result, status: senior.barangayReview.homeVisit.status, followUpRequired: Boolean(followUpRequired) },
  });

  try {
    if (isCompleted) {
      await notifySeniorAndGuardians(senior, { eventType: "HOME_VISIT_COMPLETED", title: "Home Visit Completed", message: "Your Barangay's home visit has been completed." });
    }
  } catch (err) {
    console.error("[barangayEndorsement] notification failed:", err);
  }

  return senior;
}

/**
 * Final Phase 6 action: Barangay Endorsement. Requires Barangay
 * verification to already be VERIFIED, and — only when Admin required a
 * Home Visit — requires that visit to be COMPLETED first (module
 * requirement Step 16: "Do NOT allow Staff to bypass Home Visit
 * requirement"). Setting readyForOscaReview is the only effect beyond
 * storing the decision itself; nothing downstream of it exists yet.
 */
export async function recordEndorsement(seniorId, { decision, remarks }, requestingUser) {
  assertBarangayStaffCanAct(requestingUser);
  const senior = await Senior.findById(seniorId);
  if (!senior) throw new NotFoundError("Senior not found.");
  assertCanAccessBarangay(requestingUser, senior.barangayId);

  if (senior.barangayReview?.verificationStatus !== BARANGAY_VERIFICATION_STATUS.VERIFIED) {
    throw new ValidationError("Barangay verification must be completed (Verified) before endorsement.");
  }
  if (senior.homeVisitStatus === HOME_VISIT_STATUS.REQUIRED && senior.barangayReview?.homeVisit?.status !== HOME_VISIT_EXECUTION_STATUS.COMPLETED) {
    throw new ValidationError("The required Home Visit must be completed before this Senior can be endorsed.");
  }
  if (senior.barangayReview?.endorsement?.decision) {
    throw new ConflictError("This Senior has already been endorsed or marked not endorsed.");
  }
  if (!Object.values(BARANGAY_ENDORSEMENT_DECISION).includes(decision)) {
    throw new ValidationError("Please select a valid endorsement decision.", { decision: "Required." });
  }
  if (decision === BARANGAY_ENDORSEMENT_DECISION.NOT_ENDORSED && !remarks?.trim()) {
    throw new ValidationError("Please provide a reason for not endorsing this Senior.", { remarks: "Required." });
  }

  senior.barangayReview.endorsement = {
    decision,
    remarks: (remarks || "").trim(),
    decidedBy: requestingUser.id,
    decidedAt: new Date(),
  };
  senior.barangayReview.readyForOscaReview = decision === BARANGAY_ENDORSEMENT_DECISION.ENDORSED;
  await senior.save();

  await safeCreateAuditLog({
    actor: requestingUser,
    entityType: "Senior",
    entityId: senior._id,
    barangayId: senior.barangayId,
    action: AUDIT_ACTIONS.BARANGAY_ENDORSEMENT_CREATED,
    module: AUDIT_MODULES.BARANGAY_ENDORSEMENT,
    description: `${requestingUser.role} ${decision === BARANGAY_ENDORSEMENT_DECISION.ENDORSED ? "endorsed" : "did not endorse"} a Senior.`,
    metadata: { decision, remarks: senior.barangayReview.endorsement.remarks || undefined },
  });

  try {
    await notifySeniorAndGuardians(senior, {
      eventType: decision === BARANGAY_ENDORSEMENT_DECISION.ENDORSED ? "BARANGAY_ENDORSED" : "BARANGAY_NOT_ENDORSED",
      title: decision === BARANGAY_ENDORSEMENT_DECISION.ENDORSED ? "Barangay Endorsement Complete" : "Barangay Endorsement Not Approved",
      message:
        decision === BARANGAY_ENDORSEMENT_DECISION.ENDORSED
          ? "Your Barangay has completed its review and endorsed your case for further review."
          : `Your Barangay did not endorse your case. Remarks: ${senior.barangayReview.endorsement.remarks}`,
    });
  } catch (err) {
    console.error("[barangayEndorsement] notification failed:", err);
  }

  return senior;
}

/** Barangay Staff Dashboard metrics (Step 14) — scoped to the Staff's own barangay. */
export async function getBarangayEndorsementSummary(requestingUser) {
  assertBarangayStaffCanAct(requestingUser);
  const barangayId = requestingUser.assignedBarangayId;
  const activeUsers = await User.find({ status: ACCOUNT_STATUS.ACTIVE }).select("_id");
  const base = { barangayId, userId: { $in: activeUsers.map((u) => u._id) } };

  const [pendingVerification, homeVisitsRequired, homeVisitsPending, homeVisitsCompleted, forEndorsement, endorsed] = await Promise.all([
    Senior.countDocuments({ ...base, $or: [{ "barangayReview.verificationStatus": null }, { "barangayReview.verificationStatus": { $exists: false } }] }),
    Senior.countDocuments({ ...base, homeVisitStatus: HOME_VISIT_STATUS.REQUIRED }),
    Senior.countDocuments({
      ...base,
      homeVisitStatus: HOME_VISIT_STATUS.REQUIRED,
      $or: [{ "barangayReview.homeVisit.status": null }, { "barangayReview.homeVisit.status": { $in: [HOME_VISIT_EXECUTION_STATUS.PENDING, HOME_VISIT_EXECUTION_STATUS.FOLLOW_UP_REQUIRED] } }],
    }),
    Senior.countDocuments({ ...base, "barangayReview.homeVisit.status": HOME_VISIT_EXECUTION_STATUS.COMPLETED }),
    Senior.countDocuments({
      ...base,
      "barangayReview.verificationStatus": BARANGAY_VERIFICATION_STATUS.VERIFIED,
      $or: [{ "barangayReview.endorsement.decision": null }, { "barangayReview.endorsement.decision": { $exists: false } }],
    }),
    Senior.countDocuments({ ...base, "barangayReview.endorsement.decision": BARANGAY_ENDORSEMENT_DECISION.ENDORSED }),
  ]);

  return { pendingVerification, homeVisitsRequired, homeVisitsPending, homeVisitsCompleted, forEndorsement, endorsed };
}
