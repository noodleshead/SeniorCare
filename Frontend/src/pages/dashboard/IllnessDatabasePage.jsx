import { useCallback, useEffect, useState } from "react";
import { Search, Plus, X, Loader2, AlertCircle, AlertTriangle, Pencil } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { listIllnesses, createIllness, updateIllness, setIllnessStatus } from "../../services/illnessService.js";

const CLASSIFICATION_LABELS = { CRITICAL: "Critical", NON_CRITICAL: "Non-Critical" };
const PRIORITY_LABELS = { HIGH: "High", NORMAL: "Normal" };

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

function Badge({ color, children }) {
  return (
    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: color + "1a" }}>
      {children}
    </span>
  );
}

function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: confirmColor }} aria-hidden="true" />
          <h3 className="text-base font-bold" style={{ color: COLORS.yale }}>{title}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-md text-sm font-semibold border" style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-md text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: confirmColor }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function IllnessFormDialog({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const [name, setName] = useState(initial?.name || "");
  const [classification, setClassification] = useState(initial?.classification || "");
  const [priorityLevel, setPriorityLevel] = useState(initial?.priorityLevel || "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Please enter the medical condition name.";
    if (!classification) nextErrors.classification = "Please select a classification.";
    if (!priorityLevel) nextErrors.priorityLevel = "Please select a priority.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const payload = { name: name.trim(), classification, priorityLevel, isActive };
      const saved = isEdit ? await updateIllness(initial._id, payload) : await createIllness(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Unable to save this medical condition.");
      setErrors((prev) => ({ ...prev, ...(err.fieldErrors || {}) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} noValidate className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} disabled={saving} className="absolute top-4 right-4 text-slate-400" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold mb-4" style={{ color: COLORS.yale }}>
          {isEdit ? "Edit Medical Condition" : "Add Medical Condition"}
        </h3>

        {error && (
          <div className="flex items-start gap-2 rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="illnessName" className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>
              Medical Condition Name *
            </label>
            <input
              id="illnessName"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((er) => ({ ...er, name: undefined }));
              }}
              className="w-full rounded-md border px-3 py-2.5 text-[15px] focus:outline-none"
              style={{ borderColor: errors.name ? "#b8452f" : COLORS.alabaster }}
            />
            {errors.name && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="classification" className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>
                Classification *
              </label>
              <select
                id="classification"
                value={classification}
                onChange={(e) => {
                  setClassification(e.target.value);
                  setErrors((er) => ({ ...er, classification: undefined }));
                }}
                className="w-full rounded-md border px-3 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: errors.classification ? "#b8452f" : COLORS.alabaster }}
              >
                <option value="">Select</option>
                <option value="CRITICAL">Critical</option>
                <option value="NON_CRITICAL">Non-Critical</option>
              </select>
              {errors.classification && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.classification}</p>}
            </div>
            <div>
              <label htmlFor="priorityLevel" className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>
                Priority Level *
              </label>
              <select
                id="priorityLevel"
                value={priorityLevel}
                onChange={(e) => {
                  setPriorityLevel(e.target.value);
                  setErrors((er) => ({ ...er, priorityLevel: undefined }));
                }}
                className="w-full rounded-md border px-3 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: errors.priorityLevel ? "#b8452f" : COLORS.alabaster }}
              >
                <option value="">Select</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
              </select>
              {errors.priorityLevel && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.priorityLevel}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.yale }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
            Active (selectable in Senior Registration)
          </label>

          <p className="text-xs text-slate-500">
            Classification and priority are internal administrative data — Seniors and Guardians never see these values.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-md text-sm font-semibold border" style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-md text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: COLORS.baltic }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Condition"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function IllnessDatabasePage() {
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", classification: "", priority: "", status: "" });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formTarget, setFormTarget] = useState(null); // null closed, {} = add, illness obj = edit
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

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
    listIllnesses({ ...filters, page, pageSize: 20 })
      .then(({ items: rows, pagination: p }) => {
        setItems(rows);
        setPagination(p);
      })
      .catch((e) => setError(e.message || "Unable to load the Illness Database. Please try again."))
      .finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(load, [load]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const confirmStatusChange = async () => {
    setStatusSaving(true);
    try {
      await setIllnessStatus(statusTarget._id, !statusTarget.isActive);
      setStatusTarget(null);
      load();
    } catch (e) {
      setError(e.message || "Unable to update the status.");
      setStatusTarget(null);
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <DashboardLayout title="Illness Database" subtitle="Manage the medical conditions available in Senior Registration.">
      <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: COLORS.alabaster }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="illnessSearch" className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                id="illnessSearch"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search medical condition..."
                className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
                style={{ borderColor: COLORS.alabaster }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="classFilter" className="block text-xs font-semibold text-slate-500 mb-1">Classification</label>
            <select id="classFilter" value={filters.classification} onChange={(e) => setFilter("classification", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="NON_CRITICAL">Non-Critical</option>
            </select>
          </div>
          <div>
            <label htmlFor="priorityFilter" className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
            <select id="priorityFilter" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select id="statusFilter" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setFormTarget({})}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold text-white"
            style={{ backgroundColor: COLORS.baltic }}
          >
            <Plus className="w-4 h-4" /> Add Medical Condition
          </button>
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
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-16">No medical conditions match the selected search and filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                  <th className="py-3 px-4 font-semibold">Medical Condition</th>
                  <th className="py-3 px-4 font-semibold">Classification</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Updated</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i._id} className="border-b last:border-0" style={{ borderColor: COLORS.alabaster }}>
                    <td className="py-2.5 px-4 font-medium" style={{ color: COLORS.yale }}>
                      {i.name}
                      {i.needsConfiguration && (
                        <span className="ml-2 text-xs font-semibold" style={{ color: "#b8452f" }}>Needs configuration</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {i.classification ? (
                        <Badge color={i.classification === "CRITICAL" ? "#b8452f" : COLORS.cerulean}>
                          {CLASSIFICATION_LABELS[i.classification]}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      {i.priorityLevel ? (
                        <Badge color={i.priorityLevel === "HIGH" ? "#b8452f" : "#64748b"}>{PRIORITY_LABELS[i.priorityLevel]}</Badge>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge color={i.isActive ? "#2f7d43" : "#64748b"}>{i.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{fmtDate(i.updatedAt)}</td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setFormTarget(i)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md border mr-2"
                        style={{ borderColor: COLORS.alabaster, color: COLORS.baltic }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusTarget(i)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-md border"
                        style={{ borderColor: COLORS.alabaster, color: i.isActive ? "#b8452f" : "#2f7d43" }}
                      >
                        {i.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm" style={{ borderColor: COLORS.alabaster }}>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>
              Previous
            </button>
            <span className="text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} conditions)</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>
              Next
            </button>
          </div>
        )}
      </div>

      {formTarget && (
        <IllnessFormDialog
          initial={formTarget._id ? formTarget : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load();
          }}
        />
      )}

      {statusTarget && (
        <ConfirmDialog
          title={statusTarget.isActive ? "Deactivate this medical condition?" : "Activate this medical condition?"}
          message={
            statusTarget.isActive
              ? `"${statusTarget.name}" will no longer appear in new Senior registrations. Seniors already associated with it are not affected.`
              : `"${statusTarget.name}" will become selectable again in new Senior registrations.`
          }
          confirmLabel={statusTarget.isActive ? "Deactivate" : "Activate"}
          confirmColor={statusTarget.isActive ? "#b8452f" : COLORS.baltic}
          loading={statusSaving}
          onCancel={() => setStatusTarget(null)}
          onConfirm={confirmStatusChange}
        />
      )}
    </DashboardLayout>
  );
}
