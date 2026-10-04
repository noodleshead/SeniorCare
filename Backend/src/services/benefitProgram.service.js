import BenefitProgram from "../models/BenefitProgram.js";
import { BENEFIT_STATUS, ROLES } from "../utils/constants.js";
import { NotFoundError, AuthorizationError } from "../utils/errors.js";

// Program catalog management is kept at the OSCA/system level (ADMIN,
// LGU_OSCA) rather than per-Barangay, unlike Pension schedules which
// Barangay Staff create for their own barangay — a benefit/assistance
// program is a system-wide offering that may happen to be scoped to
// specific barangays, not something each barangay independently
// authors. BARANGAY_STAFF can still list/view programs (they need to
// see requirements while reviewing applications) but cannot create or
// edit them.
function assertCanManagePrograms(requestingUser) {
  if (requestingUser.role !== ROLES.ADMIN && requestingUser.role !== ROLES.LGU_OSCA) {
    throw new AuthorizationError("Only Admin or LGU-OSCA users may manage benefit programs.");
  }
}

/**
 * Programs visible to Staff/Admin/LGU-OSCA for management/reference —
 * includes INACTIVE ones (they still need to review applications
 * against a program that was later deactivated).
 */
export async function listProgramsForStaff({ status, category } = {}) {
  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  return BenefitProgram.find(query).sort({ createdAt: -1 });
}

/**
 * Programs a Senior may see: ACTIVE only, and either barangay-unscoped
 * (`barangayIds` empty) or explicitly scoped to the Senior's own
 * barangay. The Senior's barangay always comes from their own resolved
 * profile — never a client-supplied filter.
 */
export async function listProgramsForSenior(senior) {
  return BenefitProgram.find({
    status: BENEFIT_STATUS.ACTIVE,
    $or: [{ barangayIds: { $size: 0 } }, { barangayIds: senior.barangayId }],
  }).sort({ category: 1, name: 1 });
}

export async function getProgramById(programId) {
  const program = await BenefitProgram.findById(programId);
  if (!program) throw new NotFoundError("Benefit program not found.");
  return program;
}

export async function createProgram(requestingUser, input) {
  assertCanManagePrograms(requestingUser);
  return BenefitProgram.create({ ...input, createdBy: requestingUser.id });
}

export async function updateProgram(programId, requestingUser, updates) {
  assertCanManagePrograms(requestingUser);
  const program = await getProgramById(programId);
  Object.assign(program, updates);
  await program.save();
  return program;
}

/**
 * The authoritative eligibility check. The frontend only ever displays
 * this result — it can never declare `eligible: true` on its own,
 * since every application-creating endpoint re-runs this exact
 * function server-side before accepting a submission (see
 * benefitApplication.service.js#applyForBenefit).
 */
export function computeEligibility(senior, program) {
  const reasons = [];

  if (program.status !== BENEFIT_STATUS.ACTIVE) {
    reasons.push("This program is not currently active.");
  }

  const now = new Date();
  if (program.startDate && now < program.startDate) {
    reasons.push("This program's application period has not started yet.");
  }
  if (program.endDate && now > program.endDate) {
    reasons.push("This program's application period has ended.");
  }

  if (program.barangayIds?.length > 0) {
    const allowed = program.barangayIds.map((id) => id.toString());
    if (!allowed.includes(senior.barangayId.toString())) {
      reasons.push("This program is not available in your barangay.");
    }
  }

  if (program.minAge != null && senior.age < program.minAge) {
    reasons.push(`This program requires an age of at least ${program.minAge}.`);
  }
  if (program.maxAge != null && senior.age > program.maxAge) {
    reasons.push(`This program is limited to seniors up to age ${program.maxAge}.`);
  }

  if (program.requiresBedridden === true && senior.bedridden !== true) {
    reasons.push("This program is limited to bedridden senior citizens.");
  }
  if (program.requiresBedridden === false && senior.bedridden === true) {
    reasons.push("This program is not applicable to bedridden senior citizens.");
  }

  return { eligible: reasons.length === 0, reasons };
}

/** Programs the Senior's own profile potentially qualifies for, with the reason attached when not. */
export async function listEligiblePrograms(senior) {
  const programs = await listProgramsForSenior(senior);
  return programs.map((program) => ({
    program,
    ...computeEligibility(senior, program),
  }));
}
