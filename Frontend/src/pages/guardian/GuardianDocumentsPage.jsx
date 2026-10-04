import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import GuardianLayout from "./GuardianLayout.jsx";
import { getSelectedSeniorId, getManagedSenior } from "../../services/guardianService.js";
import { COLORS } from "../dashboard/theme.js";

const VERIFICATION_STYLE = {
  PENDING: { label: "Pending Verification", color: "#b45309", icon: Clock },
  APPROVED: { label: "Verified", color: "#2f7d43", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "#b8452f", icon: XCircle },
};

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export default function GuardianDocumentsPage() {
  const [senior, setSenior] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const seniorId = getSelectedSeniorId();
    if (!seniorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getManagedSenior(seniorId)
      .then(setSenior)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusInfo = senior ? VERIFICATION_STYLE[senior.verificationStatus] : null;
  const StatusIcon = statusInfo?.icon;

  return (
    <GuardianLayout title="Documents" subtitle="Document status for the selected Senior.">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-md px-4 py-3" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Unable to load documents. Please try again.</span>
        </div>
      ) : !senior ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <FileText className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>Select a Senior first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {statusInfo && (
            <div
              className="flex items-center gap-3 rounded-xl border-2 p-4"
              style={{ borderColor: statusInfo.color + "40", backgroundColor: statusInfo.color + "0d" }}
            >
              <StatusIcon className="w-6 h-6 shrink-0" style={{ color: statusInfo.color }} aria-hidden="true" />
              <div>
                <p className="font-bold" style={{ color: statusInfo.color }}>{statusInfo.label}</p>
                <p className="text-sm text-slate-600">Overall registration/document verification status for this Senior.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: COLORS.alabaster }}>
            <h2 className="font-bold mb-3" style={{ color: COLORS.yale }}>Uploaded Documents</h2>
            {senior.documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents on file yet.</p>
            ) : (
              <ul className="divide-y-2" style={{ borderColor: COLORS.alabaster }}>
                {senior.documents.map((d) => (
                  <li key={d._id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold" style={{ color: COLORS.yale }}>{d.documentType?.replace(/_/g, " ")}</p>
                      <p className="text-slate-500">{d.fileName}</p>
                    </div>
                    <span className="text-slate-400">{formatDate(d.uploadedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </GuardianLayout>
  );
}
