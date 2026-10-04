import { api, toApiError } from "../utils/api.js";

/**
 * Barangay Staff / Admin / LGU-OSCA Benefits & Assistance management API.
 * Backend enforces barangay scoping and stage-appropriate role checks
 * server-side (benefitApplication.service.js) — this client never needs
 * to (and cannot) widen access by passing a different barangayId.
 */

// ---- Benefit programs ----

export async function listPrograms({ status, category } = {}) {
  try {
    const res = await api.get("/benefits", { params: { status, category } });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getProgram(programId) {
  try {
    const res = await api.get(`/benefits/${programId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createProgram(input) {
  try {
    const res = await api.post("/benefits", input);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateProgram(programId, updates) {
  try {
    const res = await api.patch(`/benefits/${programId}`, updates);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---- Applications ----

export async function listApplications({ status, benefitProgramId, barangayId, search } = {}) {
  try {
    const res = await api.get("/benefit-applications", { params: { status, benefitProgramId, barangayId, search } });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getApplication(applicationId) {
  try {
    const res = await api.get(`/benefit-applications/${applicationId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Phase 7 — OSCA final review payload: the application plus the Senior's
 * Barangay verification/Home Visit/Endorsement context (Phase 5/6
 * fields). Admin/LGU-OSCA only; the backend rejects any other role.
 */
export async function getOscaDetail(applicationId) {
  try {
    const res = await api.get(`/benefit-applications/${applicationId}/osca-detail`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/** Phase 7 — OSCA's third decision: return an endorsed application to the Barangay. */
export async function requestRevision(applicationId, remarks) {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/request-revision`, { remarks });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Fetches a protected application document and returns a local object
 * URL suitable for an <img src> or opening in a new tab — mirrors
 * verificationService.js#fetchDocumentBlobUrl exactly, since a plain
 * <img>/<a> URL can't carry the Authorization header this endpoint
 * requires. Caller is responsible for revoking the URL when done.
 */
export async function fetchApplicationDocumentBlobUrl(documentId) {
  try {
    const res = await api.get(`/benefit-applications/documents/${documentId}/file`, { responseType: "blob" });
    return URL.createObjectURL(res.data);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function startReview(applicationId) {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/start-review`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function endorseApplication(applicationId, remarks = "") {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/endorse`, { remarks });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function rejectApplication(applicationId, reason) {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/reject`, { reason });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function approveApplication(applicationId, remarks = "") {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/approve`, { remarks });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function releaseApplication(applicationId, remarks = "") {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/release`, { remarks });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function completeApplication(applicationId, remarks = "") {
  try {
    const res = await api.patch(`/benefit-applications/${applicationId}/complete`, { remarks });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
