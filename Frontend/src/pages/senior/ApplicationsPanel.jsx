import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, AlertCircle } from "lucide-react";
import { getMyApplications } from "../../services/benefitService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const STATUS_DISPLAY = {
  SUBMITTED: { label: "📄 Submitted", color: COLORS.baltic },
  UNDER_REVIEW: { label: "🔍 Under Review", color: COLORS.baltic },
  ENDORSED: { label: "↗ Endorsed to OSCA", color: COLORS.cerulean },
  APPROVED: { label: "✓ Approved", color: "#2f7d43" },
  RELEASED: { label: "📦 Released", color: "#2f7d43" },
  CLAIMED: { label: "✓ Claimed", color: "#2f7d43" },
  REJECTED: { label: "✕ Rejected", color: "#b8452f" },
};

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
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

export default function ApplicationsPanel({ t }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyApplications()
      .then(setApplications)
      .catch((err) => setError(err.message || "We couldn't load your applications right now."))
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

  if (applications.length === 0) {
    return (
      <EmptyBlock
        icon={ClipboardList}
        title="No applications yet."
        message="When you apply for a SENIORCARE program, your applications will appear here."
        t={t}
      />
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => {
        const display = STATUS_DISPLAY[app.status] || STATUS_DISPLAY.SUBMITTED;
        return (
          <div key={app._id} className="bg-white rounded-lg border-2 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ borderColor: COLORS.alabaster }}>
            <div>
              <p className={`${t.body} font-bold`} style={{ color: COLORS.yale }}>{app.benefitProgramId?.name || "Benefit Program"}</p>
              <p className={`${t.small} text-slate-500`}>Applied {formatDateTime(app.createdAt)}</p>
              {app.status === "REJECTED" && app.rejectionReason && (
                <p className={`${t.small} mt-1`} style={{ color: "#b8452f" }}>Reason: {app.rejectionReason}</p>
              )}
              {app.remarks && app.status !== "REJECTED" && (
                <p className={`${t.small} text-slate-600 mt-1`}>{app.remarks}</p>
              )}
            </div>
            <span className={`${t.small} font-bold whitespace-nowrap`} style={{ color: display.color }}>{display.label}</span>
          </div>
        );
      })}
    </div>
  );
}
