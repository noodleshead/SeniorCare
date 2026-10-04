import { useCallback, useEffect, useState } from "react";
import { Wallet, Calendar, QrCode, Plus, X, Loader2, Search, CheckCircle2, AlertCircle, MapPin, Camera } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import QrScannerDialog from "./QrScannerDialog.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import {
  listPensions,
  createPension,
  updatePension,
  listEligibleSeniors,
  listSchedules,
  listSchedulingBarangays,
  createSchedule,
  closeSchedule,
  listClaims,
  resolveClaim,
  confirmClaim,
} from "../../services/pensionAdminService.js";

const CLAIM_STATUS_STYLE = {
  SCHEDULED: { label: "⏳ Scheduled", color: COLORS.baltic },
  CLAIMED: { label: "✓ Claimed", color: "#2f7d43" },
  MISSED: { label: "✕ Missed", color: "#b8452f" },
  CANCELLED: { label: "✕ Cancelled", color: "#64748b" },
};

const PENSION_TYPE_OPTIONS = [
  { value: "GOVERNMENT_PENSION", label: "Government Pension" },
  { value: "SOCIAL_PENSION", label: "Social Pension" },
  { value: "OTHER", label: "Other" },
];
const FREQUENCY_OPTIONS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
];

// Practical claiming-schedule time slots. Values are the exact strings
// stored on PensionSchedule/slot documents (e.g. "08:00 AM") — this is
// already the format the backend has used since the Pension module was
// built (see PensionSchedule.js: startTime/endTime are plain trimmed
// strings, not HH:mm 24-hour values), so the dropdown submits the same
// string it displays. No conversion/reformatting needed.
const TIME_OPTIONS = [
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
];

const ROLES_WITH_BARANGAY_CHOICE = new Set(["ADMIN", "LGU_OSCA"]);

const TABS = [
  { id: "records", label: "Pension Records", icon: Wallet },
  { id: "schedules", label: "Claiming Schedules", icon: Calendar },
  { id: "verify", label: "Verify Claims", icon: QrCode },
];

