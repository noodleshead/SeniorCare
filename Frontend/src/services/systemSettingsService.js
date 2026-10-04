import { api, toApiError } from "../utils/api.js";

// System Settings — ADMIN only for get/update (backend rejects any
// other role regardless of what this client sends). `getPublicSettings`
// is the one unauthenticated exception — display-only branding info.

export async function getPublicSettings() {
  try {
    const res = await api.get("/settings/public");
    return res.data?.data;
  } catch {
    // Branding is cosmetic — if this fails (e.g. before the backend is
    // reachable), callers fall back to the hardcoded "SENIORCARE" name
    // rather than surfacing an error for a non-essential request.
    return null;
  }
}

export async function getSystemSettings() {
  try {
    const res = await api.get("/settings");
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateSettingsSection(section, payload) {
  try {
    const res = await api.put(`/settings/${section}`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
