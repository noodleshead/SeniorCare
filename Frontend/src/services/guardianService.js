import { api, toApiError } from "../utils/api.js";

/**
 * Guardian API.
 * Backend: guardian.routes.js -> guardian.controller.js -> guardian.service.js
 *
 * Every call resolves the authenticated Guardian from the token —
 * there is no guardianId anywhere in these calls to tamper with. Where
 * a specific managed Senior matters, ?seniorId= is passed and re-verified
 * server-side against this Guardian's own authorized Seniors on every
 * single request (see utils/guardianAccess.js's resolveActingSenior) —
 * the selected-senior value kept in the browser (see below) is a UX
 * convenience only, never treated as authorization by itself.
 */

export async function getGuardianDashboard() {
  try {
    const res = await api.get("/guardian/dashboard");
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getManagedSeniors() {
  try {
    const res = await api.get("/guardian/seniors");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getManagedSenior(seniorId) {
  try {
    const res = await api.get(`/guardian/seniors/${seniorId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Selected-senior context (UX only, not authorization) ----------------

const SELECTED_SENIOR_KEY = "seniorcare_guardian_selected_senior";

export function getSelectedSeniorId() {
  return localStorage.getItem(SELECTED_SENIOR_KEY) || null;
}

export function setSelectedSeniorId(seniorId) {
  if (seniorId) localStorage.setItem(SELECTED_SENIOR_KEY, seniorId);
  else localStorage.removeItem(SELECTED_SENIOR_KEY);
}

/** GET /api/guardian/me — the Guardian's own contact details. */
export async function getMyGuardianProfile() {
  try {
    const res = await api.get("/guardian/me");
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * PATCH /api/guardian/me — name/mobile/address only. Relationship, ID,
 * login email, and which Seniors this Guardian is authorized for can't
 * be changed from here (the backend schema has no such fields).
 */
export async function updateMyGuardianProfile(payload) {
  try {
    const res = await api.patch("/guardian/me", payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
