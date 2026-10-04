import { api, toApiError } from "../utils/api.js";

// Admin Illness Database — ADMIN only (backend rejects every other role
// regardless of what this client sends). Distinct from
// registrationService.js#getIllnesses, which is the public, unauthenticated,
// active-only, name-only list the registration dropdown uses.

export async function listIllnesses(params) {
  try {
    const res = await api.get("/admin/illnesses", { params });
    return { items: res.data?.data || [], pagination: res.data?.pagination };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createIllness(payload) {
  try {
    const res = await api.post("/admin/illnesses", payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateIllness(id, payload) {
  try {
    const res = await api.patch(`/admin/illnesses/${id}`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function setIllnessStatus(id, isActive) {
  try {
    const res = await api.patch(`/admin/illnesses/${id}/status`, { isActive });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
