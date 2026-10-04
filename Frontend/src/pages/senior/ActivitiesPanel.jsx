import { useCallback, useEffect, useState } from "react";
import { Users, Loader2, AlertCircle, X, Calendar, Clock, MapPin, CheckCircle2 } from "lucide-react";
import { getMyActivities, confirmAttendance, withdrawAttendance } from "../../services/activityService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const CATEGORY_LABELS = {
  WELLNESS: "Wellness",
  ASSEMBLY: "Assembly",
  HEALTH_SEMINAR: "Health Seminar",
  EXERCISE: "Exercise",
  COMMUNITY_EVENT: "Community Event",
  LIVELIHOOD: "Livelihood / Skills",
  GENERAL: "General",
};

const STATUS_LABELS = {
  PUBLISHED: { label: "Scheduled", color: COLORS.baltic },
  ONGOING: { label: "Ongoing", color: "#b45309" },
  COMPLETED: { label: "Completed", color: "#6b7280" },
  CANCELLED: { label: "Cancelled", color: "#dc2626" },
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

function EmptyBlock({ t, when }) {
  return (
    <div
      className="rounded-lg border-2 border-dashed p-6 flex flex-col items-center text-center gap-2"
      style={{ borderColor: COLORS.alabaster }}
    >
      <Users className="w-8 h-8 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
        {when === "past" ? "No past activities yet." : "No upcoming activities."}
      </p>
      <p className={`${t.body} text-slate-600 max-w-md`}>
        {when === "past"
          ? "Activities your Barangay has already held will appear here."
          : "Senior citizen assemblies, wellness activities, and community events for your Barangay will appear here."}
      </p>
    </div>
  );
}

function ActivityDetailDialog({ activity, onClose, onChanged, t }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(activity.hasConfirmedAttendance);
  const canConfirm = activity.attendanceConfirmationEnabled && ["PUBLISHED", "ONGOING"].includes(activity.status);
  const statusInfo = STATUS_LABELS[activity.status] || { label: activity.status, color: COLORS.baltic };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmAttendance(activity._id);
      setConfirmed(true);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await withdrawAttendance(activity._id);
      setConfirmed(false);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <div>
            <span
              className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full mb-1.5"
              style={{ backgroundColor: statusInfo.color + "1a", color: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
            <h3 className={`${t.cardTitle} font-extrabold`} style={{ color: COLORS.yale }}>
              {activity.title}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.yale }}>
            <Calendar className="w-4 h-4 shrink-0" style={{ color: COLORS.baltic }} aria-hidden="true" />
            {formatDate(activity.date)}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.yale }}>
            <Clock className="w-4 h-4 shrink-0" style={{ color: COLORS.baltic }} aria-hidden="true" />
            {activity.startTime} – {activity.endTime}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.yale }}>
            <MapPin className="w-4 h-4 shrink-0" style={{ color: COLORS.baltic }} aria-hidden="true" />
            {activity.venue}
          </div>

          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">About this activity</p>
            <p className={`${t.body} text-slate-700 whitespace-pre-wrap`}>{activity.description}</p>
          </div>

          {activity.participantInfo && (
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Participant Information</p>
              <p className={`${t.body} text-slate-700 whitespace-pre-wrap`}>{activity.participantInfo}</p>
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

          {canConfirm && (
            <div className="pt-2">
              {confirmed ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-bold" style={{ color: "#2f7d43" }}>
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    You're confirmed to attend.
                  </span>
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={busy}
                    className="text-sm font-bold underline disabled:opacity-50"
                    style={{ color: COLORS.baltic }}
                  >
                    Withdraw
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy}
                  className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: COLORS.baltic }}
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Confirm Attendance
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesPanel({ t }) {
  const [tab, setTab] = useState("upcoming");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyActivities({ when: tab })
      .then(setActivities)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border-2 p-1" style={{ borderColor: COLORS.alabaster }}>
        {["upcoming", "past"].map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="px-4 py-1.5 rounded-md text-sm font-bold capitalize"
            style={{
              backgroundColor: tab === id ? COLORS.baltic : "transparent",
              color: tab === id ? "#ffffff" : COLORS.yale,
            }}
          >
            {id}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600" role="alert">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
          <span className={t.body}>{error}</span>
        </div>
      ) : activities.length === 0 ? (
        <EmptyBlock t={t} when={tab} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activities.map((a) => {
            const statusInfo = STATUS_LABELS[a.status] || { label: a.status, color: COLORS.baltic };
            return (
              <button
                key={a._id}
                type="button"
                onClick={() => setSelected(a)}
                className="text-left bg-white rounded-xl border-2 p-4 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: statusInfo.color + "1a", color: statusInfo.color }}
                  >
                    {statusInfo.label}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.baltic + "1a", color: COLORS.baltic }}>
                    {CATEGORY_LABELS[a.category] || a.category}
                  </span>
                  {a.hasConfirmedAttendance && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#dcfce7", color: "#2f7d43" }}>
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      Confirmed
                    </span>
                  )}
                </div>
                <p className={`${t.cardTitle} font-bold mb-1`} style={{ color: COLORS.yale }}>
                  {a.title}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                  <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {formatDate(a.date)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                  <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {a.startTime} – {a.endTime}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {a.venue}
                </div>
                <span className="text-xs font-bold" style={{ color: COLORS.baltic }}>
                  View Details →
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ActivityDetailDialog activity={selected} onClose={() => setSelected(null)} onChanged={load} t={t} />
      )}
    </div>
  );
}
