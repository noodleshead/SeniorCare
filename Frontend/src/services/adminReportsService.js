import { api, toApiError } from "../utils/api.js";

/**
 * Admin System Reports — ADMIN only. The backend rejects any other role
 * regardless of what this client sends (adminReports.routes.js's
 * adminOnly middleware), so there is no client-side scoping to enforce
 * here beyond simply not showing the page/nav item to other roles.
 */

export async function getReportBarangays() {
  try {
    const res = await api.get("/admin-reports/barangays");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getSystemReport({ barangayId, from, to } = {}) {
  try {
    const res = await api.get("/admin-reports", { params: { barangayId, from, to } });
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

const EXPORT_ENDPOINTS = {
  barangaySummary: "/admin-reports/export/barangay-summary.csv",
  demographics: "/admin-reports/export/demographics.csv",
  pension: "/admin-reports/export/pension.csv",
  applications: "/admin-reports/export/applications.csv",
  users: "/admin-reports/export/users.csv",
};

/**
 * Downloads a CSV export using the SAME filters currently applied to the
 * report on screen, so the exported file always matches what's visible —
 * never a separate, potentially-stale dataset.
 */
export async function downloadReportCsv(reportKey, { barangayId, from, to } = {}) {
  const url = EXPORT_ENDPOINTS[reportKey];
  if (!url) throw new Error(`Unknown report export: ${reportKey}`);
  try {
    const res = await api.get(url, { params: { barangayId, from, to }, responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${reportKey}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    throw toApiError(err);
  }
}
