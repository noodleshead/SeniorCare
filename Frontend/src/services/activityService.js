import { api, toApiError } from "../utils/api.js";

/**
 * Social Activities API.
 * Backend: activity.routes.js -> activity.controller.js -> activity.service.js
 *
 * Senior/Guardian calls resolve the acting Senior from the authenticated
 * token server-side (see utils/guardianAccess.js) — there is no
 * seniorId/barangayId anywhere in these calls to tamper with.
 * Staff/Admin calls are barangay-scoped server-side for BARANGAY_STAFF.
 */

/** Senior/Guardian: activities in their own Barangay. `when`: "upcoming" | "past" | undefined (all). */
export async function getMyActivities({ when, category, search } = {}) {
  try {
    const params = {};
    if (when) params.when = when;
    if (category) params.category = category;
    if (search) params.search = search;
    const res = await api.get("/activities/me", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyActivity(activityId) {
  try {
    const res = await api.get(`/activities/me/${activityId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function confirmAttendance(activityId) {
  try {
    const res = await api.post(`/activities/${activityId}/attendance`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function withdrawAttendance(activityId) {
  try {
    const res = await api.delete(`/activities/${activityId}/attendance`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/** Staff/Admin/LGU-OSCA management listing. */
export async function listActivities({ status, category, search, barangayId } = {}) {
  try {
    const params = {};
    if (status) params.status = status;
    if (category) params.category = category;
    if (search) params.search = search;
    if (barangayId) params.barangayId = barangayId;
    const res = await api.get("/activities", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getActivity(activityId) {
  try {
    const res = await api.get(`/activities/${activityId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createActivity(payload) {
  try {
    const res = await api.post("/activities", payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateActivity(activityId, payload) {
  try {
    const res = await api.patch(`/activities/${activityId}`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function publishActivity(activityId) {
  try {
    const res = await api.patch(`/activities/${activityId}/publish`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function cancelActivity(activityId, reason) {
  try {
    const res = await api.patch(`/activities/${activityId}/cancel`, reason ? { reason } : {});
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteActivity(activityId) {
  try {
    const res = await api.delete(`/activities/${activityId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function listAttendees(activityId) {
  try {
    const res = await api.get(`/activities/${activityId}/attendees`);
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}
