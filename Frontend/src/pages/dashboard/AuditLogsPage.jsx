import { useCallback, useEffect, useState } from "react";
import { Search, X, Loader2, AlertCircle, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { listAuditLogs, getAuditLogSummary, getAuditLog } from "../../services/auditLogService.js";
import { getReportBarangays } from "../../services/adminReportsService.js";
import { SummaryCard } from "./components/ReportWidgets.jsx";

// Mirrors AUDIT_ACTIONS / AUDIT_MODULES in Backend/src/utils/constants.js
// — kept as plain arrays here since only ADMIN ever sees this page and
// the vocabulary is small and stable; update both sides together if the
// backend list changes.
const ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET",
  "CREATE",
  "ACTIVATE",
  "DEACTIVATE",
  "RESET_PASSWORD",
  "APPROVE",
  "REJECT",
  "ENDORSE",
  "RELEASE",
  "COMPLETE",
  "CLAIM",
  "CANCEL",
  "EXPORT",
];
const MODULES = ["AUTH", "USER_MANAGEMENT", "VERIFICATION", "GUARDIAN", "PENSION", "BENEFITS", "REPORTS"];
const ROLE_LABELS = {
  SENIOR_CITIZEN: "Senior",
  GUARDIAN: "Guardian",
  BARANGAY_STAFF: "Barangay Staff",
  ADMIN: "Administrator",
  LGU_OSCA: "LGU-OSCA",
};
const ROLES = Object.keys(ROLE_LABELS);

const ACTION_BADGE_COLORS = {
  APPROVE: "#2f7d43",
  ACTIVATE: "#2f7d43",
  CLAIM: "#2f7d43",
  COMPLETE: "#2f7d43",
  RELEASE: COLORS.cerulean,
  CREATE: COLORS.cerulean,
  LOGIN: COLORS.cerulean,
  REJECT: "#b8452f",
  DEACTIVATE: "#b8452f",
  CANCEL: "#b8452f",
  RESET_PASSWORD: COLORS.baltic,
  PASSWORD_RESET: COLORS.baltic,
  PASSWORD_RESET_REQUESTED: COLORS.baltic,
  LOGOUT: "#64748b",
  ENDORSE: COLORS.baltic,
  EXPORT: COLORS.baltic,
};

function ActionBadge({ action }) {
  const color = ACTION_BADGE_COLORS[action] || COLORS.baltic;
  return (
    <span
      className="inline-block text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: color + "1a" }}
    >
      {action}
    </span>
  );
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailDrawer({ logId, onClose }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAuditLog(logId)
      .then(setLog)
      .finally(() => setLoading(false));
  }, [logId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full overflow-y-auto p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: COLORS.yale }}>
            Audit Log Details
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" aria-hidden="true" />
          </div>
        ) : !log ? (
          <p className="text-sm text-slate-500">Log not found.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Date &amp; Time</p>
              <p style={{ color: COLORS.yale }}>{formatDateTime(log.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Actor</p>
              <p style={{ color: COLORS.yale }}>{log.actorEmail}</p>
              <p className="text-slate-500">{ROLE_LABELS[log.actorRole] || log.actorRole}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Action / Module</p>
              <div className="flex items-center gap-2">
                <ActionBadge action={log.action} />
                <span className="text-slate-500">{log.module}</span>
              </div>
            </div>
            {log.entityType && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Entity</p>
                <p style={{ color: COLORS.yale }}>
                  {log.entityType}
                  {log.entityId ? ` — ${log.entityId}` : ""}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Description</p>
              <p className="text-slate-700">{log.description}</p>
            </div>
            {log.barangayId?.name && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Barangay</p>
                <p className="text-slate-700">{log.barangayId.name}</p>
              </div>
            )}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Metadata</p>
                <pre className="bg-slate-50 border rounded-md p-3 text-xs overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const [barangays, setBarangays] = useState([]);
  const [filters, setFilters] = useState({ search: "", action: "", module: "", actorRole: "", barangayId: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);

  useEffect(() => {
    getReportBarangays()
      .then(setBarangays)
      .catch(() => setBarangays([]));
    getAuditLogSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAuditLogs({ ...filters, page, pageSize })
      .then(({ items, pagination: p }) => {
        setLogs(items);
        setPagination(p);
      })
      .catch((err) => setError(err.message || "Unable to load audit logs. Please try again."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({ search: "", action: "", module: "", actorRole: "", barangayId: "", from: "", to: "" });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <DashboardLayout title="Audit Logs" subtitle="Who did what, when, and to which record — a historical system activity record.">
      {summary && (
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <SummaryCard icon={ShieldAlert} label="Total Logs" value={summary.total} color={COLORS.baltic} />
          <SummaryCard icon={ShieldAlert} label="Today" value={summary.today} color={COLORS.cerulean} />
          <SummaryCard icon={ShieldAlert} label="This Week" value={summary.thisWeek} color={COLORS.sky} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: COLORS.alabaster }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="auditSearch">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                id="auditSearch"
                type="text"
                placeholder="User, entity ID, description..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
                style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="actionFilter">
              Action
            </label>
            <select
              id="actionFilter"
              value={filters.action}
              onChange={(e) => updateFilter("action", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            >
              <option value="">All</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="moduleFilter">
              Module
            </label>
            <select
              id="moduleFilter"
              value={filters.module}
              onChange={(e) => updateFilter("module", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            >
              <option value="">All</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="roleFilter">
              Role
            </label>
            <select
              id="roleFilter"
              value={filters.actorRole}
              onChange={(e) => updateFilter("actorRole", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            >
              <option value="">All</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="barangayFilter">
              Barangay
            </label>
            <select
              id="barangayFilter"
              value={filters.barangayId}
              onChange={(e) => updateFilter("barangayId", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="fromDate">
              From
            </label>
            <input
              id="fromDate"
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter("from", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="toDate">
              To
            </label>
            <input
              id="toDate"
              type="date"
              value={filters.to}
              onChange={(e) => updateFilter("to", e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold px-3 py-2 rounded-md border"
              style={{ borderColor: COLORS.alabaster, color: COLORS.cerulean }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.alabaster }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-16">No audit logs match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                  <th className="py-3 px-4 font-semibold">Date &amp; Time</th>
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Module</th>
                  <th className="py-3 px-4 font-semibold">Entity</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    onClick={() => setSelectedLogId(log._id)}
                    className="border-b last:border-0 cursor-pointer hover:bg-slate-50"
                    style={{ borderColor: COLORS.alabaster }}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2.5 px-4" style={{ color: COLORS.yale }}>
                      {log.actorEmail}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{ROLE_LABELS[log.actorRole] || log.actorRole}</td>
                    <td className="py-2.5 px-4">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{log.module}</td>
                    <td className="py-2.5 px-4 text-slate-500">{log.entityType || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm" style={{ borderColor: COLORS.alabaster }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="flex items-center gap-1 font-semibold disabled:opacity-40"
              style={{ color: COLORS.cerulean }}
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Previous
            </button>
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} logs)
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="flex items-center gap-1 font-semibold disabled:opacity-40"
              style={{ color: COLORS.cerulean }}
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {selectedLogId && <DetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />}
    </DashboardLayout>
  );
}
