import Pension from "../models/Pension.js";
import Senior from "../models/Senior.js";
import User from "../models/User.js";
import { ACCOUNT_STATUS } from "../utils/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../utils/errors.js";
import { assertCanAccessBarangay, hasBroadBarangayAccess } from "../utils/barangayScope.js";

const SENIOR_SUMMARY_FIELDS = "firstName lastName seniorCitizenId barangayId dateOfBirth";

/**
 * Active/verified Seniors who don't already have a pension record — used
 * to populate the "Senior Citizen" search/picker on the Create Pension
 * form.
 *
 * BUG FIX (Phase 2 — "Admin cannot search for a Senior when creating a
 * Pension Record"): both branches below used to do exactly the same
 * thing — require `requestingUser.assignedBarangayId` — but ADMIN and
 * LGU_OSCA never have an assignedBarangayId at all (that's a
 * Barangay-Staff-only concept; see barangayScope.js). So for every
 * Admin/LGU-OSCA caller, this function silently returned `[]`,
 * regardless of what they searched for — the picker looked "broken",
 * not just empty. The comment even referenced "picking a barangay first
 * via the pension list/filters", but this function never actually
 * accepted a barangayId to make that possible.
 *
 * Fixed behavior: Barangay Staff is still always locked to their own
 * assignedBarangayId (a client-supplied barangayId is never consulted
 * for them, same as every other barangay-scoped query in this
 * project). Admin/LGU-OSCA may now pass an explicit `barangayId` to
 * scope to one barangay, OR simply search by name/ID system-wide — a
 * *searched* query is bounded by the search term + the existing
 * `.limit(50)` below, so it's not the "unbounded cross-system query"
 * the original comment was guarding against; only an unscoped,
 * unsearched listing is still refused (returns `[]`), to avoid ever
 * dumping the entire Senior collection into one dropdown.
 *
 * Never returns PENDING_VERIFICATION, INACTIVE, or REJECTED accounts
 * (business rule: only active, verified Seniors may receive a pension
 * record).
 */
export async function listEligibleSeniors(requestingUser, { search = "", barangayId } = {}) {
  const query = {};
  const hasSearch = Boolean(search && search.trim());

  if (hasBroadBarangayAccess(requestingUser.role)) {
    if (barangayId) {
      query.barangayId = barangayId;
    } else if (!hasSearch) {
      // No barangay chosen and nothing searched yet — refuse to list
      // every Senior in the system. Once the Admin/LGU-OSCA either
      // picks a barangay or types a search term, this falls through.
      return [];
    }
  } else {
    // Barangay Staff: always their own assignment, exactly as before —
    // a barangayId argument (which would only ever come from a
    // client-controlled Admin/LGU-OSCA UI control anyway) is never
    // consulted for this role.
    if (!requestingUser.assignedBarangayId) return [];
    query.barangayId = requestingUser.assignedBarangayId;
  }

  const activeUserIds = await User.find({ status: ACCOUNT_STATUS.ACTIVE }).select("_id");
  query.userId = { $in: activeUserIds.map((u) => u._id) };

  if (hasSearch) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }];
  }

  const seniors = await Senior.find(query)
    .select(SENIOR_SUMMARY_FIELDS)
    .populate("barangayId", "name municipality")
    .limit(50)
    .sort({ lastName: 1 });
  const existingPensionSeniorIds = new Set(
    (await Pension.find({ seniorId: { $in: seniors.map((s) => s._id) } }).select("seniorId")).map((p) =>
      p.seniorId.toString()
    )
  );

  return seniors.filter((s) => !existingPensionSeniorIds.has(s._id.toString()));
}

/**
 * The Senior's own pension record. `userId` always comes from the
 * authenticated token (req.user.id) — never a client-supplied seniorId —
 * so a Senior can only ever see their own pension.
 */
export async function getMyPension(userId) {
  const senior = await Senior.findOne({ userId });
  if (!senior) throw new NotFoundError("Senior profile not found.");

  const pension = await Pension.findOne({ seniorId: senior._id });
  return pension; // null is a valid, expected "no pension yet" result
}

/**
 * List pension records, scoped to the requesting staff's assigned
 * barangay unless they have ADMIN/LGU_OSCA broad access. Supports
 * optional search/type/status filters — never trusts a client-supplied
 * barangayId to widen access beyond what the role already allows.
 */
export async function listPensions(requestingUser, { search = "", pensionType, status, barangayId } = {}) {
  const query = {};

  if (hasBroadBarangayAccess(requestingUser.role)) {
    if (barangayId) query.barangayId = barangayId;
  } else {
    if (!requestingUser.assignedBarangayId) return [];
    query.barangayId = requestingUser.assignedBarangayId;
  }

  if (pensionType) query.pensionType = pensionType;
  if (status) query.status = status;

  if (search && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchingSeniors = await Senior.find({
      $or: [{ firstName: regex }, { lastName: regex }, { seniorCitizenId: regex }],
    }).select("_id");
    query.seniorId = { $in: matchingSeniors.map((s) => s._id) };
  }

  return Pension.find(query)
    .populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS })
    .sort({ createdAt: -1 });
}

export async function getPensionById(pensionId, requestingUser) {
  const pension = await Pension.findById(pensionId).populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });
  if (!pension) throw new NotFoundError("Pension record not found.");
  assertCanAccessBarangay(requestingUser, pension.barangayId);
  return pension;
}

export async function createPension(requestingUser, input) {
  const senior = await Senior.findById(input.seniorId).populate({ path: "userId", select: "status" });
  if (!senior) throw new NotFoundError("Senior not found.");

  assertCanAccessBarangay(requestingUser, senior.barangayId);

  if (senior.userId?.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ValidationError("Pension records can only be created for an active, verified Senior Citizen.");
  }

  const existing = await Pension.findOne({ seniorId: senior._id });
  if (existing) {
    throw new ConflictError("This Senior already has a pension record. Edit the existing record instead.");
  }

  const pension = await Pension.create({
    seniorId: senior._id,
    barangayId: senior.barangayId,
    pensionType: input.pensionType,
    pensionProvider: input.pensionProvider,
    pensionAmount: input.pensionAmount,
    frequency: input.frequency,
    status: input.status,
    effectiveDate: input.effectiveDate,
    lastUpdatedBy: requestingUser.id,
  });

  return pension.populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });
}

export async function updatePension(pensionId, requestingUser, updates) {
  const pension = await Pension.findById(pensionId);
  if (!pension) throw new NotFoundError("Pension record not found.");

  assertCanAccessBarangay(requestingUser, pension.barangayId);

  Object.assign(pension, updates, { lastUpdatedBy: requestingUser.id });
  await pension.save();

  return pension.populate({ path: "seniorId", select: SENIOR_SUMMARY_FIELDS });
}
