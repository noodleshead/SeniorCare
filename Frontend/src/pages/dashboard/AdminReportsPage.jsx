import { useCallback, useEffect, useState } from "react";
import {
  Users,
  HeartPulse,
  Wallet,
  ClipboardList,
  Building2,
  UserCog,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getReportBarangays, getSystemReport, downloadReportCsv } from "../../services/adminReportsService.js";
import { SummaryCard, BarList, SplitDonut, Section, APPLICATION_STATUS_LABELS } from "./components/ReportWidgets.jsx";

const ROLE_LABELS = {
  SENIOR_CITIZEN: "Senior",
  GUARDIAN: "Guardian",
  BARANGAY_STAFF: "Barangay Staff",
  ADMIN: "Administrator",
  LGU_OSCA: "LGU-OSCA",
};

const STATUS_LABELS = {
  PENDING_VERIFICATION: "Pending Verification",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  INACTIVE: "Inactive",
};

function ExportButton({ onClick, label }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border disabled:opacity-50"
      style={{ borderColor: COLORS.alabaster, color: COLORS.cerulean }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
      {label}
    </button>
  );
}

export default function AdminReportsPage() {
  const [barangays, setBarangays] = useState([]);
  const [barangayId, setBarangayId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getReportBarangays()
      .then(setBarangays)
      .catch(() => setBarangays([]));
  }, []);

  const filters = { barangayId: barangayId || undefined, from: from || undefined, to: to || undefined };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSystemReport(filters)
      .then(setReport)
      .catch((err) => setError(err.message || "Unable to load system reports. Please try again."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangayId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = (key) => () => downloadReportCsv(key, filters);

  const totalApplications = report?.applications.reduce((a, c) => a + c.count, 0) || 0;

  return (
    <DashboardLayout title="System Reports" subtitle="System-wide, database-driven reporting across all Barangays.">
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="barangayFilter">
            Barangay
          </label>
          <select
            id="barangayFilter"
            value={barangayId}
            onChange={(e) => setBarangayId(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm font-medium"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            <option value="">All Barangays</option>
            {barangays.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="fromDate">
            From
          </label>
          <input
            id="fromDate"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="toDate">
            To
          </label>
          <input
            id="toDate"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          />
        </div>
        {(from || to) && (
          <p className="text-xs text-slate-500 pb-2.5">
            Filters registration date (when the Senior account was created). Pension/application/user figures reflect
            the same filtered population.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        </div>
      ) : !report ? null : report.totals.seniors === 0 && report.users.total === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: COLORS.alabaster }}>
          <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-500">No report data available for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {report.scope === "single" && report.barangay && (
            <p className="text-sm font-semibold" style={{ color: COLORS.cerulean }}>
              Showing: {report.barangay.name}
              {report.barangay.municipality ? `, ${report.barangay.municipality}` : ""} — Administrator remains system-level;
              this only narrows the report view.
            </p>
          )}

          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <SummaryCard icon={Users} label="Total Active Seniors" value={report.totals.seniors} color={COLORS.baltic} />
            <SummaryCard
              icon={Building2}
              label="Barangays"
              value={report.barangayCoverage.totalBarangays}
              sub={`${report.barangayCoverage.barangaysWithActiveSeniors} with active Seniors`}
              color={COLORS.yale}
            />
            <SummaryCard
              icon={HeartPulse}
              label="Bedridden"
              value={report.totals.bedridden}
              sub={`${report.totals.bedriddenPercent}% of population`}
              color="#b8452f"
            />
            <SummaryCard
              icon={Wallet}
              label="Pension Beneficiaries"
              value={report.pension.totalBeneficiaries}
              sub={`${report.pension.active} active`}
              color={COLORS.cerulean}
            />
            <SummaryCard icon={ClipboardList} label="Total Applications" value={totalApplications} color={COLORS.sky} />
            <SummaryCard icon={UserCog} label="Total Users" value={report.users.total} color={COLORS.baltic} />
          </div>

          {report.barangayCoverage.highestPopulation && (
            <p className="text-xs text-slate-500">
              Barangay with the highest recorded Senior population:{" "}
              <span className="font-semibold" style={{ color: COLORS.yale }}>
                {report.barangayCoverage.highestPopulation.name}
              </span>{" "}
              ({report.barangayCoverage.highestPopulation.seniors} Seniors) — shown for informational purposes only, not
              a ranking.
            </p>
          )}

          {/* Demographics */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Section title="Gender Distribution" action={<ExportButton label="CSV" onClick={exportCsv("demographics")} />}>
              <SplitDonut
                total={report.totals.male + report.totals.female}
                segments={[
                  { label: "Male", count: report.totals.male, color: COLORS.baltic },
                  { label: "Female", count: report.totals.female, color: COLORS.sky },
                ]}
              />
            </Section>
            <Section title="Bedridden Status">
              <SplitDonut
                total={report.totals.bedridden + report.totals.nonBedridden}
                segments={[
                  { label: "Bedridden", count: report.totals.bedridden, color: "#b8452f" },
                  { label: "Not Bedridden", count: report.totals.nonBedridden, color: COLORS.cerulean },
                ]}
              />
            </Section>
          </div>

          <Section title="Age Group Distribution" subtitle="Calculated from each Senior's date of birth.">
            <BarList items={report.ageGroups} />
          </Section>

          {/* Pension / Applications */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Section
              title="Pension Statistics"
              subtitle="All-time claim outcomes for this scope."
              action={<ExportButton label="CSV" onClick={exportCsv("pension")} />}
            >
              <BarList
                items={[
                  { label: "Scheduled", count: report.pension.claims.scheduled },
                  { label: "Claimed", count: report.pension.claims.claimed },
                  { label: "Missed", count: report.pension.claims.missed },
                  { label: "Cancelled", count: report.pension.claims.cancelled },
                ]}
              />
            </Section>
            <Section
              title="Assistance / Application Status"
              action={<ExportButton label="CSV" onClick={exportCsv("applications")} />}
            >
              <BarList
                items={report.applications.map((a) => ({ label: APPLICATION_STATUS_LABELS[a.status] || a.status, count: a.count }))}
              />
            </Section>
          </div>

          {!report.priority.available && (
            <div className="bg-white rounded-xl border p-5 text-sm text-slate-500" style={{ borderColor: COLORS.alabaster }}>
              <span className="font-semibold" style={{ color: COLORS.yale }}>
                Priority Senior Reporting:{" "}
              </span>
              {report.priority.note}
            </div>
          )}

          {/* Barangay comparison — only meaningful when not already narrowed to one barangay. */}
          {report.scope === "all" && report.byBarangay.length > 0 && (
            <Section
              title="Barangay Summary"
              subtitle="Administrative overview — not a performance ranking."
              action={<ExportButton label="CSV" onClick={exportCsv("barangaySummary")} />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                      <th className="py-2 pr-4 font-semibold">Barangay</th>
                      <th className="py-2 pr-4 font-semibold text-right">Seniors</th>
                      <th className="py-2 pr-4 font-semibold text-right">Bedridden</th>
                      <th className="py-2 pr-4 font-semibold text-right">Pension Beneficiaries</th>
                      <th className="py-2 font-semibold text-right">Active Applications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byBarangay.map((row) => (
                      <tr key={row.barangayId} className="border-b last:border-0" style={{ borderColor: COLORS.alabaster }}>
                        <td className="py-2.5 pr-4 font-medium" style={{ color: COLORS.yale }}>
                          {row.name}
                        </td>
                        <td className="py-2.5 pr-4 text-right">{row.seniors}</td>
                        <td className="py-2.5 pr-4 text-right">{row.bedridden}</td>
                        <td className="py-2.5 pr-4 text-right">{row.pensionBeneficiaries}</td>
                        <td className="py-2.5 text-right">{row.activeApplications}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* User / account statistics */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Section title="Accounts by Role" action={<ExportButton label="CSV" onClick={exportCsv("users")} />}>
              <BarList
                items={Object.entries(report.users.byRole).map(([role, count]) => ({ label: ROLE_LABELS[role] || role, count }))}
              />
            </Section>
            <Section title="Accounts by Status">
              <BarList
                items={Object.entries(report.users.byStatus).map(([status, count]) => ({
                  label: STATUS_LABELS[status] || status,
                  count,
                }))}
              />
            </Section>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
