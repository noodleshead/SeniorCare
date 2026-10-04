// Central place for enums used across models, validators, and middleware.
// Keeping these as plain objects (not free-typed strings) prevents typos
// from creating silently-broken authorization checks.

export const ROLES = Object.freeze({
  SENIOR_CITIZEN: "SENIOR_CITIZEN",
  GUARDIAN: "GUARDIAN",
  BARANGAY_STAFF: "BARANGAY_STAFF",
  ADMIN: "ADMIN",
  LGU_OSCA: "LGU_OSCA",
});

export const ACCOUNT_STATUS = Object.freeze({
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  REJECTED: "REJECTED",
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export const SEX = Object.freeze({
  MALE: "Male",
  FEMALE: "Female",
});

export const CIVIL_STATUS = Object.freeze({
  SINGLE: "Single",
  MARRIED: "Married",
  WIDOWED: "Widowed",
  DIVORCED: "Divorced",
  SEPARATED: "Separated",
});

export const DOCUMENT_TYPES = Object.freeze({
  VALID_ID: "VALID_ID",
  SENIOR_CITIZEN_ID: "SENIOR_CITIZEN_ID",
  PROOF_OF_RESIDENCY: "PROOF_OF_RESIDENCY",
  GUARDIAN_ID: "GUARDIAN_ID",
  AUTHORIZATION_DOCUMENT: "AUTHORIZATION_DOCUMENT",
  // Additive — used only by Benefit Applications for program-specific
  // requirements beyond the fixed set collected at registration.
  BENEFIT_SUPPORTING_DOCUMENT: "BENEFIT_SUPPORTING_DOCUMENT",
  // Medical certificate / doctor's certification / medical record
  // supporting a declared medical condition (Phase 3). Linked to the
  // Senior via Document.seniorId like every other document — no separate
  // reference is stored on Senior.
  MEDICAL_SUPPORTING_DOCUMENT: "MEDICAL_SUPPORTING_DOCUMENT",
});

// Verification state of a Senior's *declared* medical condition. Always
// starts PENDING at registration; only the future Medical Verification
// phase may move it. Never settable from a request body.
export const MEDICAL_VERIFICATION_STATUS = Object.freeze({
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  REVISION_REQUIRED: "REVISION_REQUIRED",
});

// Illness Database (Phase 4) — internal administrative classification.
// Never exposed to Senior/Guardian; see models/Illness.js.
export const ILLNESS_CLASSIFICATION = Object.freeze({
  CRITICAL: "CRITICAL",
  NON_CRITICAL: "NON_CRITICAL",
});

export const ILLNESS_PRIORITY = Object.freeze({
  HIGH: "HIGH",
  NORMAL: "NORMAL",
});

// Phase 5 — Admin's Home Visit decision outcome, stored on Senior (see
// models/Senior.js). Deliberately only the three states Phase 5 itself
// produces — SCHEDULED/COMPLETED are Phase 6 concepts and don't exist
// until that phase actually implements the Barangay queue that would
// set them.
export const HOME_VISIT_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING_DECISION: "PENDING_DECISION",
  REQUIRED: "REQUIRED",
});

// ---- Phase 6: Barangay Verification, Home Visit execution, Endorsement ----
// Distinct from Phase 5's MEDICAL_VERIFICATION_STATUS (Admin reviewing the
// Senior's *medical submission*) and from VERIFICATION_STATUS (the
// original registration approval that activates the account). This is a
// separate, later stage: Barangay Staff endorsing an already-active
// Senior's case toward the not-yet-built OSCA review (Phase 7).
export const BARANGAY_VERIFICATION_STATUS = Object.freeze({
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REVISION_REQUIRED: "REVISION_REQUIRED",
  REJECTED: "REJECTED",
});

