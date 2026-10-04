import { api, toApiError } from "../utils/api.js";

/**
 * Reports/Concerns API.
 * Backend: concern.routes.js -> concern.controller.js -> concern.service.js
 *
 * Senior/Guardian calls resolve the acting Senior from the authenticated
 * token server-side (see utils/guardianAccess.js) — there is no
 * seniorId/barangayId anywhere in these calls to tamper with.
 * Staff/Admin calls are barangay-scoped server-side for BARANGAY_STAFF.
 */

// ---------------- Senior/Guardian-facing ----------------

export async function submitConcern(payload, seniorId) {
  try {
    const res = await api.post("/concerns", payload, seniorId ? { params: { seniorId } } : undefined);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyConcerns({ status, category, search, seniorId } = {}) {
  try {
    const params = {};
    if (status) params.status = status;
    if (category) params.category = category;
    if (search) params.search = search;
    if (seniorId) params.seniorId = seniorId;
    const res = await api.get("/concerns/me", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyConcern(concernId, seniorId) {
  try {
    const res = await api.get(`/concerns/me/${concernId}`, seniorId ? { params: { seniorId } } : undefined);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Staff/Admin/LGU-OSCA-facing ----------------

export async function listConcerns({ status, priority, category, search, barangayId } = {}) {
  try {
    const params = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (category) params.category = category;
    if (search) params.search = search;
    if (barangayId) params.barangayId = barangayId;
    const res = await api.get("/concerns", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getConcern(concernId) {
  try {
    const res = await api.get(`/concerns/${concernId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function changeConcernStatus(concernId, toStatus, note) {
  try {
    const res = await api.patch(`/concerns/${concernId}/status`, note ? { toStatus, note } : { toStatus });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function setConcernPriority(concernId, priority, reason) {
  try {
    const res = await api.patch(`/concerns/${concernId}/priority`, { priority, reason });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function respondToConcern(concernId, message) {
  try {
    const res = await api.post(`/concerns/${concernId}/respond`, { message });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
