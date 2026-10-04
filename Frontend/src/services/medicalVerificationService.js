import { api, toApiError } from "../utils/api.js";

// Admin Medical Verification — ADMIN only (backend rejects every other
// role regardless of what this client sends). Document viewing reuses
// verificationService.js#fetchDocumentBlobUrl — the same secure,
// existing document mechanism, not a duplicate.

export async function listMedicalVerifications(params) {
  try {
    const res = await api.get("/admin/medical-verification", { params });
    return { items: res.data?.data || [], pagination: res.data?.pagination };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMedicalVerification(seniorId) {
  try {
    const res = await api.get(`/admin/medical-verification/${seniorId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function recordMedicalVerificationDecision(seniorId, payload) {
  try {
    const res = await api.post(`/admin/medical-verification/${seniorId}/decision`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
