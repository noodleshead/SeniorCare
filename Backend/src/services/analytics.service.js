import mongoose from "mongoose";
import Senior from "../models/Senior.js";
import Barangay from "../models/Barangay.js";
import Pension from "../models/Pension.js";
import PensionClaim from "../models/PensionClaim.js";
import BenefitApplication from "../models/BenefitApplication.js";
import { ACCOUNT_STATUS, PENSION_STATUS, CLAIM_STATUS, APPLICATION_STATUS } from "../utils/constants.js";
import { hasBroadBarangayAccess } from "../utils/barangayScope.js";

/**
 * Senior Mapping & Barangay Analytics.
 *
 * Every function here follows the exact barangay-scoping pattern already
 * used by pension.service.js / benefitApplication.service.js /
 * verification.service.js: BARANGAY_STAFF is always pinned to
 * `requestingUser.assignedBarangayId` (never a client-supplied barangayId),
 * fails closed (returns an empty result, never "all") if unassigned, and
 * ADMIN/LGU_OSCA may optionally narrow to one barangay or see everything.
 *
 * "Active Senior" here means the same thing getVerificationStats already
 * uses: a Senior record whose linked User.status is ACCOUNT_STATUS.ACTIVE.
 * PENDING_VERIFICATION, REJECTED, and INACTIVE accounts are excluded from
 * every count below — analytics describes the real, currently-served
 * population, not every registration ever submitted.
 */

const AGE_BUCKETS = [
  { label: "60-69", min: 60, max: 69 },
  { label: "70-79", min: 70, max: 79 },
  { label: "80-89", min: 80, max: 89 },
  { label: "90-99", min: 90, max: 99 },
  { label: "100+", min: 100, max: null },
];

/**
 * Resolves which barangay(s) the requesting user's analytics query is
 * allowed to see. Mirrors the exact rule already enforced in
 * pension.service.js#listPensions and benefitApplication.service.js#listApplications:
 *   - BARANGAY_STAFF: always their own assignedBarangayId, full stop.
 *     A `barangayId` query param from a Staff request is never consulted —
 *     it cannot widen or redirect their scope. No assignment => fail closed
 *     (scope with zero barangays, never "all").
 *   - ADMIN / LGU_OSCA: an explicit `barangayId` narrows to that one
 *     barangay; omitting it means "every barangay" (consolidated view).
 */
function resolveScope(requestingUser, barangayId) {
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId) {
      return { mode: "single", barangayIds: [], locked: true };
    }
    return { mode: "single", barangayIds: [requestingUser.assignedBarangayId], locked: true };
  }
  if (barangayId) {
    return { mode: "single", barangayIds: [barangayId], locked: false };
  }
  return { mode: "all", barangayIds: null, locked: false };
}

/**
 * Barangays the requesting user may pick from in the analytics filter.
 * BARANGAY_STAFF gets back only their own assigned barangay (read-only —
 * there is nothing to actually choose); ADMIN/LGU_OSCA get every active
 * barangay. Deliberately separate from admin.service.js#listBarangays,
 * which is intentionally ADMIN-only organizational management — this is
 * read-only metadata for a filter dropdown, available to the same
 * staffOrAbove role set as the rest of analytics/verification/pension.
 */
export async function listAnalyticsBarangays(requestingUser) {
  if (!hasBroadBarangayAccess(requestingUser.role)) {
    if (!requestingUser.assignedBarangayId) return [];
    const own = await Barangay.findById(requestingUser.assignedBarangayId).select("name municipality province");
    return own ? [own] : [];
  }
  return Barangay.find({ isActive: true }).select("name municipality province").sort({ name: 1 });
}

function ageBucketExpr() {
  // $dateDiff (MongoDB 5.0+) computes whole-year age directly in the
  // pipeline — the same "years elapsed since dateOfBirth" definition as
  // Senior.js's own virtual `age` getter, just expressed server-side so
  // grouping doesn't require pulling every document into Node first.
  return {
    $dateDiff: { startDate: "$dateOfBirth", endDate: "$$NOW", unit: "year" },
  };
}

