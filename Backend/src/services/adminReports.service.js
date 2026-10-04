import User from "../models/User.js";
import Senior from "../models/Senior.js";
import Barangay from "../models/Barangay.js";
import { ROLES, ACCOUNT_STATUS } from "../utils/constants.js";
import { getSeniorAnalytics } from "./analytics.service.js";

/**
 * Admin System Reports — system-wide, database-driven reporting for
 * ADMIN only. Deliberately does NOT duplicate the Senior/demographic/
 * pension/application aggregation logic already built for Senior
 * Mapping & Barangay Analytics (analytics.service.js#getSeniorAnalytics)
 * — that function already supports exactly what this module needs
 * (consolidated system-wide view by default, or narrowed to one
 * barangay via `barangayId`, plus the byBarangay comparison table) since
 * ADMIN already has broad barangay access there. This module only adds
 * what Barangay Analytics does not already provide: barangay-level
 * totals/coverage, system-wide user/account statistics, and CSV export
 * (see utils/csv.js and adminReports.controller.js).
 *
 * Role enforcement itself lives in the route (`authorizeRoles(ROLES.ADMIN)`
 * in adminReports.routes.js) — every function here still assumes it is
 * only ever called for an ADMIN requestingUser, exactly like
 * admin.routes.js's own adminOnly convention.
 */

function parseDateRange({ from, to } = {}) {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.from = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // Inclusive of the whole "to" day when only a date (no time) is given.
      if (to.length <= 10) d.setHours(23, 59, 59, 999);
      range.to = d;
    }
  }
  return Object.keys(range).length ? range : undefined;
}

function buildCreatedAtMatch(dateRange) {
  const match = {};
  if (dateRange?.from || dateRange?.to) {
    match.createdAt = {};
    if (dateRange.from) match.createdAt.$gte = dateRange.from;
    if (dateRange.to) match.createdAt.$lte = dateRange.to;
  }
  return match;
}

/**
 * Barangay coverage stats that Barangay Analytics doesn't compute
 * (it reports per-barangay senior counts, but not how many barangays
 * exist system-wide or how many currently have zero active Seniors).
 * "Barangay with the highest senior population" is returned as a plain
 * factual count — the frontend must not present it as "best barangay"
 * or attach any ranking language (per module requirements).
 */
async function getBarangayCoverage(dateRange) {
  const [totalBarangays, seniorCountsByBarangay] = await Promise.all([
    Barangay.countDocuments({ isActive: true }),
    Senior.aggregate([
      { $match: buildCreatedAtMatch(dateRange) },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $match: { "user.status": ACCOUNT_STATUS.ACTIVE } },
      { $group: { _id: "$barangayId", count: { $sum: 1 } } },
    ]),
  ]);

  const barangaysWithActiveSeniors = seniorCountsByBarangay.length;
  let highestPopulation = null;
  if (seniorCountsByBarangay.length > 0) {
    const top = seniorCountsByBarangay.reduce((a, b) => (b.count > a.count ? b : a));
    const barangay = await Barangay.findById(top._id).select("name municipality");
    if (barangay) {
      highestPopulation = {
        barangayId: barangay._id,
        name: barangay.name,
        municipality: barangay.municipality,
        seniors: top.count,
      };
    }
  }

  return { totalBarangays, barangaysWithActiveSeniors, highestPopulation };
}

/**
 * System-wide User/Account statistics — every role and every
 * ACCOUNT_STATUS value that actually exists on the User model, nothing
 * invented. Optional `dateRange` filters by User.createdAt (account
 * creation time) — same field/definition analytics.service.js's Senior
 * date filter uses.
 */
export async function getUserAccountStats({ dateRange } = {}) {
  const match = buildCreatedAtMatch(dateRange);
  const [byRole, byStatus, total] = await Promise.all([
    User.aggregate([{ $match: match }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
    User.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.countDocuments(match),
  ]);

  const roleCounts = {};
  Object.values(ROLES).forEach((role) => {
    roleCounts[role] = byRole.find((r) => r._id === role)?.count || 0;
  });
  const statusCounts = {};
  Object.values(ACCOUNT_STATUS).forEach((status) => {
    statusCounts[status] = byStatus.find((s) => s._id === status)?.count || 0;
  });

  return { total, byRole: roleCounts, byStatus: statusCounts };
}

/**
 * Full Admin System Reports payload: reuses getSeniorAnalytics for the
 * senior/demographic/bedridden/pension/application/byBarangay sections
 * (consolidated system-wide, or narrowed to one barangay if `barangayId`
 * is supplied — ADMIN already has broad access there), and adds the two
 * sections that module doesn't cover: barangay coverage and user/account
 * statistics.
 */
export async function getSystemReport(requestingUser, { barangayId, from, to } = {}) {
  const dateRange = parseDateRange({ from, to });

  const [seniorReport, barangayCoverage, userStats] = await Promise.all([
    getSeniorAnalytics(requestingUser, { barangayId, dateRange }),
    // Barangay coverage is intentionally always system-wide (it answers
    // "how many barangays exist / have Seniors", which a single-barangay
    // filter can't meaningfully narrow) — matches the module's own
    // requirement that filtering to one barangay doesn't change the
    // Administrator's system-level scope.
    getBarangayCoverage(dateRange),
    getUserAccountStats({ dateRange }),
  ]);

  return {
    ...seniorReport,
    dateRange: dateRange ? { from: dateRange.from || null, to: dateRange.to || null } : null,
    barangayCoverage,
    users: userStats,
  };
}

/** Barangay picker for the report filter — every active barangay, since Admin scope is never locked. */
export async function listReportBarangays() {
  return Barangay.find({ isActive: true }).select("name municipality province").sort({ name: 1 });
}
