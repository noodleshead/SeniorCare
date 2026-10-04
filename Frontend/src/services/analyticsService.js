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
export async function getSeniorAnalyticsSummary(barangayId) {
  try {
    const res = await api.get("/analytics/summary", { params: { barangayId } });
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
