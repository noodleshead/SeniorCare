import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning, X, Loader2, Search, ArrowRight, AlertCircle } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import {
  listConcerns,
  getConcern,
  changeConcernStatus,
  setConcernPriority,
  respondToConcern,
} from "../../services/concernService.js";

const CATEGORY_OPTIONS = [
  { value: "PENSION", label: "Pension" },
  { value: "BENEFITS", label: "Benefits / Assistance" },
  { value: "DOCUMENTS", label: "Documents" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "BARANGAY_SERVICES", label: "Barangay Services" },
  { value: "ACTIVITIES", label: "Activities" },
  { value: "ACCOUNT_TECHNICAL", label: "Account / Technical" },
  { value: "OTHER", label: "Other" },
];

const STATUS_STYLE = {
  NEW: { label: "New", color: "#6b7280" },
  UNDER_REVIEW: { label: "Under Review", color: COLORS.baltic },
  IN_PROGRESS: { label: "In Progress", color: "#b45309" },
  RESOLVED: { label: "Resolved", color: "#2f7d43" },
};
const STATUS_FILTERS = ["", "NEW", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED"];

const PRIORITY_STYLE = {
  HIGH: { label: "High", color: "#b8452f" },
  MEDIUM: { label: "Medium", color: "#b45309" },
  REGULAR: { label: "Regular", color: "#2f7d43" },
};
const PRIORITY_FILTERS = ["", "HIGH", "MEDIUM", "REGULAR"];

// Next legal status per NEW -> UNDER_REVIEW -> IN_PROGRESS -> RESOLVED —
// mirrors CONCERN_TRANSITIONS in concern.service.js so the button offered
// always matches what the backend will actually accept.
const NEXT_STATUS = {
  NEW: { value: "UNDER_REVIEW", label: "Start Review" },
  UNDER_REVIEW: { value: "IN_PROGRESS", label: "Move to In Progress" },
  IN_PROGRESS: { value: "RESOLVED", label: "Mark Resolved" },
  RESOLVED: null,
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { label: status, color: COLORS.baltic };
  return (
    <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.color + "1a", color: s.color }}>
      {s.label}
    </span>
  );
}
function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-xs text-slate-400">Not classified</span>;
  const p = PRIORITY_STYLE[priority] || { label: priority, color: COLORS.baltic };
  return (
    <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: p.color + "1a", color: p.color }}>
      {p.label}
    </span>
  );
}

