import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Loader2,
  AlertCircle,
  ClipboardCheck,
  Users,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  Building2,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getPendingVerifications, getVerificationStats } from "../../services/verificationService.js";
import { getBarangays } from "../../services/registrationService.js";
import { getStoredUser, getMe } from "../../services/authService.js";

const PAGE_SIZE = 10;

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-lg border p-4 sm:p-5 flex items-center gap-4" style={{ borderColor: COLORS.alabaster }}>
      <div
        className="w-11 h-11 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent + "1a" }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-tight" style={{ color: COLORS.yale }}>
          {value ?? "—"}
        </p>
        <p className="text-sm text-slate-500 truncate">{label}</p>
      </div>
    </div>
  );
}

/**
 * Prominent "which Barangay am I scoped to" banner for Barangay Staff.
 * Resolved from GET /api/auth/me (auth.service.js#getAuthenticatedUser),
 * which reads the *authenticated* user's own assignedBarangayId from the
 * database — never anything client-supplied.
 */
function AssignedBarangayBanner() {
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || (profile && !profile.barangayName)) return null;

  return (
    <div
      className="rounded-lg border p-4 sm:p-5 flex items-center gap-4 mb-5"
      style={{ backgroundColor: COLORS.yale, borderColor: COLORS.yale }}
    >
      <div
        className="w-11 h-11 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
      >
        <Building2 className="w-5 h-5 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.sky }}>
          Assigned Barangay
        </p>
        {profile ? (
          <>
            <p className="text-lg font-extrabold text-white leading-tight truncate">{profile.barangayName}</p>
            <p className="text-sm text-white/70">
              {[profile.barangayMunicipality, profile.barangayProvince].filter(Boolean).join(", ")} · You can only
              manage this barangay's records.
            </p>
          </>
        ) : (
          <p className="text-sm text-white/70">Loading your assignment...</p>
        )}
      </div>
    </div>
  );
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export default function VerificationDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const hasBroadAccess = user?.role === "ADMIN" || user?.role === "LGU_OSCA";
  const isStaff = user?.role === "BARANGAY_STAFF";

  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [barangays, setBarangays] = useState([]);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, statsRes] = await Promise.all([
        getPendingVerifications({ search, page, limit: PAGE_SIZE, barangayId: barangayFilter, status: statusFilter }),
        getVerificationStats(),
      ]);
      setItems(pendingRes.items);
      setMeta(pendingRes.meta);
      setStats(statsRes);
    } catch (err) {
      setError(err.message || "Unable to load pending registrations.");
    } finally {
      setLoading(false);
    }
  }, [search, page, barangayFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!hasBroadAccess) return;
    getBarangays()
      .then(setBarangays)
      .catch(() => setBarangays([]));
  }, [hasBroadAccess]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <DashboardLayout
      title="Senior Verification"
      subtitle={
        hasBroadAccess
          ? "Review pending senior citizen registrations across all barangays."
          : "Review senior citizen registrations submitted in your barangay."
      }
    >
      {isStaff && <AssignedBarangayBanner />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard icon={ClipboardCheck} label="Pending Verification" value={stats?.pending} accent={COLORS.cerulean} />
        <StatCard icon={UserCheck} label="Active Seniors" value={stats?.active} accent="#2f9e5f" />
        <StatCard icon={UserX} label="Rejected Registrations" value={stats?.rejected} accent="#b8452f" />
        <StatCard icon={Users} label="Total Seniors" value={stats?.total} accent={COLORS.yale} />
      </div>

      {/* Status filter — defaults to Pending. Approved/Rejected/All let
          Staff find a Senior again after review, e.g. to reach "Create
          Guardian Login" on their page, which only appears once Approved. */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { value: "PENDING", label: "Pending" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
          { value: "ALL", label: "All" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setPage(1);
              setStatusFilter(tab.value);
            }}
            className="px-4 py-2 rounded-full text-sm font-bold border"
            style={{
              borderColor: statusFilter === tab.value ? COLORS.baltic : COLORS.alabaster,
              backgroundColor: statusFilter === tab.value ? COLORS.baltic : "#ffffff",
              color: statusFilter === tab.value ? "#ffffff" : COLORS.yale,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-col sm:flex-row gap-3" style={{ borderColor: COLORS.alabaster }}>
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or Senior Citizen ID..."
            className="w-full rounded-md border pl-10 pr-4 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            style={{ borderColor: COLORS.alabaster }}
          />
        </form>
        {hasBroadAccess && (
          <div className="relative sm:w-64">
            <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <select
              value={barangayFilter}
              onChange={(e) => {
                setPage(1);
                setBarangayFilter(e.target.value);
              }}
              className="w-full appearance-none rounded-md border pl-10 pr-4 py-2.5 text-[15px] text-slate-800 focus:outline-none bg-white"
              style={{ borderColor: COLORS.alabaster }}
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: COLORS.alabaster }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mb-3" style={{ color: COLORS.baltic }} aria-hidden="true" />
            <p className="text-[15px]">Loading pending registrations...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-8 h-8 mb-3" style={{ color: "#b8452f" }} aria-hidden="true" />
            <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
              Unable to load pending registrations.
            </p>
            <p className="text-sm text-slate-500 mb-4">Please try again.</p>
            <button
              type="button"
              onClick={load}
              className="text-[15px] font-semibold px-5 py-2.5 rounded-md text-white"
              style={{ backgroundColor: COLORS.baltic }}
            >
              Try Again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <ClipboardCheck className="w-8 h-8 mb-3" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
              {statusFilter === "PENDING"
                ? "No pending registrations"
                : statusFilter === "APPROVED"
                ? "No approved registrations yet"
                : statusFilter === "REJECTED"
                ? "No rejected registrations"
                : "No registrations found"}
            </p>
            <p className="text-sm text-slate-500 max-w-sm">
              {statusFilter === "PENDING"
                ? "All submitted senior citizen registrations have been reviewed."
                : "Try a different status filter or search term."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: COLORS.alabaster }}>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Senior Name</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Senior ID</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Age</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Barangay</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v._id} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: COLORS.alabaster }}>
                    <td className="px-5 py-3.5 text-[15px] font-semibold" style={{ color: COLORS.yale }}>
                      {v.seniorId?.firstName} {v.seniorId?.lastName}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{v.seniorId?.seniorCitizenId || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{calculateAge(v.seniorId?.dateOfBirth) ?? "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{v.barangayId?.name || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/verification/${v._id}`)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-md text-white"
                        style={{ backgroundColor: COLORS.baltic }}
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y" style={{ borderColor: COLORS.alabaster }}>
              {items.map((v) => (
                <div key={v._id} className="p-4">
                  <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
                    {v.seniorId?.firstName} {v.seniorId?.lastName}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mb-3">
                    <span>ID: {v.seniorId?.seniorCitizenId || "—"}</span>
                    <span>Age: {calculateAge(v.seniorId?.dateOfBirth) ?? "—"}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                      {v.barangayId?.name || "—"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/verification/${v._id}`)}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3.5 py-2.5 rounded-md text-white"
                    style={{ backgroundColor: COLORS.baltic }}
                  >
                    <Eye className="w-4 h-4" aria-hidden="true" />
                    Review
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div
                className="flex items-center justify-between px-5 py-3.5 border-t text-sm"
                style={{ borderColor: COLORS.alabaster }}
              >
                <span className="text-slate-500">
                  Page {meta.page} of {meta.totalPages} &middot; {meta.total} total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-md border disabled:opacity-40"
                    style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    className="p-1.5 rounded-md border disabled:opacity-40"
                    style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
