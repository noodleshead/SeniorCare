import { api, toApiError } from "../utils/api.js";

/**
 * Senior Mapping & Barangay Analytics — Barangay Staff / Admin / LGU-OSCA
 * only. The backend resolves barangay scope from the authenticated user
 * (analytics.service.js#resolveScope): a BARANGAY_STAFF caller's
 * `barangayId` is always their own assignment no matter what is passed
 * here, so this client never needs to (and cannot) widen access.
 */

// Barangays the current user may filter by. BARANGAY_STAFF gets back only
// their own assigned barangay (read-only — nothing to actually pick);
// ADMIN/LGU_OSCA get every active barangay, for the LGU consolidated view.
export async function getAnalyticsBarangays() {
  try {
    const res = await api.get("/analytics/barangays");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

// barangayId is an optional narrowing filter. Ignored server-side for
// BARANGAY_STAFF (always their own); for ADMIN/LGU_OSCA, omitting it
// returns the consolidated multi-barangay view (with `byBarangay`
// comparison data), passing it returns that one barangay's summary.
export async function getSeniorAnalyticsSummary(barangayId, { pensionMonth, pensionYear } = {}) {
  try {
    // pensionMonth/pensionYear (Phase 8) only narrow the pension *claim*
    // counts server-side — see analytics.service.js#getPensionAnalytics.
    const res = await api.get("/analytics/summary", { params: { barangayId, pensionMonth, pensionYear } });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getSeniorMapMarkers(barangayId) {
  try {
    const res = await api.get("/analytics/map", { params: { barangayId } });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

const EXPORT_PATHS = {
  barangayComparison: "/analytics/export/barangay-comparison.csv",
  workflow: "/analytics/export/workflow.csv",
};

/**
 * Phase 8 — downloads a CSV for the filters currently applied. The
 * server re-derives it (same scoping as /summary) rather than trusting
 * any client-supplied data, and records an audit entry.
 */
export async function downloadAnalyticsCsv(reportKey, barangayId) {
  const url = EXPORT_PATHS[reportKey];
  if (!url) throw new Error(`Unknown export: ${reportKey}`);
  try {
    const res = await api.get(url, { params: { barangayId }, responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${reportKey}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    throw toApiError(err);
  }
}
