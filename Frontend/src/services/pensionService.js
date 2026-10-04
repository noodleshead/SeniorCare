import { api, toApiError } from "../utils/api.js";

/**
 * Senior self-service pension API.
 * Backend: pension.routes.js / pensionSchedule.routes.js / pensionClaim.routes.js
 * All endpoints resolve the Senior from the authenticated token — there is
 * no seniorId anywhere in these calls for a Senior to tamper with.
 */

function withSeniorId(seniorId) {
  return seniorId ? { params: { seniorId } } : undefined;
}

export async function getMyPension() {
  try {
    const res = await api.get("/pensions/me");
    return res.data?.data || null;
  } catch (err) {
    throw toApiError(err);
  }
}

/** Currently bookable (OPEN, upcoming) claiming schedules for the Senior's own Barangay. */
export async function getMyBarangaySchedules() {
  try {
    const res = await api.get("/pension-schedules/me");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * seniorId is optional and only meaningful for a GUARDIAN account
 * managing more than one Senior (see guardian.service.js's
 * resolveActingSenior threading on the backend) — a Senior calling
 * these normally omits it entirely, unchanged from before.
 */
export async function getMyUpcomingClaim(seniorId) {
  try {
    const res = await api.get("/pension-claims/me/upcoming", withSeniorId(seniorId));
    return res.data?.data || null;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyClaimHistory(seniorId) {
  try {
    const res = await api.get("/pension-claims/me/history", withSeniorId(seniorId));
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyClaimQr(claimId, seniorId) {
  try {
    const res = await api.get(`/pension-claims/me/${claimId}/qr`, withSeniorId(seniorId));
    return res.data?.data; // { claim, qrDataUrl }
  } catch (err) {
    throw toApiError(err);
  }
}

export async function bookClaimingSlot({ scheduleId, slotId }, seniorId) {
  try {
    const res = await api.post("/pension-claims", { scheduleId, slotId }, withSeniorId(seniorId));
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function cancelClaimingBooking(claimId, seniorId) {
  try {
    const res = await api.post(`/pension-claims/${claimId}/cancel`, {}, withSeniorId(seniorId));
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
