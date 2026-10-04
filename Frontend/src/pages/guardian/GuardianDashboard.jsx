import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, MessageSquareWarning, Wallet, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import GuardianLayout from "./GuardianLayout.jsx";
import { getGuardianDashboard } from "../../services/guardianService.js";
import { COLORS } from "../dashboard/theme.js";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function StatCard({ icon: Icon, label, value, to }) {
  const content = (
    <div className="bg-white rounded-xl border-2 p-5 flex items-center gap-4" style={{ borderColor: COLORS.alabaster }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.baltic + "1a" }}>
        <Icon className="w-5 h-5" style={{ color: COLORS.baltic }} aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-extrabold" style={{ color: COLORS.yale }}>{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function GuardianDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGuardianDashboard()
      .then(setDashboard)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <GuardianLayout title="Overview" subtitle="A quick look at what needs your attention.">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-md px-4 py-3" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Unable to load your dashboard. Please try again.</span>
        </div>
      ) : dashboard.managedSeniorsCount === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <Users className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>No managed Seniors yet.</p>
          <p className="text-sm text-slate-600 max-w-md">
            Once a Barangay confirms your authorization to manage a Senior Citizen's affairs, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Managed Seniors" value={dashboard.managedSeniorsCount} to="/guardian/seniors" />
            <StatCard icon={MessageSquareWarning} label="Open Concerns" value={dashboard.pendingConcernsCount} to="/guardian/concerns" />
            <StatCard icon={Wallet} label="Upcoming Pension Claims" value={dashboard.upcomingPensionClaims.length} to="/guardian/pension" />
          </div>

          {dashboard.upcomingPensionClaims.length > 0 && (
            <div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: COLORS.alabaster }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold" style={{ color: COLORS.yale }}>Upcoming Pension Schedules</h2>
                <Link to="/guardian/pension" className="text-sm font-bold flex items-center gap-1" style={{ color: COLORS.baltic }}>
                  View all <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="space-y-2">
                {dashboard.upcomingPensionClaims.map(({ senior, claim }) => (
                  <div key={claim._id} className="flex items-center justify-between text-sm border-b last:border-b-0 py-2" style={{ borderColor: COLORS.alabaster }}>
                    <span style={{ color: COLORS.yale }}>{senior.firstName} {senior.lastName}</span>
                    <span className="text-slate-500">{formatDate(claim.scheduledDate)} · {claim.scheduledTime || claim.slotTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GuardianLayout>
  );
}
