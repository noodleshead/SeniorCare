import { api, toApiError } from "../utils/api.js";

// Admin User Management — ADMIN only (backend rejects every other role).

export async function listUsers(params) {
  try {
    const res = await api.get("/admin/users", { params });
    return { items: res.data?.data || [], pagination: res.data?.pagination };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getUserDetail(userId) {
  try {
    const res = await api.get(`/admin/users/${userId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function setUserStatus(userId, status) {
  try {
    const res = await api.patch(`/admin/users/${userId}/status`, { status });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateSeniorProfileAsAdmin(userId, payload) {
  try {
    const res = await api.patch(`/admin/users/${userId}/senior-profile`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