// Barangay's EXECUTION of a Home Visit Admin already required — never
// confused with Phase 5's HOME_VISIT_STATUS (Admin's REQUIRED/NOT_REQUIRED
// *decision*, on Senior.homeVisitStatus, which this phase never
// overwrites). This tracks the Staff's own progress against that
// decision.
export const HOME_VISIT_EXECUTION_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FOLLOW_UP_REQUIRED: "FOLLOW_UP_REQUIRED",
  UNABLE_TO_VERIFY: "UNABLE_TO_VERIFY",
});

export const HOME_VISIT_RESULT = Object.freeze({
  VERIFIED: "VERIFIED",
  NEEDS_FOLLOW_UP: "NEEDS_FOLLOW_UP",
  UNABLE_TO_VERIFY: "UNABLE_TO_VERIFY",
  NOT_AVAILABLE: "NOT_AVAILABLE",
  OTHER: "OTHER",
});

export const BARANGAY_ENDORSEMENT_DECISION = Object.freeze({
  ENDORSED: "ENDORSED",
  NOT_ENDORSED: "NOT_ENDORSED",
});

export const RELATIONSHIP_TYPES = Object.freeze({
  CHILD: "Child",
  SPOUSE: "Spouse",
  SIBLING: "Sibling",
  RELATIVE: "Relative",
  CAREGIVER: "Caregiver",
  OTHER: "Other",
});

// Minimum age to be eligible for SENIORCARE registration.
// Adjust to the organization's actual policy — kept as a single
// source of truth rather than scattered magic numbers.
export const MINIMUM_SENIOR_AGE = 60;

// ---- Pension Management ----

export const PENSION_TYPES = Object.freeze({
  GOVERNMENT_PENSION: "GOVERNMENT_PENSION",
  SOCIAL_PENSION: "SOCIAL_PENSION",
  OTHER: "OTHER",
});

export const PENSION_FREQUENCY = Object.freeze({
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  ANNUAL: "ANNUAL",
});

export const PENSION_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const SCHEDULE_STATUS = Object.freeze({
  OPEN: "OPEN",
  CLOSED: "CLOSED",
});

export const SLOT_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  FULL: "FULL",
  CLOSED: "CLOSED",
});

export const CLAIM_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  CLAIMED: "CLAIMED",
  MISSED: "MISSED",
  CANCELLED: "CANCELLED",
});

// ---- Benefits & Assistance Management ----

export const BENEFIT_CATEGORY = Object.freeze({
  AGE_BASED: "AGE_BASED",
  FINANCIAL_ASSISTANCE: "FINANCIAL_ASSISTANCE",
  OTHER: "OTHER",
});

export const BENEFIT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

// The Senior lifecycle a benefit application moves through. Rejection is
// reachable from SUBMITTED/UNDER_REVIEW/ENDORSED (see the transition
// rules in benefitApplication.service.js) — it is not a step in this
// straight-line list, just a valid destination from those three.
export const APPLICATION_STATUS = Object.freeze({
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  ENDORSED: "ENDORSED",
  // Phase 7 — OSCA final review may send an ENDORSED application back to
  // the Barangay instead of approving/rejecting it outright. Extends the
  // existing lifecycle rather than inventing a parallel status system;
  // benefitApplication.service.js#endorseApplication already accepts
  // this as a valid "from" status, so Staff can re-endorse once addressed.
  REVISION_REQUIRED: "REVISION_REQUIRED",
  APPROVED: "APPROVED",
  RELEASED: "RELEASED",
  CLAIMED: "CLAIMED",
  REJECTED: "REJECTED",
});

// ---- Announcements & Notifications ----

export const ANNOUNCEMENT_CATEGORY = Object.freeze({
  GENERAL: "GENERAL",
  PENSION: "PENSION",
  BENEFITS: "BENEFITS",
  ASSISTANCE: "ASSISTANCE",
  REQUIREMENTS: "REQUIREMENTS",
  PROGRAM: "PROGRAM",
  BARANGAY: "BARANGAY",
  ACTIVITY: "ACTIVITY",
  IMPORTANT: "IMPORTANT",
});

export const ANNOUNCEMENT_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
});

