import { useCallback, useEffect, useState } from "react";
import {
  Users2,
  Plus,
  Loader2,
  AlertCircle,
  X,
  MapPin,
  ShieldCheck,
  Mail,
  Copy,
  CheckCircle2,
  Power,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import {
  getStaffList,
  createStaffAccount,
  updateStaffAssignment,
  updateStaffStatus,
  getBarangaysWithStats,
} from "../../services/adminService.js";

function StatusBadge({ status }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={isActive ? { backgroundColor: "#eaf7ee", color: "#1e5f3a" } : { backgroundColor: "#f1f1ee", color: "#64748b" }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function CreateStaffDialog({ barangays, onClose, onCreated }) {
  const [form, setForm] = useState({ email: "", username: "", assignedBarangayId: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await createStaffAccount({
        email: form.email,
        username: form.username || undefined,
        assignedBarangayId: form.assignedBarangayId,
        password: form.password || undefined,
      });
      onCreated(result);
    } catch (err) {
      setError(err.message || "Unable to create this Staff account.");
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  const activeBarangays = barangays.filter((b) => b.isActive);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold mb-1" style={{ color: COLORS.yale }}>
          Create Barangay Staff Account
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          The account role is fixed to Barangay Staff by the backend and cannot be changed from this form.
        </p>

        {error && (
          <div className="rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={update("email")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: fieldErrors.email ? "#b8452f" : COLORS.alabaster }}
              placeholder="staff@barangay.gov.ph"
            />
            {fieldErrors.email && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.email}</p>}
          </div>
          {/* <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Username <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              value={form.username}
              onChange={update("username")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div> */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Assigned Barangay
            </label>
            <select
              required
              value={form.assignedBarangayId}
              onChange={update("assignedBarangayId")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none bg-white"
              style={{ borderColor: fieldErrors.assignedBarangayId ? "#b8452f" : COLORS.alabaster }}
            >
              <option value="">Select Barangay...</option>
              {activeBarangays.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            {fieldErrors.assignedBarangayId && (
              <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.assignedBarangayId}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Initial Password <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.password}
              onChange={update("password")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: fieldErrors.password ? "#b8452f" : COLORS.alabaster }}
              placeholder="Leave blank to auto-generate a secure password"
            />
            {fieldErrors.password && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.password}</p>}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 text-center text-[15px] font-semibold px-5 py-2.5 rounded-md border-2 disabled:opacity-60"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-5 py-2.5 rounded-md text-white disabled:opacity-60"
            style={{ backgroundColor: COLORS.baltic }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Create Account
          </button>
        </div>
      </form>
    </div>
  );
}

function CredentialsDialog({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
    } catch {
      // Clipboard access can fail (permissions/insecure context) — the
      // password is still visible on screen for manual copying.
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5" style={{ color: "#2f9e5f" }} aria-hidden="true" />
          <h3 className="text-lg font-bold" style={{ color: COLORS.yale }}>
            Staff account created
          </h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Share these credentials securely with <strong>{result.user.email}</strong>. This password is shown only
          once and cannot be retrieved again.
        </p>
        {result.temporaryPassword && (
          <div
            className="rounded-md border p-3.5 mb-4 flex items-center justify-between gap-3"
            style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f8f7" }}
          >
            <code className="text-[15px] font-mono font-bold" style={{ color: COLORS.yale }}>
              {result.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md border shrink-0"
              style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-[15px] font-semibold px-5 py-2.5 rounded-md text-white"
          style={{ backgroundColor: COLORS.baltic }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function StaffDetailDialog({ staff, barangays, onClose, onUpdated }) {
  const [assignedBarangayId, setAssignedBarangayId] = useState(staff.assignedBarangayId?._id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const activeBarangays = barangays.filter((b) => b.isActive);

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!assignedBarangayId || assignedBarangayId === staff.assignedBarangayId?._id) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateStaffAssignment(staff._id, assignedBarangayId);
      onUpdated(updated);
    } catch (err) {
      setError(err.message || "Unable to update the assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateStaffStatus(staff._id, staff.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      onUpdated(updated);
    } catch (err) {
      setError(err.message || "Unable to update the account status.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold mb-4" style={{ color: COLORS.yale }}>
          Staff Information
        </h3>

        {error && (
          <div className="rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            {error}
          </div>
        )}

        <dl className="space-y-3 mb-5">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <dd className="text-[15px]" style={{ color: COLORS.yale }}>
              {staff.email}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <dd className="text-[15px]" style={{ color: COLORS.yale }}>
              Barangay Staff
            </dd>
            <StatusBadge status={staff.status} />
          </div>
        </dl>

        <form onSubmit={handleReassign} className="mb-5">
          <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
            Assigned Barangay
          </label>
          <div className="flex gap-2">
            <select
              value={assignedBarangayId}
              onChange={(e) => setAssignedBarangayId(e.target.value)}
              className="flex-1 rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none bg-white"
              style={{ borderColor: COLORS.alabaster }}
            >
              {activeBarangays.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || assignedBarangayId === staff.assignedBarangayId?._id}
              className="text-sm font-semibold px-4 py-2.5 rounded-md text-white disabled:opacity-50 shrink-0"
              style={{ backgroundColor: COLORS.baltic }}
            >
              Save
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Changing this immediately changes which senior registrations this staff member can review.
          </p>
        </form>

        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-5 py-2.5 rounded-md border-2 disabled:opacity-60"
          style={
            staff.status === "ACTIVE"
              ? { borderColor: "#b8452f", color: "#b8452f" }
              : { borderColor: "#2f9e5f", color: "#2f9e5f" }
          }
        >
          <Power className="w-4 h-4" aria-hidden="true" />
          {staff.status === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
        </button>
      </div>
    </div>
  );
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [credentialsResult, setCredentialsResult] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffList, barangayList] = await Promise.all([getStaffList(), getBarangaysWithStats()]);
      setStaff(staffList);
      setBarangays(barangayList);
    } catch (err) {
      setError(err.message || "Unable to load Barangay Staff accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = (result) => {
    setShowCreate(false);
    setCredentialsResult(result);
    load();
  };

  const handleUpdated = () => {
    setSelectedStaff(null);
    load();
  };

  return (
    <DashboardLayout title="Staff Management" subtitle="Create and manage Barangay Staff accounts and their assigned Barangay.">
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={loading || barangays.filter((b) => b.isActive).length === 0}
          className="inline-flex items-center gap-2 text-[15px] font-semibold px-4 py-2.5 rounded-md text-white disabled:opacity-50"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create Staff Account
        </button>
      </div>

      {!loading && barangays.length > 0 && barangays.filter((b) => b.isActive).length === 0 && (
        <div className="rounded-md border p-4 mb-4 text-sm" style={{ backgroundColor: "#fff8e6", borderColor: "#e0c068", color: "#7a5b1c" }}>
          No active Barangays exist yet. Create one under Barangay Management before provisioning Staff.
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: COLORS.alabaster }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mb-3" style={{ color: COLORS.baltic }} aria-hidden="true" />
            <p className="text-[15px]">Loading Barangay Staff accounts...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-8 h-8 mb-3" style={{ color: "#b8452f" }} aria-hidden="true" />
            <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
              Unable to load Barangay Staff accounts.
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
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users2 className="w-8 h-8 mb-3" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
              No Barangay Staff accounts yet
            </p>
            <p className="text-sm text-slate-500 max-w-sm">Create a Staff account and assign it to a Barangay to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: COLORS.alabaster }}>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Email</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Assigned Barangay</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s._id} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: COLORS.alabaster }}>
                    <td className="px-5 py-3.5 text-[15px] font-semibold" style={{ color: COLORS.yale }}>
                      {s.email}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      {s.assignedBarangayId ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                          {s.assignedBarangayId.name}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedStaff(s)}
                        className="text-sm font-semibold px-3.5 py-1.5 rounded-md border"
                        style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y" style={{ borderColor: COLORS.alabaster }}>
              {staff.map((s) => (
                <div key={s._id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[15px] font-semibold" style={{ color: COLORS.yale }}>
                      {s.email}
                    </p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-slate-600 mb-3 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {s.assignedBarangayId ? s.assignedBarangayId.name : "Unassigned"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedStaff(s)}
                    className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-md border"
                    style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateStaffDialog barangays={barangays} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {credentialsResult && (
        <CredentialsDialog result={credentialsResult} onClose={() => setCredentialsResult(null)} />
      )}
      {selectedStaff && (
        <StaffDetailDialog
          staff={selectedStaff}
          barangays={barangays}
          onClose={() => setSelectedStaff(null)}
          onUpdated={handleUpdated}
        />
      )}
    </DashboardLayout>
  );
}
