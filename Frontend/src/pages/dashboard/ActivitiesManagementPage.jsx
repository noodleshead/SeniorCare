import { useCallback, useEffect, useState } from "react";
import { Users, Plus, X, Loader2, Search, Send, Ban, Trash2, Pencil, Eye } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import { getBarangays } from "../../services/registrationService.js";
import {
  listActivities,
  createActivity,
  updateActivity,
  publishActivity,
  cancelActivity,
  deleteActivity,
  listAttendees,
} from "../../services/activityService.js";

const CATEGORY_OPTIONS = [
  { value: "WELLNESS", label: "Wellness" },
  { value: "ASSEMBLY", label: "Assembly" },
  { value: "HEALTH_SEMINAR", label: "Health Seminar" },
  { value: "EXERCISE", label: "Exercise" },
  { value: "COMMUNITY_EVENT", label: "Community Event" },
  { value: "LIVELIHOOD", label: "Livelihood / Skills" },
  { value: "GENERAL", label: "General" },
];

// Same display-string time format the backend already stores and
// validates (see activity.validator.js's `^\d{1,2}:\d{2}\s*(AM|PM)$`
// regex, itself matching PensionSchedule's slot time convention) — no
// new format is introduced, this just constrains the UI to a fixed,
// senior-friendly list of valid values instead of free text.
function buildTimeOptions() {
  const options = [];
  let hour24 = 7; // 7:00 AM
  let minute = 0;
  while (hour24 < 20 || (hour24 === 20 && minute === 0)) {
    const meridiem = hour24 < 12 ? "AM" : "PM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    options.push(`${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`);
    minute += 30;
    if (minute === 60) {
      minute = 0;
      hour24 += 1;
    }
  }
  return options;
}
const TIME_OPTIONS = buildTimeOptions();

/** Ensures an existing activity's saved time is always selectable/visible in edit mode, even if it falls outside the standard half-hour list. */
function optionsIncluding(value) {
  if (!value || TIME_OPTIONS.includes(value)) return TIME_OPTIONS;
  return [value, ...TIME_OPTIONS].sort();
}

const STATUS_STYLE = {
  DRAFT: { label: "Draft", color: "#6b7280" },
  PUBLISHED: { label: "Published", color: COLORS.baltic },
  ONGOING: { label: "Ongoing", color: "#b45309" },
  COMPLETED: { label: "Completed", color: "#2f7d43" },
  CANCELLED: { label: "Cancelled", color: "#b8452f" },
};

const STATUS_FILTERS = ["", "DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { label: status, color: COLORS.baltic };
  return (
    <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.color + "1a", color: s.color }}>
      {s.label}
    </span>
  );
}

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toISOString().slice(0, 10);
}