function ageBucketSwitch() {
  return {
    $switch: {
      branches: AGE_BUCKETS.filter((b) => b.max !== null).map((b) => ({
        case: { $and: [{ $gte: [ageBucketExpr(), b.min] }, { $lte: [ageBucketExpr(), b.max] }] },
        then: b.label,
      })),
      default: "100+", // covers 100+ and any (invalid) age below 60 falls through visibly rather than being silently dropped
    },
  };
}

/**
 * Base pipeline stages shared by every Senior-population query below:
 * scope to the resolved barangay(s), join to the linked User, and keep
 * only ACTIVE accounts. Returns `null` if the scope has zero barangays
 * (Staff with no assignment) — callers must check for that and return an
 * empty/zeroed result rather than running an unscoped query.
 *
 * `dateRange` (optional { from, to }, either end omittable) filters by
 * Senior.createdAt — the registration timestamp Mongoose's own
 * `{ timestamps: true }` already provides (see Senior.js), not a new
 * field. Omitting it (every existing caller before Admin System Reports)
 * behaves exactly as before — unfiltered by date.
 */
function activeSeniorPipeline(scope, dateRange) {
  if (scope.mode === "single" && scope.barangayIds.length === 0) return null;
  const match = {};
  if (scope.mode === "single") {
    match.barangayId = new mongoose.Types.ObjectId(scope.barangayIds[0]);
  }
  if (dateRange?.from || dateRange?.to) {
    match.createdAt = {};
    if (dateRange.from) match.createdAt.$gte = dateRange.from;
    if (dateRange.to) match.createdAt.$lte = dateRange.to;
  }
  return [
    { $match: match },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.status": ACCOUNT_STATUS.ACTIVE } },
  ];
}

/**
 * Full analytics payload for either a single barangay (Staff, or
 * LGU/Admin with a `barangayId` filter) or a consolidated multi-barangay
 * view (LGU/Admin with no filter, or ADMIN via Admin System Reports).
 * Powers the Barangay Staff Analytics page, the LGU/OSCA consolidated
 * view, and (reused, not duplicated — see adminReports.service.js)
 * Admin System Reports' own senior/demographic/pension/application
 * sections. `dateRange` is optional and unused by the first two callers.
 */