function ConcernDetailDialog({ concernId, onClose, onChanged }) {
  const [concern, setConcern] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [priorityChoice, setPriorityChoice] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [responseText, setResponseText] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getConcern(concernId)
      .then((c) => {
        setConcern(c);
        setPriorityChoice(c.priority || "");
        setPriorityReason(c.priorityReason || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [concernId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged?.();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nextStatus = concern ? NEXT_STATUS[concern.status] : null;
  const canClassifyOrRespond = concern && ["UNDER_REVIEW", "IN_PROGRESS"].includes(concern.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>Concern Details</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            </div>
          ) : !concern ? (
            <p className="text-sm text-red-600">{error || "Unable to load this concern."}</p>
          ) : (
            <>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={concern.status} />
                <PriorityBadge priority={concern.priority} />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Subject</p>
                <p className="font-bold" style={{ color: COLORS.yale }}>{concern.subject}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Senior</p>
                  <p className="text-sm" style={{ color: COLORS.yale }}>
                    {concern.seniorId?.firstName} {concern.seniorId?.lastName}
                    {concern.seniorId?.seniorCitizenId && <span className="text-slate-400"> · {concern.seniorId.seniorCitizenId}</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Category</p>
                  <p className="text-sm" style={{ color: COLORS.yale }}>
                    {CATEGORY_OPTIONS.find((c) => c.value === concern.category)?.label || concern.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Submitted</p>
                  <p className="text-sm" style={{ color: COLORS.yale }}>{formatDate(concern.createdAt)}</p>
                </div>
                {concern.reportedUrgency && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Senior-Reported Urgency</p>
                    <p className="text-sm" style={{ color: COLORS.yale }}>{concern.reportedUrgency}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Description</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{concern.description}</p>
              </div>

              {concern.priorityReason && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Priority Reason</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{concern.priorityReason}</p>
                </div>
              )}

              {/* Priority classification */}
              {canClassifyOrRespond && (
                <div className="rounded-lg border-2 p-4" style={{ borderColor: COLORS.alabaster }}>
                  <p className="text-sm font-bold mb-2" style={{ color: COLORS.yale }}>Classify Priority</p>
                  <div className="flex flex-wrap gap-3 mb-2">
                    <select
                      value={priorityChoice}
                      onChange={(e) => setPriorityChoice(e.target.value)}
                      className="px-3 py-2 rounded-md border-2 text-sm"
                      style={{ borderColor: COLORS.alabaster }}
                    >
                      <option value="">Select priority</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="REGULAR">Regular</option>
                    </select>
                  </div>
                  <textarea
                    value={priorityReason}
                    onChange={(e) => setPriorityReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for this priority classification..."
                    className="w-full px-3 py-2 rounded-md border-2 text-sm mb-2"
                    style={{ borderColor: COLORS.alabaster }}
                  />
                  <button
                    type="button"
                    disabled={busy || !priorityChoice || !priorityReason.trim()}
                    onClick={() => runAction(() => setConcernPriority(concern._id, priorityChoice, priorityReason))}
                    className="px-4 py-2 rounded-md font-bold text-white text-sm disabled:opacity-50"
                    style={{ backgroundColor: COLORS.baltic }}
                  >
                    Save Priority
                  </button>
                </div>
              )}

              {/* Response history */}
              {concern.responses?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Staff Responses</p>
                  <div className="space-y-2">
                    {concern.responses.map((r, i) => (
                      <div key={i} className="rounded-md p-3" style={{ backgroundColor: COLORS.baltic + "0d" }}>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {r.respondedBy?.email || "Staff"} · {formatDateTime(r.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Respond */}
              {canClassifyOrRespond && (
                <div className="rounded-lg border-2 p-4" style={{ borderColor: COLORS.alabaster }}>
                  <p className="text-sm font-bold mb-2" style={{ color: COLORS.yale }}>Staff Response</p>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={3}
                    placeholder="Please provide your response..."
                    className="w-full px-3 py-2 rounded-md border-2 text-sm mb-2"
                    style={{ borderColor: COLORS.alabaster }}
                  />
                  <button
                    type="button"
                    disabled={busy || !responseText.trim()}
                    onClick={async () => {
                      await runAction(() => respondToConcern(concern._id, responseText));
                      setResponseText("");
                    }}
                    className="px-4 py-2 rounded-md font-bold text-white text-sm disabled:opacity-50"
                    style={{ backgroundColor: COLORS.baltic }}
                  >
                    Send Response
                  </button>
                </div>
              )}

              {/* Activity timeline */}
              {concern.activityLog?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Concern Activity</p>
                  <ul className="space-y-2 text-sm">
                    {concern.activityLog.map((entry, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-slate-400 shrink-0">{formatDateTime(entry.createdAt)}</span>
                        <span className="text-slate-700">{entry.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status action */}
              {nextStatus && (
                <div className="flex justify-end pt-2 border-t-2" style={{ borderColor: COLORS.alabaster }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(() => changeConcernStatus(concern._id, nextStatus.value))}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-md font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: COLORS.yale }}
                  >
                    {nextStatus.label}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConcernsManagementPage() {
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listConcerns({
      status: status || undefined,
      priority: priority || undefined,
      category: category || undefined,
      search: search || undefined,
    })
      .then(setConcerns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, priority, category, search]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  return (
    <DashboardLayout title="Reports / Concerns" subtitle="Review and respond to concerns from Seniors in your Barangay.">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search concerns or Senior name..."
              className="pl-9 pr-3 py-2 rounded-md border-2 text-sm"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-md border-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s ? STATUS_STYLE[s].label : "All Statuses"}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="px-3 py-2 rounded-md border-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
            {PRIORITY_FILTERS.map((p) => (
              <option key={p} value={p}>{p ? PRIORITY_STYLE[p].label : "All Priorities"}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-md border-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-4" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Unable to load concerns. Please try again.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : concerns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <MessageSquareWarning className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>No concerns found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2" style={{ borderColor: COLORS.alabaster }}>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Subject</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Senior</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Priority</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Status</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {concerns.map((c) => (
                <tr
                  key={c._id}
                  onClick={() => setSelectedId(c._id)}
                  className="border-b last:border-b-0 cursor-pointer hover:bg-slate-50"
                  style={{ borderColor: COLORS.alabaster }}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: COLORS.yale }}>{c.subject}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.seniorId?.firstName} {c.seniorId?.lastName}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <ConcernDetailDialog concernId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      )}
    </DashboardLayout>
  );
}