// Who an announcement is meant for. ALL means every authenticated,
// active role (Senior/Guardian/Staff/Admin/LGU-OSCA all see it, still
// subject to barangay scoping below) — it does NOT bypass barangay
// scoping on its own. STAFF_ADMIN groups the internal-only audiences
// (BARANGAY_STAFF/ADMIN/LGU_OSCA) since Seniors/Guardians must never
// see staff-only announcements.
export const TARGET_AUDIENCE = Object.freeze({
  ALL: "ALL",
  SENIOR_CITIZEN: "SENIOR_CITIZEN",
  GUARDIAN: "GUARDIAN",
  STAFF_ADMIN: "STAFF_ADMIN",
});

// Whether an announcement applies system-wide or only to specific
// Barangay(s) — mirrors BenefitProgram.barangayIds' "empty = everyone"
// convention rather than inventing a second scoping concept.
export const ANNOUNCEMENT_SCOPE = Object.freeze({
  SYSTEM_WIDE: "SYSTEM_WIDE",
  BARANGAY: "BARANGAY",
});

export const NOTIFICATION_TYPE = Object.freeze({
  ANNOUNCEMENT: "ANNOUNCEMENT",
  PENSION: "PENSION",
  BENEFIT: "BENEFIT",
  DOCUMENT: "DOCUMENT",
  APPLICATION: "APPLICATION",
  ACTIVITY: "ACTIVITY",
  CONCERN: "CONCERN",
  SYSTEM: "SYSTEM",
  MEDICAL: "MEDICAL",
  BARANGAY: "BARANGAY",
});

// ---- Reports / Concerns ----

// Strictly sequential — see CONCERN_TRANSITIONS in concern.service.js.
// A concern cannot jump straight from NEW to RESOLVED.
export const CONCERN_STATUS = Object.freeze({
  NEW: "NEW",
  UNDER_REVIEW: "UNDER_REVIEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
});

// The Staff-assigned, official classification — never set directly by
// the Senior. See CONCERN_URGENCY below for the Senior's own signal.
export const CONCERN_PRIORITY = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  REGULAR: "REGULAR",
});

// What the Senior optionally reports at submission time — informational
// only, shown to Staff as context. Staff's own `priority` classification
// (above) is the one that actually drives handling, so the two are
// intentionally separate fields rather than one Senior-writable field.
export const CONCERN_URGENCY = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  REGULAR: "REGULAR",
});

export const CONCERN_CATEGORY = Object.freeze({
  PENSION: "PENSION",
  BENEFITS: "BENEFITS",
  DOCUMENTS: "DOCUMENTS",
  REGISTRATION: "REGISTRATION",
  BARANGAY_SERVICES: "BARANGAY_SERVICES",
  ACTIVITIES: "ACTIVITIES",
  ACCOUNT_TECHNICAL: "ACCOUNT_TECHNICAL",
  OTHER: "OTHER",
});

// ---- Social Activities ----
// A distinct lifecycle from ANNOUNCEMENT_STATUS — an activity is a
// scheduled, physical event (it can be ONGOING/COMPLETED), not a
// broadcast notice, so the two statuses are intentionally not shared.
export const ACTIVITY_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

export const ACTIVITY_CATEGORY = Object.freeze({
  WELLNESS: "WELLNESS",
  ASSEMBLY: "ASSEMBLY",
  HEALTH_SEMINAR: "HEALTH_SEMINAR",
  EXERCISE: "EXERCISE",
  COMMUNITY_EVENT: "COMMUNITY_EVENT",
  LIVELIHOOD: "LIVELIHOOD",
  GENERAL: "GENERAL",
});

