import { useCallback, useEffect, useState } from "react";
import { HandHeart, Loader2, AlertCircle, CheckCircle2, X, Upload, Info } from "lucide-react";
import { getMyEligiblePrograms, applyForBenefit } from "../../services/benefitService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const DOCUMENT_TYPE_LABELS = {
  VALID_ID: "Valid Identification",
  SENIOR_CITIZEN_ID: "Senior Citizen ID",
  PROOF_OF_RESIDENCY: "Proof of Residency",
  GUARDIAN_ID: "Guardian ID",
  AUTHORIZATION_DOCUMENT: "Guardian Authorization Document",
  BENEFIT_SUPPORTING_DOCUMENT: "Supporting Document",
};

const CATEGORY_LABELS = {
  AGE_BASED: "Age-Based Program",
  FINANCIAL_ASSISTANCE: "Financial Assistance",
  OTHER: "Assistance Program",
};

function formatCurrency(amount) {
  if (amount == null) return null;
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

function EmptyBlock({ icon: Icon, title, message, t }) {
  return (
    <div className="rounded-lg border-2 border-dashed p-6 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
      <Icon className="w-8 h-8 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>{title}</p>
      <p className={`${t.body} text-slate-600 max-w-md`}>{message}</p>
    </div>
  );
}

function ApplyDialog({ program, onClose, onSubmitted, t }) {
  const [files, setFiles] = useState({}); // documentType -> File
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const requiredTypes = program.requiredDocumentTypes || [];
  const allProvided = requiredTypes.every((type) => Boolean(files[type]));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const documents = requiredTypes.map((type) => ({ file: files[type], documentType: type }));
      await applyForBenefit({ benefitProgramId: program._id, documents });
      onSubmitted();
    } catch (err) {
      setError(err.message || "Your application could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="apply-dialog-title">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 id="apply-dialog-title" className={`${t.cardTitle} font-extrabold`} style={{ color: COLORS.yale }}>
            Apply for {program.name}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100" style={{ color: COLORS.yale }}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {requiredTypes.length === 0 ? (
          <p className={`${t.body} text-slate-600 mb-4`}>This program has no additional documents to upload.</p>
        ) : (
          <div className="space-y-3 mb-4">
            <p className={`${t.small} font-semibold`} style={{ color: COLORS.cerulean }}>Required Documents</p>
            {requiredTypes.map((type) => (
              <label key={type} className="flex flex-col gap-1 rounded-lg border-2 p-3" style={{ borderColor: COLORS.alabaster }}>
                <span className={`${t.body} font-semibold flex items-center gap-2`} style={{ color: COLORS.yale }}>
                  <Upload className="w-4 h-4 shrink-0" aria-hidden="true" /> {DOCUMENT_TYPE_LABELS[type] || type}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFiles((f) => ({ ...f, [type]: e.target.files?.[0] || null }))}
                  className={`${t.small}`}
                />
                {files[type] && <span className="text-xs text-slate-500">{files[type].name}</span>}
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className={`${t.small} font-semibold mb-3 flex items-center gap-2`} style={{ color: "#b8452f" }}>
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !allProvided}
            className={`${t.body} flex-1 font-bold text-white rounded-md px-4 py-3 disabled:opacity-60 flex items-center justify-center gap-2`}
            style={{ backgroundColor: COLORS.baltic }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`${t.body} font-bold rounded-md px-4 py-3 border-2 disabled:opacity-60`}
            style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramCard({ program, eligible, reasons, onApply, t }) {
  return (
    <div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: COLORS.alabaster }}>
      <p className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
        {CATEGORY_LABELS[program.category] || program.category}
      </p>
      <p className={`${t.cardTitle} font-extrabold mt-1`} style={{ color: COLORS.yale }}>{program.name}</p>
      {program.description && <p className={`${t.body} text-slate-600 mt-2`}>{program.description}</p>}

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
        {formatCurrency(program.amount) && (
          <p className={`${t.small} font-semibold`} style={{ color: COLORS.yale }}>Amount: {formatCurrency(program.amount)}</p>
        )}
        {program.endDate && (
          <p className={`${t.small} font-semibold`} style={{ color: COLORS.yale }}>Apply by: {formatDate(program.endDate)}</p>
        )}
      </div>

      {eligible ? (
        <button
          type="button"
          onClick={() => onApply(program)}
          className={`${t.body} mt-4 font-bold text-white rounded-md px-5 py-2.5`}
          style={{ backgroundColor: COLORS.baltic }}
        >
          Apply
        </button>
      ) : (
        <div className="mt-4 rounded-md p-3 flex items-start gap-2" style={{ backgroundColor: "#f1f5f9" }}>
          <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <div>
            <p className={`${t.small} font-semibold`} style={{ color: COLORS.yale }}>Not currently eligible</p>
            <ul className="list-disc list-inside">
              {reasons.map((r) => (
                <li key={r} className={`${t.small} text-slate-600`}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BenefitsPanel({ t }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [applyTarget, setApplyTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyEligiblePrograms()
      .then(setResults)
      .catch((err) => setError(err.message || "We couldn't load your benefits right now."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return <EmptyBlock icon={AlertCircle} title="Something went wrong." message={error} t={t} />;
  }

  if (results.length === 0) {
    return (
      <EmptyBlock
        icon={HandHeart}
        title="No benefit programs available right now."
        message="Assistance programs made available to your barangay will appear here."
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="rounded-md border p-3 flex items-center gap-2" style={{ backgroundColor: "#eef8f0", borderColor: "#bcdfc3", color: "#2f7d43" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> {successMessage}
        </div>
      )}
      {results.map(({ program, eligible, reasons }) => (
        <ProgramCard key={program._id} program={program} eligible={eligible} reasons={reasons} onApply={setApplyTarget} t={t} />
      ))}

      {applyTarget && (
        <ApplyDialog
          program={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSubmitted={() => {
            setApplyTarget(null);
            setSuccessMessage(`Your application for "${applyTarget.name}" has been submitted.`);
            load();
          }}
          t={t}
        />
      )}
    </div>
  );
}