function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((value || "").trim());
  if (!match) return null;
  let [, hours, minutes, meridiem] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);
  if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function ActivityFormModal({ initial, currentUser, onClose, onSaved }) {
  const isBroadAccess = currentUser?.role === "ADMIN" || currentUser?.role === "LGU_OSCA";

  const [form, setForm] = useState(
    initial
      ? { ...initial, date: toDateInputValue(initial.date), barangayId: initial.barangayId?._id || initial.barangayId || "" }
      : {
          title: "",
          description: "",
          category: "GENERAL",
          barangayId: "",
          date: "",
          startTime: "",
          endTime: "",
          venue: "",
          participantInfo: "",
          attendanceConfirmationEnabled: false,
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Only ADMIN/LGU-OSCA need this — they have no assignedBarangayId of
  // their own, so unlike Barangay Staff (whose Barangay the backend
  // always derives automatically from their account), they must
  // explicitly choose one here. Reuses the same GET /api/barangays
  // list already used by the registration flow — no new endpoint.
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [barangaysLoading, setBarangaysLoading] = useState(isBroadAccess);

  useEffect(() => {
    if (!isBroadAccess) return;
    getBarangays()
      .then(setBarangayOptions)
      .catch(() => setBarangayOptions([]))
      .finally(() => setBarangaysLoading(false));
  }, [isBroadAccess]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      // Barangay Staff never send barangayId at all — the backend
      // always derives it from their own account, and a staff-supplied
      // value would be ignored server-side anyway. Only send it when
      // this modal actually collected one (ADMIN/LGU-OSCA).
      const { barangayId, ...rest } = form;
      const payload = isBroadAccess ? { ...rest, barangayId } : rest;
      if (initial?._id) {
        await updateActivity(initial._id, payload);
      } else {
        await createActivity(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const timeOrderInvalid =
    form.startTime && form.endTime && parseTimeToMinutes(form.endTime) <= parseTimeToMinutes(form.startTime);

  const disabled =
    saving ||
    !form.title.trim() ||
    !form.description.trim() ||
    !form.date ||
    !form.startTime ||
    !form.endTime ||
    !form.venue.trim() ||
    timeOrderInvalid ||
    (isBroadAccess && !form.barangayId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>
            {initial?._id ? "Edit Activity" : "Create Activity"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Activity Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Category</label>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {isBroadAccess && (
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>
                Barangay
              </label>
              <select
                value={form.barangayId}
                onChange={(e) => update("barangayId", e.target.value)}
                disabled={barangaysLoading}
                className="w-full px-3 py-2 rounded-md border-2 disabled:opacity-50"
                style={{ borderColor: COLORS.alabaster }}
              >
                <option value="">{barangaysLoading ? "Loading Barangays…" : "Select Barangay"}</option>
                {barangayOptions.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">This activity will only be visible to Seniors in the selected Barangay.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={5000}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Activity Time — Start</label>
              <select
                aria-label="Start time"
                value={form.startTime}
                onChange={(e) => update("startTime", e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                <option value="">Select time</option>
                {optionsIncluding(form.startTime).map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Activity Time — End</label>
              <select
                aria-label="End time"
                value={form.endTime}
                onChange={(e) => update("endTime", e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                <option value="">Select time</option>
                {optionsIncluding(form.endTime).map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
          {timeOrderInvalid && (
            <p className="text-xs text-red-600 -mt-2">End time must be after start time.</p>
          )}

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Venue</label>
            <input
              type="text"
              value={form.venue}
              onChange={(e) => update("venue", e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Participant Information (optional)</label>
            <textarea
              value={form.participantInfo}
              onChange={(e) => update("participantInfo", e.target.value)}
              rows={2}
              placeholder="e.g. Open to all senior citizens in the Barangay"
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={1000}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.yale }}>
            <input
              type="checkbox"
              checked={form.attendanceConfirmationEnabled}
              onChange={(e) => update("attendanceConfirmationEnabled", e.target.checked)}
            />
            Enable attendance confirmation
          </label>
        </div>

        <div className="sticky bottom-0 bg-white flex justify-end gap-2 px-5 py-4 border-t-2" style={{ borderColor: COLORS.alabaster }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md font-bold border-2" style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="px-4 py-2 rounded-md font-bold text-white disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: COLORS.baltic }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {initial?._id ? "Save Changes" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendeesDialog({ activity, onClose }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listAttendees(activity._id)
      .then(setAttendees)
      .catch((err) => setError(err.message || "Unable to load attendance right now."))
      .finally(() => setLoading(false));
  }, [activity._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>
            Attendees — {activity.title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" role="alert">
              {error}
            </p>
          ) : attendees.length === 0 ? (
            <p className="text-sm text-slate-500">No one has confirmed attendance yet.</p>
          ) : (
            <ul className="divide-y-2" style={{ borderColor: COLORS.alabaster }}>
              {attendees.map((a) => (
                <li key={a._id} className="py-2 text-sm" style={{ color: COLORS.yale }}>
                  {a.seniorId?.firstName} {a.seniorId?.lastName}
                  {a.seniorId?.seniorCitizenId && (
                    <span className="text-slate-400"> · {a.seniorId.seniorCitizenId}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesManagementPage() {
  const currentUser = getStoredUser();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [attendeesFor, setAttendeesFor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listActivities({ status: status || undefined, category: category || undefined, search: search || undefined })
      .then(setActivities)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, category, search]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleAction = async (action, id) => {
    setBusyId(id);
    try {
      if (action === "publish") await publishActivity(id);
      if (action === "cancel") {
        const reason = window.prompt("Reason for cancelling this activity (optional):") || "";
        await cancelActivity(id, reason);
      }
      if (action === "delete") {
        if (!window.confirm("Delete this draft activity? This cannot be undone.")) {
          setBusyId(null);
          return;
        }
        await deleteActivity(id);
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout title="Social Activities" subtitle="Schedule and manage community activities for your Barangay.">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 pr-3 py-2 rounded-md border-2 text-sm"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-md border-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-md border-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s ? STATUS_STYLE[s].label : "All Statuses"}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-bold text-white shrink-0"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create Activity
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <Users className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>No activities found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2" style={{ borderColor: COLORS.alabaster }}>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Activity</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Date</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Time</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Venue</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Status</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a._id} className="border-b last:border-b-0" style={{ borderColor: COLORS.alabaster }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: COLORS.yale }}>{a.title}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(a.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{a.startTime} – {a.endTime}</td>
                  <td className="px-4 py-3 text-slate-600">{a.venue}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(a);
                          setShowForm(true);
                        }}
                        disabled={["COMPLETED", "CANCELLED"].includes(a.status)}
                        className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                        style={{ color: COLORS.baltic }}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      {a.attendanceConfirmationEnabled && (
                        <button
                          type="button"
                          aria-label="View attendees"
                          onClick={() => setAttendeesFor(a)}
                          className="p-1.5 rounded-md hover:bg-slate-100"
                          style={{ color: COLORS.cerulean }}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {a.status === "DRAFT" && (
                        <button
                          type="button"
                          aria-label="Publish"
                          onClick={() => handleAction("publish", a._id)}
                          disabled={busyId === a._id}
                          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                          style={{ color: "#2f7d43" }}
                        >
                          <Send className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {["PUBLISHED", "ONGOING"].includes(a.status) && (
                        <button
                          type="button"
                          aria-label="Cancel"
                          onClick={() => handleAction("cancel", a._id)}
                          disabled={busyId === a._id}
                          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                          style={{ color: "#b8452f" }}
                        >
                          <Ban className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {a.status === "DRAFT" && (
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => handleAction("delete", a._id)}
                          disabled={busyId === a._id}
                          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                          style={{ color: "#b8452f" }}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ActivityFormModal
          initial={editing}
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {attendeesFor && <AttendeesDialog activity={attendeesFor} onClose={() => setAttendeesFor(null)} />}
    </DashboardLayout>
  );
}
