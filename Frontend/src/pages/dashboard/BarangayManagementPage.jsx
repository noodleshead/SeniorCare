import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, Loader2, AlertCircle, Users, UserCheck, X, MapPin } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getBarangaysWithStats, createBarangay } from "../../services/adminService.js";

function CreateBarangayDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", municipality: "", province: "", code: "" });
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
      const created = await createBarangay(form);
      onCreated(created);
    } catch (err) {
      setError(err.message || "Unable to create this Barangay.");
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

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

        <h3 className="text-lg font-bold mb-4" style={{ color: COLORS.yale }}>
          Create Barangay
        </h3>

        {error && (
          <div className="rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Barangay Name
            </label>
            <input
              required
              value={form.name}
              onChange={update("name")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: fieldErrors.name ? "#b8452f" : COLORS.alabaster }}
              placeholder="e.g. Barangay San Antonio"
            />
            {fieldErrors.name && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Municipality / City
            </label>
            <input
              required
              value={form.municipality}
              onChange={update("municipality")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: fieldErrors.municipality ? "#b8452f" : COLORS.alabaster }}
            />
            {fieldErrors.municipality && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.municipality}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Province
            </label>
            <input
              required
              value={form.province}
              onChange={update("province")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: fieldErrors.province ? "#b8452f" : COLORS.alabaster }}
            />
            {fieldErrors.province && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.province}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Barangay Code
            </label>
            <input
              required
              value={form.code}
              onChange={update("code")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none uppercase"
              style={{ borderColor: fieldErrors.code ? "#b8452f" : COLORS.alabaster }}
              placeholder="e.g. BSA01"
            />
            {fieldErrors.code && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.code}</p>}
            <p className="text-xs text-slate-500 mt-1">A unique short identifier for this Barangay.</p>
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
            Create Barangay
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BarangayManagementPage() {
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBarangays(await getBarangaysWithStats());
    } catch (err) {
      setError(err.message || "Unable to load Barangays.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = () => {
    setShowCreate(false);
    setSuccessMessage("Barangay created successfully. It's now available for senior registration.");
    load();
  };

  return (
    <DashboardLayout title="Barangay Management" subtitle="View and manage the Barangays registered in SENIORCARE.">
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 text-[15px] font-semibold px-4 py-2.5 rounded-md text-white"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create Barangay
        </button>
      </div>

      {successMessage && (
        <div
          role="status"
          className="rounded-md border p-4 mb-4 flex items-start gap-3"
          style={{ backgroundColor: "#eaf7ee", borderColor: "#2f9e5f" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#1e5f3a" }}>
            {successMessage}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-white rounded-lg border" style={{ borderColor: COLORS.alabaster }}>
          <Loader2 className="w-6 h-6 animate-spin mb-3" style={{ color: COLORS.baltic }} aria-hidden="true" />
          <p className="text-[15px]">Loading Barangays...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-lg border" style={{ borderColor: COLORS.alabaster }}>
          <AlertCircle className="w-8 h-8 mb-3" style={{ color: "#b8452f" }} aria-hidden="true" />
          <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
            Unable to load Barangays.
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
      ) : barangays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-lg border" style={{ borderColor: COLORS.alabaster }}>
          <Building2 className="w-8 h-8 mb-3" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
            No Barangays yet
          </p>
          <p className="text-sm text-slate-500 max-w-sm">Create the first Barangay to make it available for senior registration.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {barangays.map((b) => (
            <div key={b._id} className="bg-white rounded-lg border p-5" style={{ borderColor: COLORS.alabaster }}>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: COLORS.baltic + "1a" }}
                >
                  <Building2 className="w-5 h-5" style={{ color: COLORS.baltic }} aria-hidden="true" />
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={
                    b.isActive
                      ? { backgroundColor: "#eaf7ee", color: "#1e5f3a" }
                      : { backgroundColor: "#f1f1ee", color: "#64748b" }
                  }
                >
                  {b.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-[15px] font-bold" style={{ color: COLORS.yale }}>
                {b.name}
              </p>
              <p className="text-sm text-slate-500 flex items-center gap-1 mb-4">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                {b.municipality}, {b.province}
              </p>
              <div className="flex items-center gap-5 pt-3 border-t" style={{ borderColor: COLORS.alabaster }}>
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" style={{ color: COLORS.cerulean }} aria-hidden="true" />
                  <span className="text-sm">
                    <strong style={{ color: COLORS.yale }}>{b.staffCount}</strong>{" "}
                    <span className="text-slate-500">Staff</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" style={{ color: COLORS.cerulean }} aria-hidden="true" />
                  <span className="text-sm">
                    <strong style={{ color: COLORS.yale }}>{b.seniorCount}</strong>{" "}
                    <span className="text-slate-500">Senior Citizens</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateBarangayDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </DashboardLayout>
  );
}
