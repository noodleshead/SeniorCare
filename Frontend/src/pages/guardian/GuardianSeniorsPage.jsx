import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Loader2, AlertCircle, ChevronRight, BedDouble } from "lucide-react";
import GuardianLayout from "./GuardianLayout.jsx";
import { getManagedSeniors, setSelectedSeniorId } from "../../services/guardianService.js";
import { COLORS } from "../dashboard/theme.js";

export default function GuardianSeniorsPage() {
  const navigate = useNavigate();
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getManagedSeniors()
      .then(setSeniors)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleManage = (senior) => {
    setSelectedSeniorId(senior._id);
    navigate("/guardian/dashboard");
  };

  return (
    <GuardianLayout title="My Managed Seniors" subtitle="Seniors you are authorized to assist.">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-md px-4 py-3" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Unable to load your managed Seniors. Please try again.</span>
        </div>
      ) : seniors.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <Users className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>No managed Seniors yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {seniors.map((s) => (
            <button
              key={s._id}
              type="button"
              onClick={() => handleManage(s)}
              className="text-left bg-white rounded-xl border-2 p-5 hover:shadow-md transition-shadow flex items-center justify-between gap-3"
              style={{ borderColor: COLORS.alabaster }}
            >
              <div>
                <p className="font-extrabold text-lg" style={{ color: COLORS.yale }}>{s.firstName} {s.lastName}</p>
                <p className="text-sm text-slate-500">SC ID: {s.seniorCitizenId}</p>
                {s.barangay?.name && <p className="text-sm text-slate-500">{s.barangay.name}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.baltic + "1a", color: COLORS.baltic }}>
                    {s.status}
                  </span>
                  {s.bedridden && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                      <BedDouble className="w-3 h-3" aria-hidden="true" />
                      Bedridden
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 shrink-0" style={{ color: COLORS.baltic }} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </GuardianLayout>
  );
}
