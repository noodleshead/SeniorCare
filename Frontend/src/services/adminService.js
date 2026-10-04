import { api, toApiError } from "../utils/api.js";

/**
 * Frontend API layer for Admin-only organizational management.
 * Backend: src/routes/admin.routes.js -> admin.controller.js -> admin.service.js
 * All endpoints require an authenticated ADMIN session.
 */

// ---- Barangays ----

export async function getBarangaysWithStats() {
  try {
    const res = await api.get("/admin/barangays");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createBarangay({ name, municipality, province, code }) {
  try {
    const res = await api.post("/admin/barangays", { name, municipality, province, code });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---- Barangay Staff ----

export async function getStaffList() {
  try {
    const res = await api.get("/admin/staff");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getStaffDetail(staffId) {
  try {
    const res = await api.get(`/admin/staff/${staffId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Returns { user, temporaryPassword }. `temporaryPassword` is only present
 * when the admin didn't supply one — it's returned exactly once, at
 * creation time, and never retrievable afterward.
 */
export async function createStaffAccount({ email, username, assignedBarangayId, password, status }) {
  try {
    const res = await api.post("/admin/staff", {
      email,
      ...(username ? { username } : {}),
      assignedBarangayId,
      ...(password ? { password } : {}),
      ...(status ? { status } : {}),
    });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateStaffAssignment(staffId, assignedBarangayId) {
  try {
    const res = await api.patch(`/admin/staff/${staffId}/assignment`, { assignedBarangayId });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateStaffStatus(staffId, status) {
  try {
    const res = await api.patch(`/admin/staff/${staffId}/status`, { status });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