function formatCurrency(amount) {
  if (amount == null) return "—";
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

// ---------------- Pension Records tab ----------------

function CreatePensionDialog({ onClose, onCreated }) {
  const currentUser = getStoredUser();
  const canChooseBarangay = ROLES_WITH_BARANGAY_CHOICE.has(currentUser?.role);

  const [search, setSearch] = useState("");
  const [barangayId, setBarangayId] = useState("");
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [seniors, setSeniors] = useState([]);
  const [loadingSeniors, setLoadingSeniors] = useState(false);
  const [form, setForm] = useState({
    seniorId: "",
    pensionType: "SOCIAL_PENSION",
    pensionProvider: "",
    pensionAmount: "",
    frequency: "MONTHLY",
    effectiveDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Same reusable barangay-picker pattern CreateScheduleDialog above
  // already uses — Admin/LGU-OSCA have no assigned barangay of their
  // own, so this is how they scope (or search across all barangays by
  // typing a name/ID instead — see the search effect below).
  useEffect(() => {
    if (!canChooseBarangay) return;
    listSchedulingBarangays().then(setBarangayOptions);
  }, [canChooseBarangay]);

  useEffect(() => {
    let cancelled = false;
    // Bug fix (Phase 2): previously this always searched, even with an
    // empty term and no barangay picked — which is exactly the request
    // that used to come back empty for every Admin/LGU-OSCA caller (see
    // pension.service.js#listEligibleSeniors). Now: Staff searches
    // immediately (they're always scoped to their own barangay
    // server-side); Admin/LGU-OSCA only searches once they've either
    // picked a barangay or typed something, and shows a hint instead of
    // silently loading an empty list before that.
    const canSearch = !canChooseBarangay || barangayId || search.trim();
    if (!canSearch) {
      setSeniors([]);
      setLoadingSeniors(false);
      return undefined;
    }
    setLoadingSeniors(true);
    listEligibleSeniors(search, canChooseBarangay ? barangayId : undefined)
      .then((data) => {
        if (!cancelled) setSeniors(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingSeniors(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, barangayId, canChooseBarangay]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await createPension(form);
      onCreated(created);
    } catch (err) {
      setError(err.message || "Unable to create this pension record.");
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  const seniorSearchHint =
    canChooseBarangay && !barangayId && !search.trim()
      ? "Select a Barangay or type a name/Senior Citizen ID to search."
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600" aria-label="Close dialog">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold mb-4" style={{ color: COLORS.yale }}>Create Pension Record</h3>

        {error && (
          <div className="rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Senior Citizen</label>
            {canChooseBarangay && (
              <select
                value={barangayId}
                onChange={(e) => setBarangayId(e.target.value)}
                className="w-full rounded-md border px-3.5 py-2.5 text-sm mb-2 focus:outline-none"
                style={{ borderColor: COLORS.alabaster }}
              >
                <option value="">All Barangays (search by name or ID)</option>
                {barangayOptions.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or Senior Citizen ID"
                className="w-full rounded-md border pl-9 pr-3 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: COLORS.alabaster }}
              />
            </div>
            <select
              required
              value={form.seniorId}
              onChange={update("seniorId")}
              disabled={Boolean(seniorSearchHint)}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              style={{ borderColor: fieldErrors.seniorId ? "#b8452f" : COLORS.alabaster }}
            >
              <option value="">
                {seniorSearchHint
                  ? seniorSearchHint
                  : loadingSeniors
                  ? "Searching..."
                  : seniors.length === 0
                  ? "No matching Seniors found"
                  : "Select a Senior Citizen"}
              </option>
              {seniors.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.lastName}, {s.firstName}
                  {s.seniorCitizenId ? ` (${s.seniorCitizenId})` : ""}
                  {s.age != null ? ` — ${s.age}y/o` : ""}
                  {s.barangayId?.name ? ` — ${s.barangayId.name}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Only active, verified Seniors without an existing pension record appear here.</p>
            {fieldErrors.seniorId && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.seniorId}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Pension Type</label>
            <select value={form.pensionType} onChange={update("pensionType")} className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }}>
              {PENSION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Pension Provider</label>
            <input value={form.pensionProvider} onChange={update("pensionProvider")} placeholder="e.g. DSWD" className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }} />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Pension Amount (₱)</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.pensionAmount}
              onChange={update("pensionAmount")}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px]"
              style={{ borderColor: fieldErrors.pensionAmount ? "#b8452f" : COLORS.alabaster }}
            />
            {fieldErrors.pensionAmount && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{fieldErrors.pensionAmount}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Frequency</label>
            <select value={form.frequency} onChange={update("frequency")} className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }}>
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Effective Date</label>
            <input required type="date" value={form.effectiveDate} onChange={update("effectiveDate")} className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: fieldErrors.effectiveDate ? "#b8452f" : COLORS.alabaster }} />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full mt-6 rounded-md py-3 font-bold text-white disabled:opacity-60" style={{ backgroundColor: COLORS.baltic }}>
          {submitting ? "Creating..." : "Create Pension Record"}
        </button>
      </form>
    </div>
  );
}

function RecordsTab() {
  const [pensions, setPensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listPensions({ search }).then(setPensions).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggleStatus = async (pension) => {
    const updated = await updatePension(pension._id, { status: pension.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    setPensions((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Senior name or Senior Citizen ID"
            className="w-full rounded-md border pl-9 pr-3 py-2.5 text-sm focus:outline-none"
            style={{ borderColor: COLORS.alabaster }}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white shrink-0"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" /> Create Pension Record
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} /></div>
      ) : pensions.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No pension records found.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: COLORS.alabaster, color: COLORS.cerulean }}>
                <th className="px-4 py-3 font-semibold">Senior</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Frequency</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {pensions.map((p) => (
                <tr key={p._id} className="border-b last:border-0" style={{ borderColor: COLORS.alabaster }}>
                  <td className="px-4 py-3 font-medium" style={{ color: COLORS.yale }}>
                    {p.seniorId?.lastName}, {p.seniorId?.firstName}
                  </td>
                  <td className="px-4 py-3">{PENSION_TYPE_OPTIONS.find((o) => o.value === p.pensionType)?.label || p.pensionType}</td>
                  <td className="px-4 py-3">{formatCurrency(p.pensionAmount)}</td>
                  <td className="px-4 py-3">{FREQUENCY_OPTIONS.find((o) => o.value === p.frequency)?.label || p.frequency}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold" style={{ color: p.status === "ACTIVE" ? "#2f7d43" : "#94a3b8" }}>
                      {p.status === "ACTIVE" ? "✓ Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleStatus(p)} className="text-xs font-semibold underline" style={{ color: COLORS.baltic }}>
                      {p.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreatePensionDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------- Claiming Schedules tab ----------------

function CreateScheduleDialog({ onClose, onCreated }) {
  const currentUser = getStoredUser();
  const canChooseBarangay = ROLES_WITH_BARANGAY_CHOICE.has(currentUser?.role);

  const [form, setForm] = useState({ barangayId: "", date: "", location: "", startTime: "", endTime: "" });
  const [slots, setSlots] = useState([{ startTime: "", endTime: "", capacity: 20 }]);
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [loadingBarangays, setLoadingBarangays] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Loads who this account is even allowed to create a schedule for.
  // For BARANGAY_STAFF this always resolves to exactly their own
  // assigned barangay (read-only display below) — the backend derives
  // it from the authenticated user regardless of what this form sends,
  // so there's nothing to "pick" for staff. For ADMIN/LGU_OSCA it's the
  // full list, and a choice here is required.
  useEffect(() => {
    let cancelled = false;
    listSchedulingBarangays()
      .then((data) => {
        if (cancelled) return;
        setBarangayOptions(data);
        // Staff (and any single-option case): auto-select the only option
        // for display purposes; still not trusted by the backend.
        if (!canChooseBarangay && data.length === 1) {
          setForm((f) => ({ ...f, barangayId: data[0]._id }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBarangays(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canChooseBarangay]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateSlot = (idx, key) => (e) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: e.target.value } : s)));
  const addSlot = () => setSlots((prev) => [...prev, { startTime: "", endTime: "", capacity: 20 }]);
  const removeSlot = (idx) => setSlots((prev) => prev.filter((_, i) => i !== idx));

  const assignedBarangay = !canChooseBarangay ? barangayOptions[0] : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Only ever sent for ADMIN/LGU_OSCA, who must choose one. For
      // BARANGAY_STAFF this is omitted entirely — the backend ignores
      // any barangayId a non-broad-access user sends and always uses
      // their own assignedBarangayId instead, so there's no point (and
      // no security value) in sending it for staff.
      const payload = { ...form, slots };
      if (!canChooseBarangay) delete payload.barangayId;
      const created = await createSchedule(payload);
      onCreated(created);
    } catch (err) {
      setError(err.message || "Unable to create this schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600" aria-label="Close dialog">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold mb-4" style={{ color: COLORS.yale }}>Create Claiming Schedule</h3>

        {error && (
          <div className="rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Barangay</label>
            {canChooseBarangay ? (
              <select
                required
                value={form.barangayId}
                onChange={update("barangayId")}
                className="w-full rounded-md border px-3.5 py-2.5 text-[15px]"
                style={{ borderColor: COLORS.alabaster }}
              >
                <option value="">{loadingBarangays ? "Loading..." : "Select Barangay"}</option>
                {barangayOptions.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <div
                className="w-full rounded-md border px-3.5 py-2.5 text-[15px] flex items-center gap-2 bg-slate-50"
                style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
              >
                <MapPin className="w-4 h-4 shrink-0" style={{ color: COLORS.cerulean }} />
                <span className="font-semibold">{loadingBarangays ? "Loading..." : assignedBarangay?.name || "—"}</span>
                <span className="text-xs text-slate-500 ml-auto">Assigned Barangay</span>
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Date</label>
            <input required type="date" value={form.date} onChange={update("date")} className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Location</label>
            <input required value={form.location} onChange={update("location")} placeholder="e.g. Barangay Hall" className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>Start Time</label>
            <select required value={form.startTime} onChange={update("startTime")} className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }}>
              <option value="">Select time</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>End Time</label>
            <select required value={form.endTime} onChange={update("endTime")} className="w-full rounded-md border px-3.5 py-2.5 text-[15px]" style={{ borderColor: COLORS.alabaster }}>
              <option value="">Select time</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm font-semibold mb-2" style={{ color: COLORS.yale }}>Claiming Slots</p>
        <div className="space-y-2 mb-2">
          {slots.map((slot, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
              <select required value={slot.startTime} onChange={updateSlot(idx, "startTime")} className="rounded-md border px-2.5 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
                <option value="">Start time</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <select required value={slot.endTime} onChange={updateSlot(idx, "endTime")} className="rounded-md border px-2.5 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
                <option value="">End time</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <input required type="number" min="1" value={slot.capacity} onChange={updateSlot(idx, "capacity")} className="rounded-md border px-2.5 py-2 text-sm" style={{ borderColor: COLORS.alabaster }} />
              {slots.length > 1 && (
                <button type="button" onClick={() => removeSlot(idx)} aria-label="Remove slot" className="text-slate-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addSlot} className="text-sm font-semibold mb-6" style={{ color: COLORS.baltic }}>
          + Add another slot
        </button>

        <button type="submit" disabled={submitting || (canChooseBarangay && !form.barangayId)} className="w-full rounded-md py-3 font-bold text-white disabled:opacity-60" style={{ backgroundColor: COLORS.baltic }}>
          {submitting ? "Creating..." : "Create Schedule"}
        </button>
      </form>
    </div>
  );
}

function SchedulesTab() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listSchedules({}).then(setSchedules).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleClose = async (id) => {
    const updated = await closeSchedule(id);
    setSchedules((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white" style={{ backgroundColor: COLORS.baltic }}>
          <Plus className="w-4 h-4" /> Create Schedule
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} /></div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No claiming schedules yet.</p>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => {
            const totalCapacity = s.slots.reduce((sum, slot) => sum + slot.capacity, 0);
            const totalBooked = s.slots.reduce((sum, slot) => sum + slot.bookedCount, 0);
            return (
              <div key={s._id} className="bg-white rounded-lg border p-4" style={{ borderColor: COLORS.alabaster }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold" style={{ color: COLORS.yale }}>{formatDate(s.date)}</p>
                    <p className="text-sm text-slate-600">{s.location} · {s.startTime} – {s.endTime}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: COLORS.cerulean }}>
                      Booked {totalBooked} / {totalCapacity}
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: s.status === "OPEN" ? "#eef8f0" : "#f1f5f9", color: s.status === "OPEN" ? "#2f7d43" : "#64748b" }}>
                      {s.status}
                    </span>
                    {s.status === "OPEN" && (
                      <button type="button" onClick={() => handleClose(s._id)} className="text-xs font-semibold underline" style={{ color: COLORS.baltic }}>
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateScheduleDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------- Verify Claims tab ----------------

// Claim information card shown after a QR is resolved, before Staff
// confirms. Uses only the fields the existing backend actually returns.
function ClaimReviewCard({ claim, onConfirm, onDismiss, confirming }) {
  return (
    <div className="rounded-lg border-2 p-4 mb-6" style={{ borderColor: COLORS.sky, backgroundColor: COLORS.sky + "1f" }}>
      <p className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: COLORS.cerulean }}>
        Claiming Verification
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Senior Citizen</p>
          <p className="text-sm font-bold" style={{ color: COLORS.yale }}>
            {claim.seniorId?.firstName} {claim.seniorId?.lastName}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Senior Citizen ID</p>
          <p className="text-sm font-bold" style={{ color: COLORS.yale }}>{claim.seniorId?.seniorCitizenId || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Claiming Date</p>
          <p className="text-sm font-bold" style={{ color: COLORS.yale }}>{formatDate(claim.scheduledDate)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Claiming Time</p>
          <p className="text-sm font-bold" style={{ color: COLORS.yale }}>
            {claim.scheduledStartTime} – {claim.scheduledEndTime}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Location</p>
          <p className="text-sm font-bold" style={{ color: COLORS.yale }}>{claim.location}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Claim Status</p>
          <p className="text-sm font-bold" style={{ color: (CLAIM_STATUS_STYLE[claim.status] || CLAIM_STATUS_STYLE.SCHEDULED).color }}>
            {claim.status}
          </p>
        </div>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        Please confirm the Senior's identity in person before completing this claim.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#2f7d43" }}
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {confirming ? "Confirming..." : "Confirm Claim"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={confirming}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-semibold border disabled:opacity-60"
          style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function VerifyTab() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingClaim, setPendingClaim] = useState(null); // resolved, awaiting Staff confirmation
  const [result, setResult] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listClaims({ date: new Date().toISOString() }).then(setClaims).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const resolveToken = async (qrToken) => {
    setResolving(true);
    setResult(null);
    setPendingClaim(null);
    try {
      // Existing backend endpoint — read-only, never claims by itself.
      const claim = await resolveClaim(qrToken);
      setPendingClaim({ ...claim, _qrToken: qrToken });
    } catch (err) {
      setResult({ ok: false, message: err.message || "Invalid QR code." });
    } finally {
      setResolving(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    resolveToken(token.trim());
    setToken("");
  };

  const handleQrDetected = (payload) => {
    setScannerOpen(false);
    resolveToken(payload);
  };

  const handleConfirm = async () => {
    if (!pendingClaim) return;
    setConfirming(true);
    try {
      const claim = await confirmClaim(pendingClaim._qrToken);
      setResult({
        ok: true,
        message: `Claim confirmed for ${claim.seniorId?.firstName || ""} ${claim.seniorId?.lastName || ""}`.trim() + ".",
      });
      setPendingClaim(null);
      load();
    } catch (err) {
      setResult({ ok: false, message: err.message || "This claiming stub could not be confirmed." });
      setPendingClaim(null);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <div className="bg-white rounded-lg border p-4 mb-6 flex flex-col sm:flex-row gap-3" style={{ borderColor: COLORS.alabaster }}>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-semibold text-white"
          style={{ backgroundColor: COLORS.yale }}
        >
          <Camera className="w-4 h-4" /> Scan QR
        </button>
        <form onSubmit={handleManualSubmit} className="flex-1 flex flex-col sm:flex-row gap-3">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Or paste the claiming pass QR token"
            className="flex-1 rounded-md border px-3.5 py-2.5 text-sm focus:outline-none"
            style={{ borderColor: COLORS.alabaster }}
          />
          <button type="submit" disabled={resolving} className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-semibold text-white disabled:opacity-60" style={{ backgroundColor: COLORS.baltic }}>
            <QrCode className="w-4 h-4" /> {resolving ? "Checking..." : "Check"}
          </button>
        </form>
      </div>

      {scannerOpen && <QrScannerDialog onDetected={handleQrDetected} onClose={() => setScannerOpen(false)} />}

      {resolving && (
        <div className="rounded-md border p-3 mb-6 text-sm flex items-center gap-2" style={{ backgroundColor: "#f1f5f9", borderColor: COLORS.alabaster, color: COLORS.yale }}>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Validating claim...
        </div>
      )}

      {pendingClaim && (
        <ClaimReviewCard
          claim={pendingClaim}
          onConfirm={handleConfirm}
          onDismiss={() => setPendingClaim(null)}
          confirming={confirming}
        />
      )}

      {result && (
        <div
          className="rounded-md border p-3 mb-6 text-sm flex items-center gap-2"
          style={{
            backgroundColor: result.ok ? "#eef8f0" : "#fbeae6",
            borderColor: result.ok ? "#bcdfc3" : "#e3a893",
            color: result.ok ? "#2f7d43" : "#7a2e1c",
          }}
        >
          {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {result.message}
        </div>
      )}

      <p className="text-sm font-semibold mb-3" style={{ color: COLORS.yale }}>Today's Claims</p>
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} /></div>
      ) : claims.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No claims scheduled for today.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: COLORS.alabaster, color: COLORS.cerulean }}>
                <th className="px-4 py-3 font-semibold">Senior</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const display = CLAIM_STATUS_STYLE[c.status] || CLAIM_STATUS_STYLE.SCHEDULED;
                return (
                  <tr key={c._id} className="border-b last:border-0" style={{ borderColor: COLORS.alabaster }}>
                    <td className="px-4 py-3 font-medium" style={{ color: COLORS.yale }}>{c.seniorId?.lastName}, {c.seniorId?.firstName}</td>
                    <td className="px-4 py-3">{c.scheduledStartTime} – {c.scheduledEndTime}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: display.color }}>{display.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PensionManagementPage() {
  const [tab, setTab] = useState("records");

  return (
    <DashboardLayout title="Pension Management" subtitle="Manage pension records, claiming schedules, and QR claim verification.">
      <div className="flex gap-1 border-b mb-6" style={{ borderColor: COLORS.alabaster }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px"
            style={{
              borderColor: tab === t.id ? COLORS.baltic : "transparent",
              color: tab === t.id ? COLORS.yale : "#64748b",
            }}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "records" && <RecordsTab />}
      {tab === "schedules" && <SchedulesTab />}
      {tab === "verify" && <VerifyTab />}
    </DashboardLayout>
  );
}