// ---- Audit Logs ----
// Only actions/modules actually emitted by a real call site (see
// auditLog.service.js and its callers) belong here — this is a closed
// vocabulary, not a place to pre-register hypothetical future events.
export const AUDIT_ACTIONS = Object.freeze({
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET: "PASSWORD_RESET",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  ACTIVATE: "ACTIVATE",
  DEACTIVATE: "DEACTIVATE",
  RESET_PASSWORD: "RESET_PASSWORD",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  ENDORSE: "ENDORSE",
  RELEASE: "RELEASE",
  COMPLETE: "COMPLETE",
  CLAIM: "CLAIM",
  CANCEL: "CANCEL",
  EXPORT: "EXPORT",
  // Phase 5 — Admin Medical Verification. Kept as distinct, specific
  // actions (rather than reusing generic APPROVE/REJECT) because the
  // module's own spec names these exact events as what must be logged,
  // and "verification confirmed" here means something structurally
  // different from a registration APPROVE (it doesn't activate an
  // account, and it can independently carry a classification/priority
  // override on top of the outcome itself).
  MEDICAL_VERIFICATION_STARTED: "MEDICAL_VERIFICATION_STARTED",
  MEDICAL_VERIFICATION_CONFIRMED: "MEDICAL_VERIFICATION_CONFIRMED",
  MEDICAL_VERIFICATION_REJECTED: "MEDICAL_VERIFICATION_REJECTED",
  MEDICAL_REVISION_REQUESTED: "MEDICAL_REVISION_REQUESTED",
  MEDICAL_CLASSIFICATION_OVERRIDDEN: "MEDICAL_CLASSIFICATION_OVERRIDDEN",
  MEDICAL_PRIORITY_OVERRIDDEN: "MEDICAL_PRIORITY_OVERRIDDEN",
  HOME_VISIT_DECISION_RECORDED: "HOME_VISIT_DECISION_RECORDED",
  // Phase 6
  BARANGAY_VERIFICATION_STARTED: "BARANGAY_VERIFICATION_STARTED",
  BARANGAY_VERIFICATION_COMPLETED: "BARANGAY_VERIFICATION_COMPLETED",
  BARANGAY_REVISION_REQUESTED: "BARANGAY_REVISION_REQUESTED",
  BARANGAY_VERIFICATION_REJECTED: "BARANGAY_VERIFICATION_REJECTED",
  HOME_VISIT_STARTED: "HOME_VISIT_STARTED",
  HOME_VISIT_COMPLETED: "HOME_VISIT_COMPLETED",
  HOME_VISIT_UPDATED: "HOME_VISIT_UPDATED",
  BARANGAY_ENDORSEMENT_CREATED: "BARANGAY_ENDORSEMENT_CREATED",
  BARANGAY_ENDORSEMENT_UPDATED: "BARANGAY_ENDORSEMENT_UPDATED",
  // Phase 7 — OSCA final review, specifically at the ENDORSED stage of an
  // existing BenefitApplication. Distinct from the generic APPROVE/REJECT
  // actions already used for every other stage of that same application
  // (see benefitApplication.service.js), so the Audit Log can tell OSCA's
  // final decision apart from Barangay Staff's own earlier review.
  OSCA_REVIEW_STARTED: "OSCA_REVIEW_STARTED",
  OSCA_APPLICATION_APPROVED: "OSCA_APPLICATION_APPROVED",
  OSCA_APPLICATION_REJECTED: "OSCA_APPLICATION_REJECTED",
  OSCA_REVISION_REQUESTED: "OSCA_REVISION_REQUESTED",
});

export const AUDIT_MODULES = Object.freeze({
  AUTH: "AUTH",
  USER_MANAGEMENT: "USER_MANAGEMENT",
  VERIFICATION: "VERIFICATION",
  GUARDIAN: "GUARDIAN",
  PENSION: "PENSION",
  BENEFITS: "BENEFITS",
  REPORTS: "REPORTS",
  SYSTEM_SETTINGS: "SYSTEM_SETTINGS",
  ILLNESS_DATABASE: "ILLNESS_DATABASE",
  MEDICAL_VERIFICATION: "MEDICAL_VERIFICATION",
  BARANGAY_ENDORSEMENT: "BARANGAY_ENDORSEMENT",
  OSCA_REVIEW: "OSCA_REVIEW",
});
