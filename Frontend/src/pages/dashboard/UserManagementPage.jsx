import { useCallback, useEffect, useState } from "react";
import { Search, X, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import { listUsers, getUserDetail, setUserStatus, updateSeniorProfileAsAdmin } from "../../services/userManagementService.js";
import { SeniorEditProfileDialog } from "../../components/EditProfileDialogs.jsx";

const ROLE_LABELS = {
  SENIOR_CITIZEN: "Senior",
  GUARDIAN: "Guardian",
  BARANGAY_STAFF: "Barangay Staff",
  ADMIN: "Administrator",
  LGU_OSCA: "LGU-OSCA",
};
const STATUS_LABELS = {
  PENDING_VERIFICATION: "Pending Verification",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  INACTIVE: "Inactive",
};
const STATUS_COLORS = { ACTIVE: "#2f7d43", INACTIVE: "#64748b", PENDING_VERIFICATION: COLORS.baltic, REJECTED: "#b8452f" };

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—");

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || COLORS.baltic;
  return (
    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: color + "1a" }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase mb-0.5">{label}</p>
      <div className="text-sm text-slate-700">{children || "—"}</div>
    </div>
  );
}

function UserDetailDrawer({ userId, onClose, onChanged }) {
  const me = getStoredUser();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getUserDetail(userId)
      .then(setDetail)
      .catch((e) => setError(e.message || "Unable to load this account."))
      .finally(() => setLoading(false));
  }, [userId]);
  useEffect(load, [load]);

  const toggleStatus = async () => {
    const next = detail.user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBusy(true);
    setError(null);
    try {
      await setUserStatus(userId, next);
      load();
      onChanged();
    } catch (e) {
      setError(e.message || "Unable to change the account status.");
    } finally {
      setBusy(false);
    }
  };

  const u = detail?.user;
  const p = detail?.profile;
  const canToggle = u && (u.status === "ACTIVE" || u.status === "INACTIVE") && u._id !== me?.id;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: COLORS.yale }}>Account Details</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : !u ? null : (
          <div className="space-y-4">
            <Row label="Email / Login">{u.email}</Row>
            <Row label="Role">{ROLE_LABELS[u.role] || u.role}</Row>
            <Row label="Account Status"><StatusBadge status={u.status} /></Row>
            <Row label="Created">{fmtDate(u.createdAt)}</Row>
            <Row label="Last Updated">{fmtDate(u.updatedAt)}</Row>
            <Row label="Last Login">{fmtDate(u.lastLoginAt)}</Row>

            {u.role === "BARANGAY_STAFF" && (
              <Row label="Assigned Barangay">{u.assignedBarangayId?.name}</Row>
            )}

            {u.role === "SENIOR_CITIZEN" && p && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <Row label="Name">{[p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(" ")}</Row>
                <Row label="Senior Citizen ID">{p.seniorCitizenId}</Row>
                <Row label="Mobile Number">{p.mobileNumber}</Row>
                <Row label="Address">
                  {p.address ? [p.address.houseLotBlock, p.address.street, p.address.municipality, p.address.province, p.address.postalCode].filter(Boolean).join(", ") : null}
                </Row>
                <Row label="Barangay">{p.barangayId?.name}</Row>
                <Row label="Bedridden">{p.bedridden ? "Yes" : "No"}</Row>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="px-3 py-2 rounded-md text-sm font-semibold border"
                  style={{ borderColor: COLORS.alabaster, color: COLORS.baltic }}
                >
                  Correct Senior Information
                </button>
              </>
            )}

            {u.role === "GUARDIAN" && p && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <Row label="Name">{`${p.firstName} ${p.lastName}`}</Row>
                <Row label="Mobile Number">{p.mobileNumber}</Row>
                <Row label="Authorized Senior(s)">
                  {p.authorizedSeniors?.length ? (
                    <ul className="list-disc pl-5">
                      {p.authorizedSeniors.map((s) => (
                        <li key={s._id}>
                          {s.firstName} {s.lastName}
                          {s.seniorCitizenId ? ` (${s.seniorCitizenId})` : ""}
                          {s.barangayId?.name ? ` — ${s.barangayId.name}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Row>
              </>
            )}

            {canToggle && (
              <button
                type="button"
                onClick={toggleStatus}
                disabled={busy}
                className="w-full px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: u.status === "ACTIVE" ? "#b8452f" : COLORS.baltic }}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {u.status === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
              </button>
            )}
            {(u.status === "PENDING_VERIFICATION" || u.status === "REJECTED") && (
              <p className="text-xs text-slate-500">
                This account's status is controlled by the Verification workflow, not this screen.
              </p>
            )}
          </div>
        )}
      </div>

      {editing && p && (
        <div onClick={(e) => e.stopPropagation()}>
          <SeniorEditProfileDialog
            initial={p}
            allowIdEdit
            colors={COLORS}
            submit={(payload) => updateSeniorProfileAsAdmin(userId, payload)}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              load();
              onChanged();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Debounce typing so every keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listUsers({ ...filters, page, pageSize: 20 })
      .then(({ items, pagination: p }) => {
        setUsers(items);
        setPagination(p);
      })
      .catch((e) => setError(e.message || "Unable to load accounts. Please try again."))
      .finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(load, [load]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const nameOf = (u) => u.profile?.name || "—";

  return (
    <DashboardLayout title="User Management" subtitle="View and manage every account in the system.">
      <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: COLORS.alabaster }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="userSearch" className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                id="userSearch"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email, or Senior Citizen ID"
                className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
                style={{ borderColor: COLORS.alabaster }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="roleFilter" className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
            <select id="roleFilter" value={filters.role} onChange={(e) => setFilter("role", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select id="statusFilter" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.alabaster }}>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-16">No accounts match the selected search and filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Barangay</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} onClick={() => setSelectedId(u._id)} className="border-b last:border-0 cursor-pointer hover:bg-slate-50" style={{ borderColor: COLORS.alabaster }}>
                    <td className="py-2.5 px-4 font-medium" style={{ color: COLORS.yale }}>{nameOf(u)}</td>
                    <td className="py-2.5 px-4 text-slate-600">{u.email}</td>
                    <td className="py-2.5 px-4 text-slate-600">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="py-2.5 px-4"><StatusBadge status={u.status} /></td>
                    <td className="py-2.5 px-4 text-slate-500">{u.profile?.barangayName || u.assignedBarangayId?.name || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm" style={{ borderColor: COLORS.alabaster }}>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} accounts)</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {selectedId && <UserDetailDrawer userId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </DashboardLayout>
  );
}
