import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning, Loader2, AlertCircle, X, Plus, Clock } from "lucide-react";
import { submitConcern, getMyConcerns, getMyConcern } from "../../services/concernService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

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

const URGENCY_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "REGULAR", label: "Regular — no rush" },
  { value: "MEDIUM", label: "Somewhat urgent" },
  { value: "HIGH", label: "Very urgent" },
];

const STATUS_LABELS = {
  NEW: { label: "Submitted", color: "#6b7280" },
  UNDER_REVIEW: { label: "Under Review", color: COLORS.baltic },
  IN_PROGRESS: { label: "In Progress", color: "#b45309" },
  RESOLVED: { label: "Resolved", color: "#2f7d43" },
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

function EmptyBlock({ t, onSubmit }) {
  return (
    <div className="rounded-lg border-2 border-dashed p-6 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
      <MessageSquareWarning className="w-8 h-8 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
        No concerns submitted yet.
      </p>
      <p className={`${t.body} text-slate-600 max-w-md`}>
        If you have a question or issue about pension, benefits, documents, or anything else, you can report it here.
      </p>
      <button
        type="button"
        onClick={onSubmit}
        className="mt-2 px-4 py-2 rounded-md font-bold text-white"
        style={{ backgroundColor: COLORS.baltic }}
      >
        Report a Concern
      </button>
    </div>
  );
}

function SubmitConcernModal({ onClose, onSubmitted }) {
  const [form, setForm] = useState({ subject: "", description: "", category: "OTHER", reportedUrgency: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, reportedUrgency: form.reportedUrgency || undefined };
      await submitConcern(payload);
      onSubmitted();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || !form.subject.trim() || !form.description.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>
            Report a Concern
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => update("subject", e.target.value)}
              placeholder="e.g. Pension claiming schedule issue"
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

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Describe your concern</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={5}
              placeholder="Please describe what happened and any details that can help Barangay Staff assist you."
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={3000}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>How urgent is this? (optional)</label>
            <select
              value={form.reportedUrgency}
              onChange={(e) => update("reportedUrgency", e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
            >
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              This helps Barangay Staff understand your situation — the final priority is decided by Staff after review.
            </p>
          </div>
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
            Submit Concern
          </button>
        </div>
      </div>
    </div>
  );
}

function ConcernDetailDialog({ concernId, onClose, t }) {
  const [concern, setConcern] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyConcern(concernId)
      .then(setConcern)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [concernId]);

  const statusInfo = concern ? STATUS_LABELS[concern.status] || { label: concern.status, color: COLORS.baltic } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className={`${t.cardTitle} font-extrabold`} style={{ color: COLORS.yale }}>
            Concern Details
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600" role="alert">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
              <span className={t.body}>{error}</span>
            </div>
          ) : (
            <>
              <span
                className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: statusInfo.color + "1a", color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>{concern.subject}</p>

              <div className="text-sm text-slate-500 flex items-center gap-1.5">
                <Clock className="w-4 h-4" aria-hidden="true" />
                Submitted {formatDate(concern.createdAt)}
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Category</p>
                <p className={`${t.body} text-slate-700`}>{CATEGORY_OPTIONS.find((c) => c.value === concern.category)?.label || concern.category}</p>
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Description</p>
                <p className={`${t.body} text-slate-700 whitespace-pre-wrap`}>{concern.description}</p>
              </div>

              {concern.priority && (
                <div className="pt-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Priority</p>
                  <p className={`${t.body} text-slate-700`}>{concern.priority}</p>
                </div>
              )}

              {concern.responses?.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Staff Response</p>
                  <div className="space-y-2">
                    {concern.responses.map((r, i) => (
                      <div key={i} className="rounded-md p-3" style={{ backgroundColor: COLORS.baltic + "0d" }}>
                        <p className={`${t.body} text-slate-700 whitespace-pre-wrap`}>{r.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatDate(r.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {concern.status === "RESOLVED" && concern.resolvedAt && (
                <div className="pt-2 text-sm font-bold" style={{ color: "#2f7d43" }}>
                  Resolved on {formatDate(concern.resolvedAt)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConcernsPanel({ t }) {
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyConcerns()
      .then(setConcerns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md font-bold text-white"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Report a Concern
        </button>
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
      ) : concerns.length === 0 ? (
        <EmptyBlock t={t} onSubmit={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {concerns.map((c) => {
            const statusInfo = STATUS_LABELS[c.status] || { label: c.status, color: COLORS.baltic };
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => setSelectedId(c._id)}
                className="w-full text-left bg-white rounded-xl border-2 p-4 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>{c.subject}</p>
                  <span
                    className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: statusInfo.color + "1a", color: statusInfo.color }}
                  >
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Submitted {formatDate(c.createdAt)}</p>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <SubmitConcernModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {selectedId && <ConcernDetailDialog concernId={selectedId} onClose={() => setSelectedId(null)} t={t} />}
    </div>
  );
}
