import { api, toApiError } from "../utils/api.js";

// Audit Logs — ADMIN only (backend rejects any other role regardless of
// what this client sends). Read-only: no create/update/delete calls
// exist here, matching that there is no such endpoint on the backend.

export async function listAuditLogs(params) {
  try {
    const res = await api.get("/audit-logs", { params });
    return { items: res.data?.data || [], pagination: res.data?.pagination };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getAuditLogSummary() {
  try {
    const res = await api.get("/audit-logs/summary");
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getAuditLog(id) {
  try {
    const res = await api.get(`/audit-logs/${id}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
