import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning, Loader2, AlertCircle, Plus, X } from "lucide-react";
import GuardianLayout from "./GuardianLayout.jsx";
import { getSelectedSeniorId } from "../../services/guardianService.js";
import { submitConcern, getMyConcerns } from "../../services/concernService.js";
import { COLORS } from "../dashboard/theme.js";

const STATUS_LABELS = {
  NEW: { label: "Submitted", color: "#6b7280" },
  UNDER_REVIEW: { label: "Under Review", color: COLORS.baltic },
  IN_PROGRESS: { label: "In Progress", color: "#b45309" },
  RESOLVED: { label: "Resolved", color: "#2f7d43" },
};

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function SubmitDialog({ seniorId, onClose, onSubmitted }) {
  const [form, setForm] = useState({ subject: "", description: "", category: "OTHER" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await submitConcern(form, seniorId);
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>Report a Concern</h3>
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
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 rounded-md border-2"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white flex justify-end gap-2 px-5 py-4 border-t-2" style={{ borderColor: COLORS.alabaster }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md font-bold border-2" style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !form.subject.trim() || !form.description.trim()}
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

export default function GuardianConcernsPage() {
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    const seniorId = getSelectedSeniorId();
    if (!seniorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getMyConcerns({ seniorId })
      .then(setConcerns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seniorId = getSelectedSeniorId();

  return (
    <GuardianLayout title="Reports / Concerns" subtitle="Submitted on behalf of the selected Senior.">
      <div className="flex justify-end mb-4">
        <button
          type="button"
          disabled={!seniorId}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Report a Concern
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-md px-4 py-3" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Unable to load concerns. Please try again.</span>
        </div>
      ) : !seniorId ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <MessageSquareWarning className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>Select a Senior first.</p>
        </div>
      ) : concerns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <MessageSquareWarning className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>No concerns submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {concerns.map((c) => {
            const s = STATUS_LABELS[c.status] || { label: c.status, color: COLORS.baltic };
            return (
              <div key={c._id} className="bg-white rounded-xl border-2 p-4 flex items-center justify-between" style={{ borderColor: COLORS.alabaster }}>
                <div>
                  <p className="font-bold" style={{ color: COLORS.yale }}>{c.subject}</p>
                  <p className="text-xs text-slate-400">Submitted {formatDate(c.createdAt)}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.color + "1a", color: s.color }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <SubmitDialog
          seniorId={seniorId}
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </GuardianLayout>
  );
}
