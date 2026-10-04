import { api, toApiError } from "../utils/api.js";

/**
 * Barangay Staff / Admin / LGU-OSCA pension management API.
 * Backend enforces barangay scoping server-side (pension.service.js /
 * pensionSchedule.service.js / pensionClaim.service.js) — this client
 * never needs to (and cannot) widen access by passing a different
 * barangayId; the server ignores/rejects that for BARANGAY_STAFF.
 */

// ---- Pension records ----

export async function listPensions({ search, pensionType, status } = {}) {
  try {
    const res = await api.get("/pensions", { params: { search, pensionType, status } });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function listEligibleSeniors(search, barangayId) {
  try {
    const res = await api.get("/pensions/eligible-seniors", { params: { search, barangayId } });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createPension(input) {
  try {
    const res = await api.post("/pensions", input);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updatePension(pensionId, updates) {
  try {
    const res = await api.patch(`/pensions/${pensionId}`, updates);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---- Claiming schedules ----

export async function listSchedules({ upcomingOnly } = {}) {
  try {
    const res = await api.get("/pension-schedules", { params: { upcomingOnly } });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Barangay options for the Create Claiming Schedule form.
 * BARANGAY_STAFF always gets back exactly their own assigned barangay
 * (for a read-only display); ADMIN/LGU_OSCA get every barangay to
 * choose from. Resolved server-side from the authenticated user's role —
 * this call can't be used to discover a different set than the caller
 * is actually allowed to create schedules for.
 */
export async function listSchedulingBarangays() {
  try {
    const res = await api.get("/pension-schedules/barangays");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createSchedule(input) {
  try {
    const res = await api.post("/pension-schedules", input);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function closeSchedule(scheduleId) {
  try {
    const res = await api.patch(`/pension-schedules/${scheduleId}/close`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---- Claims / QR verification ----

export async function listClaims({ scheduleId, date } = {}) {
  try {
    const res = await api.get("/pension-claims", { params: { scheduleId, date } });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

// Step 1: resolve a scanned/entered QR token into claim details for
// review. This NEVER marks the claim as claimed — see confirmClaim().
export async function resolveClaim(qrToken) {
  try {
    const res = await api.post("/pension-claims/verify", { qrToken });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// Step 2: Staff explicitly confirms the claim just resolved. This is the
// only call that actually transitions the claim to CLAIMED.
export async function confirmClaim(qrToken) {
  try {
    const res = await api.post("/pension-claims/confirm", { qrToken });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
