import { useCallback, useEffect, useState } from "react";
import { Wallet, Loader2, AlertCircle, QrCode, X, Clock } from "lucide-react";
import GuardianLayout from "./GuardianLayout.jsx";
import { getSelectedSeniorId } from "../../services/guardianService.js";
import { getStoredUser } from "../../services/authService.js";
import { getMyUpcomingClaim, getMyClaimHistory, getMyClaimQr } from "../../services/pensionService.js";
import { COLORS } from "../dashboard/theme.js";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function QrDialog({ claim, seniorName, guardianEmail, onClose }) {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyClaimQr(claim._id, getSelectedSeniorId())
      .then(setQr)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [claim._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>Claiming Pass</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-3 text-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Senior</p>
            <p className="font-bold" style={{ color: COLORS.yale }}>{seniorName}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Claimant / Guardian</p>
            <p className="font-bold" style={{ color: COLORS.yale }}>{guardianEmail}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <img src={qr.qrDataUrl} alt="Claiming pass QR code" className="mx-auto w-56 h-56" />
          )}

          <p className="text-xs text-slate-500">Present this QR code to Barangay Staff to claim the pension.</p>
        </div>
      </div>
    </div>
  );
}

export default function GuardianPensionPage() {
  const guardian = getStoredUser();
  const [upcoming, setUpcoming] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQr, setShowQr] = useState(false);

  const load = useCallback(() => {
    const seniorId = getSelectedSeniorId();
    if (!seniorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getMyUpcomingClaim(seniorId), getMyClaimHistory(seniorId)])
      .then(([u, h]) => {
        setUpcoming(u);
        setHistory(h);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <GuardianLayout title="Pension" subtitle="Claiming schedule and pass for the selected Senior.">
      {({ selectedSenior }) => (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-md px-4 py-3" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Unable to load pension information. Please try again.</span>
            </div>
          ) : !selectedSenior ? (
            <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
              <Wallet className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
              <p className="font-bold" style={{ color: COLORS.yale }}>Select a Senior first.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: COLORS.alabaster }}>
                <h2 className="font-bold mb-3" style={{ color: COLORS.yale }}>Upcoming Claim</h2>
                {!upcoming ? (
                  <p className="text-sm text-slate-500">No upcoming claiming schedule for this Senior right now.</p>
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.yale }}>
                      <Clock className="w-4 h-4" aria-hidden="true" />
                      {formatDate(upcoming.scheduledDate)} · {upcoming.scheduledTime || upcoming.slotTime}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQr(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-md font-bold text-white"
                      style={{ backgroundColor: COLORS.baltic }}
                    >
                      <QrCode className="w-4 h-4" aria-hidden="true" />
                      Generate Claiming Pass
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: COLORS.alabaster }}>
                <h2 className="font-bold mb-3" style={{ color: COLORS.yale }}>Claim History</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">No claim history yet.</p>
                ) : (
                  <ul className="divide-y-2" style={{ borderColor: COLORS.alabaster }}>
                    {history.map((c) => (
                      <li key={c._id} className="py-2 flex items-center justify-between text-sm">
                        <span style={{ color: COLORS.yale }}>{formatDate(c.scheduledDate)}</span>
                        <span className="font-bold" style={{ color: COLORS.baltic }}>{c.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {showQr && upcoming && (
                <QrDialog
                  claim={upcoming}
                  seniorName={`${selectedSenior.firstName} ${selectedSenior.lastName}`}
                  guardianEmail={guardian?.email}
                  onClose={() => setShowQr(false)}
                />
              )}
            </div>
          )}
        </>
      )}
    </GuardianLayout>
  );
}