export async function getSeniorAnalytics(requestingUser, { barangayId, dateRange } = {}) {
  const scope = resolveScope(requestingUser, barangayId);
  const pipeline = activeSeniorPipeline(scope, dateRange);

  const empty = {
    scope: scope.mode,
    barangayLocked: scope.locked,
    barangay: null,
    totals: { seniors: 0, male: 0, female: 0, bedridden: 0, nonBedridden: 0, bedriddenPercent: 0 },
    ageGroups: AGE_BUCKETS.map((b) => ({ label: b.label, count: 0 })),
    pension: { totalBeneficiaries: 0, active: 0, inactive: 0, claims: { scheduled: 0, claimed: 0, missed: 0, cancelled: 0 } },
    applications: Object.values(APPLICATION_STATUS).map((status) => ({ status, count: 0 })),
    priority: { available: false, note: "No priority classification exists on Senior records yet." },
    byBarangay: [],
  };

  if (!pipeline) return empty; // Staff with no barangay assignment — fail closed, not "all seniors".

  const [facetResult, activeSeniorDocs, barangayDoc] = await Promise.all([
    Senior.aggregate([
      ...pipeline,
      {
        $facet: {
          total: [{ $count: "count" }],
          byGender: [{ $group: { _id: "$sex", count: { $sum: 1 } } }],
          byBedridden: [{ $group: { _id: "$bedridden", count: { $sum: 1 } } }],
          byAgeGroup: [{ $group: { _id: ageBucketSwitch(), count: { $sum: 1 } } }],
          byBarangay:
            scope.mode === "all"
              ? [
                  {
                    $group: {
                      _id: "$barangayId",
                      seniors: { $sum: 1 },
                      bedridden: { $sum: { $cond: ["$bedridden", 1, 0] } },
                    },
                  },
                ]
              : [],
        },
      },
    ]),
    // Active Senior _ids in scope — used to keep pension/application
    // counts consistent with the same "active only" population above,
    // rather than counting records tied to a rejected/pending Senior.
    Senior.aggregate([...pipeline, { $project: { _id: 1, barangayId: 1 } }]),
    scope.mode === "single" ? Barangay.findById(scope.barangayIds[0]).select("name municipality province") : null,
  ]);

  const facet = facetResult[0] || { total: [], byGender: [], byBedridden: [], byAgeGroup: [], byBarangay: [] };
  const totalSeniors = facet.total[0]?.count || 0;
  const male = facet.byGender.find((g) => g._id === "Male")?.count || 0;
  const female = facet.byGender.find((g) => g._id === "Female")?.count || 0;
  const bedridden = facet.byBedridden.find((g) => g._id === true)?.count || 0;
  const nonBedridden = facet.byBedridden.find((g) => g._id === false)?.count || 0;

  const ageGroups = AGE_BUCKETS.map((b) => ({
    label: b.label,
    count: facet.byAgeGroup.find((g) => g._id === b.label)?.count || 0,
  }));

  const activeSeniorIds = activeSeniorDocs.map((s) => s._id);
  const [pensionStats, applicationStats] = await Promise.all([
    getPensionAnalytics(activeSeniorIds, scope),
    getApplicationAnalytics(activeSeniorIds, scope),
  ]);

  let byBarangay = [];
  if (scope.mode === "all") {
    const barangays = await Barangay.find({ isActive: true }).select("name municipality").lean();
    const barangayMap = new Map(barangays.map((b) => [b._id.toString(), b]));
    // Per-barangay pension/application counts, grouped by barangay in one
    // extra pair of aggregations rather than one per barangay, so this
    // stays cheap regardless of how many barangays exist.

    const [pensionByBarangay, applicationsByBarangay] = await Promise.all([
      Pension.aggregate([
        { $match: { seniorId: { $in: activeSeniorIds } } },
        { $group: { _id: "$barangayId", count: { $sum: 1 } } },
      ]),
      BenefitApplication.aggregate([
        { $match: { seniorId: { $in: activeSeniorIds }, status: { $ne: APPLICATION_STATUS.REJECTED } } },
        { $group: { _id: "$barangayId", count: { $sum: 1 } } },
      ]),
    ]);
    const pensionCountByBarangay = new Map(pensionByBarangay.map((p) => [p._id.toString(), p.count]));
    const applicationCountByBarangay = new Map(applicationsByBarangay.map((a) => [a._id.toString(), a.count]));

    byBarangay = facet.byBarangay
      .map((row) => {
        const key = row._id.toString();
        const info = barangayMap.get(key);
        return {
          barangayId: key,
          name: info?.name || "Unknown Barangay",
          municipality: info?.municipality || "",
          seniors: row.seniors,
          bedridden: row.bedridden,
          pensionBeneficiaries: pensionCountByBarangay.get(key) || 0,
          activeApplications: applicationCountByBarangay.get(key) || 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    scope: scope.mode,
    barangayLocked: scope.locked,
    barangay: barangayDoc ? { id: barangayDoc._id, name: barangayDoc.name, municipality: barangayDoc.municipality } : null,
    totals: {
      seniors: totalSeniors,
      male,
      female,
      bedridden,
      nonBedridden,
      bedriddenPercent: totalSeniors ? Math.round((bedridden / totalSeniors) * 1000) / 10 : 0,
    },
    ageGroups,
    pension: pensionStats,
    applications: applicationStats,
    // No Senior/Barangay record anywhere in the system currently stores a
    // priority/high-priority classification — see CONCERN_PRIORITY in
    // constants.js, which classifies individual Concerns, not Seniors.
    // Inventing one here would not reflect real data, so this section is
    // explicitly reported as unavailable rather than fabricated.
    priority: { available: false, note: "No priority classification exists on Senior records yet." },
    byBarangay,
  };
}

async function getPensionAnalytics(activeSeniorIds, scope) {
  if (activeSeniorIds.length === 0) {
    return { totalBeneficiaries: 0, active: 0, inactive: 0, claims: { scheduled: 0, claimed: 0, missed: 0, cancelled: 0 } };
  }
  const pensionMatch = { seniorId: { $in: activeSeniorIds } };
  const claimMatch = { seniorId: { $in: activeSeniorIds } };
  if (scope.mode === "single") {
    pensionMatch.barangayId = new mongoose.Types.ObjectId(scope.barangayIds[0]);
    claimMatch.barangayId = new mongoose.Types.ObjectId(scope.barangayIds[0]);
  }

  const [byStatus, byClaimStatus] = await Promise.all([
    Pension.aggregate([{ $match: pensionMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    PensionClaim.aggregate([{ $match: claimMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const active = byStatus.find((s) => s._id === PENSION_STATUS.ACTIVE)?.count || 0;
  const inactive = byStatus.find((s) => s._id === PENSION_STATUS.INACTIVE)?.count || 0;

  return {
    totalBeneficiaries: active + inactive,
    active,
    inactive,
    claims: {
      scheduled: byClaimStatus.find((c) => c._id === CLAIM_STATUS.SCHEDULED)?.count || 0,
      claimed: byClaimStatus.find((c) => c._id === CLAIM_STATUS.CLAIMED)?.count || 0,
      missed: byClaimStatus.find((c) => c._id === CLAIM_STATUS.MISSED)?.count || 0,
      cancelled: byClaimStatus.find((c) => c._id === CLAIM_STATUS.CANCELLED)?.count || 0,
    },
  };
}

async function getApplicationAnalytics(activeSeniorIds, scope) {
  const zero = Object.values(APPLICATION_STATUS).map((status) => ({ status, count: 0 }));
  if (activeSeniorIds.length === 0) return zero;

  const match = { seniorId: { $in: activeSeniorIds } };
  if (scope.mode === "single") {
    match.barangayId = new mongoose.Types.ObjectId(scope.barangayIds[0]);
  }
  const grouped = await BenefitApplication.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  return Object.values(APPLICATION_STATUS).map((status) => ({
    status,
    count: grouped.find((g) => g._id === status)?.count || 0,
  }));
}

/**
 * Senior Mapping markers. As of this implementation, NO existing model —
 * Senior, its embedded address, or Barangay — stores any geographic
 * coordinate (checked: no latitude/longitude/geo field anywhere in the
 * schema). Fabricating coordinates (barangay-center placement, random
 * jitter, etc.) was explicitly ruled out, so this honestly reports that
 * no Senior currently has a mappable location, while still returning the
 * in-scope population count so the UI can show "N Seniors have no mapped
 * location" instead of a misleadingly empty screen.
 *
 * If/when a location-collection mechanism is added to Senior (e.g. a
 * `location: { lat, lng }` field captured at registration or profile
 * update), this is the one place to add a $match for it and start
 * returning real markers — the scope-resolution logic above already
 * works correctly for that; only the marker-building step is missing.
 */
export async function getSeniorMapMarkers(requestingUser, { barangayId } = {}) {
  const scope = resolveScope(requestingUser, barangayId);
  const pipeline = activeSeniorPipeline(scope);
  if (!pipeline) {
    return { markers: [], totalInScope: 0, unmappedCount: 0, hasLocationData: false };
  }
  const totalInScope = await Senior.aggregate([...pipeline, { $count: "count" }]);
  const count = totalInScope[0]?.count || 0;
  return {
    markers: [],
    totalInScope: count,
    unmappedCount: count,
    hasLocationData: false,
  };
}
