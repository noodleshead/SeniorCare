import { api, toApiError } from "../utils/api.js";

/**
 * Announcement API.
 * Backend: announcement.routes.js -> announcement.controller.js -> announcement.service.js
 *
 * Senior/Guardian calls resolve the acting Senior from the authenticated
 * token server-side (see utils/guardianAccess.js) — there is no
 * seniorId/barangayId anywhere in these calls to tamper with.
 * Staff/Admin calls are barangay-scoped server-side for BARANGAY_STAFF.
 */

/** Senior/Guardian: published announcements applicable to them. */
export async function getMyAnnouncements({ category, search } = {}) {
  try {
    const params = {};
    if (category) params.category = category;
    if (search) params.search = search;
    const res = await api.get("/announcements/me", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

/** Staff/Admin/LGU-OSCA management listing. */
export async function listAnnouncements({ status, category, search, barangayId } = {}) {
  try {
    const params = {};
    if (status) params.status = status;
    if (category) params.category = category;
    if (search) params.search = search;
    if (barangayId) params.barangayId = barangayId;
    const res = await api.get("/announcements", { params });
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getAnnouncement(announcementId) {
  try {
    const res = await api.get(`/announcements/${announcementId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createAnnouncement(payload) {
  try {
    const res = await api.post("/announcements", payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateAnnouncement(announcementId, payload) {
  try {
    const res = await api.patch(`/announcements/${announcementId}`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function publishAnnouncement(announcementId) {
  try {
    const res = await api.patch(`/announcements/${announcementId}/publish`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function archiveAnnouncement(announcementId) {
  try {
    const res = await api.patch(`/announcements/${announcementId}/archive`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteAnnouncement(announcementId) {
  try {
    const res = await api.delete(`/announcements/${announcementId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
