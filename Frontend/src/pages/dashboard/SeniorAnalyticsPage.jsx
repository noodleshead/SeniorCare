import { useCallback, useEffect, useState } from "react";
import { Users, HeartPulse, Wallet, ClipboardList, MapPinOff, AlertCircle, Loader2 } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import { getAnalyticsBarangays, getSeniorAnalyticsSummary, getSeniorMapMarkers } from "../../services/analyticsService.js";
import { SummaryCard, BarList, SplitDonut, Section, APPLICATION_STATUS_LABELS } from "./components/ReportWidgets.jsx";

// Same convention PensionManagementPage.jsx already uses for its own
// barangay-selection UI — ADMIN/LGU_OSCA may pick a barangay, BARANGAY_STAFF
// cannot (the backend ignores any barangayId they'd send anyway; hiding
// the control here is purely about not showing a choice that doesn't exist).
const ROLES_WITH_BARANGAY_CHOICE = new Set(["ADMIN", "LGU_OSCA"]);

export default function SeniorAnalyticsPage() {
  const user = getStoredUser();
  const canChooseBarangay = ROLES_WITH_BARANGAY_CHOICE.has(user?.role);

  const [barangays, setBarangays] = useState([]);
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [summary, setSummary] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canChooseBarangay) return;
    getAnalyticsBarangays()
      .then(setBarangays)
      .catch(() => setBarangays([]));
  }, [canChooseBarangay]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const barangayId = canChooseBarangay ? selectedBarangayId || undefined : undefined;
    Promise.all([getSeniorAnalyticsSummary(barangayId), getSeniorMapMarkers(barangayId)])
      .then(([summaryData, mapData]) => {
        setSummary(summaryData);
        setMapInfo(mapData);
      })
      .catch((err) => setError(err.message || "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, [canChooseBarangay, selectedBarangayId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      title="Senior Mapping & Analytics"
      subtitle={
        canChooseBarangay
          ? "Multi-barangay senior population, demographics, and service analytics."
          : "Senior population, demographics, and service analytics for your assigned Barangay."
      }
    >
      {canChooseBarangay && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-600" htmlFor="barangayFilter">
            Barangay:
          </label>
          <select
            id="barangayFilter"
            value={selectedBarangayId}
            onChange={(e) => setSelectedBarangayId(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm font-medium"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            <option value="">All Barangays (Consolidated)</option>
            {barangays.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
      ) : !summary || summary.totals.seniors === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: COLORS.alabaster }}>
          <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-500">
            {summary?.barangayLocked && summary.totals.seniors === 0 && !summary.barangay
              ? "Your account has no assigned Barangay, so no data can be shown."
              : "No senior records available for this Barangay."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.scope === "single" && summary.barangay && (
            <p className="text-sm font-semibold" style={{ color: COLORS.cerulean }}>
              Showing: {summary.barangay.name}
              {summary.barangay.municipality ? `, ${summary.barangay.municipality}` : ""}
            </p>
          )}

          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Users} label="Total Seniors" value={summary.totals.seniors} color={COLORS.baltic} />
            <SummaryCard
              icon={HeartPulse}
              label="Bedridden"
              value={summary.totals.bedridden}
              sub={`${summary.totals.bedriddenPercent}% of population`}
              color="#b8452f"
            />
            <SummaryCard
              icon={Wallet}
              label="Pension Beneficiaries"
              value={summary.pension.totalBeneficiaries}
              sub={`${summary.pension.active} active`}
              color={COLORS.cerulean}
            />
            <SummaryCard
              icon={ClipboardList}
              label="Assistance Applications"
              value={summary.applications.reduce((a, c) => a + c.count, 0)}
              sub={`${summary.applications.find((a) => a.status === "SUBMITTED")?.count || 0} pending review`}
              color={COLORS.sky}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Section title="Gender Distribution">
              <SplitDonut
                total={summary.totals.male + summary.totals.female}
                segments={[
                  { label: "Male", count: summary.totals.male, color: COLORS.baltic },
                  { label: "Female", count: summary.totals.female, color: COLORS.sky },
                ]}
              />
            </Section>
            <Section title="Bedridden Status">
              <SplitDonut
                total={summary.totals.bedridden + summary.totals.nonBedridden}
                segments={[
                  { label: "Bedridden", count: summary.totals.bedridden, color: "#b8452f" },
                  { label: "Not Bedridden", count: summary.totals.nonBedridden, color: COLORS.cerulean },
                ]}
              />
            </Section>
          </div>

          <Section title="Age Group Distribution" subtitle="Calculated from each Senior's date of birth.">
            <BarList items={summary.ageGroups} />
          </Section>

          <div className="grid lg:grid-cols-2 gap-6">
            <Section title="Pension Claim Records" subtitle="All-time claim outcomes for this scope.">
              <BarList
                items={[
                  { label: "Scheduled", count: summary.pension.claims.scheduled },
                  { label: "Claimed", count: summary.pension.claims.claimed },
                  { label: "Missed", count: summary.pension.claims.missed },
                  { label: "Cancelled", count: summary.pension.claims.cancelled },
                ]}
              />
            </Section>
            <Section title="Assistance / Application Status">
              <BarList
                items={summary.applications.map((a) => ({ label: APPLICATION_STATUS_LABELS[a.status] || a.status, count: a.count }))}
              />
            </Section>
          </div>

          {/* Priority analytics — honestly reported as unavailable rather
              than fabricated (see analytics.service.js#getSeniorAnalytics). */}
          {!summary.priority.available && (
            <div className="bg-white rounded-xl border p-5 text-sm text-slate-500" style={{ borderColor: COLORS.alabaster }}>
              <span className="font-semibold" style={{ color: COLORS.yale }}>
                Priority Senior Analytics:{" "}
              </span>
              {summary.priority.note}
            </div>
          )}

          {/* Barangay comparison — consolidated (LGU/Admin, no filter) only. */}
          {summary.scope === "all" && summary.byBarangay.length > 0 && (
            <Section title="Barangay Comparison" subtitle="Administrative overview — not a performance ranking.">
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
                    {summary.byBarangay.map((row) => (
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

          {/* Senior Mapping — honest empty state. No Senior, address, or
              Barangay record anywhere in the system currently stores a
              geographic coordinate (see analytics.service.js#getSeniorMapMarkers),
              so this never fabricates marker positions. */}
          <Section title="Senior Mapping" subtitle="Geographic distribution of Seniors in this scope.">
            {mapInfo?.hasLocationData ? (
              <p className="text-sm text-slate-500">Map data available.</p>
            ) : (
              <div className="text-center py-10">
                <MapPinOff className="w-8 h-8 mx-auto mb-3 text-slate-300" aria-hidden="true" />
                <p className="text-sm font-semibold" style={{ color: COLORS.yale }}>
                  No mapped Senior locations are currently available.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {mapInfo?.unmappedCount ?? summary.totals.seniors} Seniors in this scope have no recorded geographic
                  location. Senior registration does not currently collect GPS coordinates.
                </p>
              </div>
            )}
          </Section>
        </div>
      )}
    </DashboardLayout>
  );
}
