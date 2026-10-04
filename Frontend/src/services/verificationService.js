import { api, toApiError } from "../utils/api.js";

/**
 * Frontend API layer for the Barangay/Admin verification workflow.
 * Backend: src/routes/verification.routes.js -> verification.controller.js
 * All endpoints require an authenticated BARANGAY_STAFF / ADMIN / LGU_OSCA
 * session — the `api` instance's request interceptor (utils/api.js)
 * attaches the stored access token automatically.
 */

/**
 * GET /api/verifications/pending
 * Returns senior registrations, scoped server-side to the staff
 * member's assigned barangay (Administrators/LGU_OSCA see more broadly,
 * optionally narrowed with `barangayId`).
 *
 * `status` defaults to "PENDING" (unchanged behavior). Pass "APPROVED",
 * "REJECTED", or "ALL" to find a Senior after their registration has
 * already been reviewed — e.g. to reach "Create Guardian Login" on
 * their review page, which only appears once APPROVED.
 *
 * Returns: { items, meta: { total, page, limit, totalPages } }
 */
export async function getPendingVerifications({ search = "", page = 1, limit = 10, barangayId = "", status = "" } = {}) {
  try {
    const res = await api.get("/verifications/pending", {
      params: { search, page, limit, ...(barangayId ? { barangayId } : {}), ...(status ? { status } : {}) },
    });
    const body = res.data;
    return {
      items: Array.isArray(body?.data) ? body.data : [],
      meta: body?.meta || { total: 0, page: 1, limit, totalPages: 1 },
    };
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * GET /api/verifications/stats
 * Returns { pending, active, rejected, total } scoped the same way as
 * getPendingVerifications.
 */
export async function getVerificationStats() {
  try {
    const res = await api.get("/verifications/stats");
    return res.data?.data || { pending: 0, active: 0, rejected: 0, total: 0 };
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * GET /api/verifications/:id
 * Full registration detail for the review page: personal info, contact
 * info, senior status, guardian (if any), and document metadata.
 */
export async function getVerificationDetail(verificationId) {
  try {
    const res = await api.get(`/verifications/${verificationId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Builds the URL used to view/download a specific document. The browser
 * request itself still needs the Authorization header, so this is used
 * as the `src`/href only after fetching the file as a blob (see
 * fetchDocumentBlobUrl) — an <img>/<a> tag alone can't attach headers.
 */
function documentEndpoint(documentId) {
  const base = api.defaults.baseURL || "";
  return `${base}/verifications/documents/${documentId}/file`;
}

/**
 * Fetches a protected document and returns a local object URL suitable
 * for an <img src> or opening in a new tab. Caller is responsible for
 * revoking the URL (URL.revokeObjectURL) when done with it.
 */
export async function fetchDocumentBlobUrl(documentId) {
  try {
    const res = await api.get(`/verifications/documents/${documentId}/file`, {
      responseType: "blob",
    });
    return URL.createObjectURL(res.data);
  } catch (err) {
    throw toApiError(err);
  }
}

export { documentEndpoint };

/**
 * PATCH /api/verifications/:id/approve
 */
export async function approveVerification(verificationId, { remarks = "" } = {}) {
  try {
    const res = await api.patch(`/verifications/${verificationId}/approve`, { remarks });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * PATCH /api/verifications/:id/reject
 */
export async function rejectVerification(verificationId, { reason }) {
  try {
    const res = await api.patch(`/verifications/${verificationId}/reject`, { reason });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * POST /api/verifications/guardians/:guardianRecordId/create-account
 * Provisions a distinct GUARDIAN-role login for an already
 * authorization-confirmed Guardian record (see admin.service.js's
 * createGuardianAccount on the backend) — only reachable once the
 * Senior's own registration has been approved, which is what actually
 * confirms the Guardian's submitted authorization documents.
 */
export async function createGuardianAccount(guardianRecordId, { email, password } = {}) {
  try {
    const res = await api.post(`/verifications/guardians/${guardianRecordId}/create-account`, {
      email,
      ...(password ? { password } : {}),
    });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * POST /api/verifications/guardians/:guardianRecordId/reset-password
 * Recovery path when the one-time temporary password from account
 * creation was lost — generates and returns a new one, shown exactly
 * once the same way.
 */
export async function resetGuardianPassword(guardianRecordId, { password } = {}) {
  try {
    const res = await api.post(`/verifications/guardians/${guardianRecordId}/reset-password`, password ? { password } : {});
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
