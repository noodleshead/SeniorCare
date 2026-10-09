import { useCallback, useEffect, useState } from "react";
import { Users, HeartPulse, Wallet, ClipboardList, MapPinOff, AlertCircle, Loader2, Download, Stethoscope } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import { getAnalyticsBarangays, getSeniorAnalyticsSummary, getSeniorMapMarkers, downloadAnalyticsCsv } from "../../services/analyticsService.js";
import { SummaryCard, BarList, SplitDonut, Section, APPLICATION_STATUS_LABELS } from "./components/ReportWidgets.jsx";

// Same convention PensionManagementPage.jsx already uses for its own
// barangay-selection UI — ADMIN/LGU_OSCA may pick a barangay, BARANGAY_STAFF
// cannot (the backend ignores any barangayId they'd send anyway; hiding
// the control here is purely about not showing a choice that doesn't exist).
const ROLES_WITH_BARANGAY_CHOICE = new Set(["ADMIN", "LGU_OSCA"]);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ExportButton({ label, onClick }) {
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

const COMPARISON_COLUMNS = [
  { key: "name", label: "Barangay", align: "left" },
  { key: "seniors", label: "Seniors" },
  { key: "bedridden", label: "Bedridden" },
  { key: "pendingBarangayVerification", label: "Pending Verification" },
  { key: "homeVisitsRequired", label: "Home Visits Required" },
  { key: "homeVisitsCompleted", label: "Home Visits Completed" },
  { key: "endorsed", label: "Endorsed" },
  { key: "pensionBeneficiaries", label: "Pension Beneficiaries" },
  { key: "activeApplications", label: "Active Applications" },
];

export default function SeniorAnalyticsPage() {
  const user = getStoredUser();
  const canChooseBarangay = ROLES_WITH_BARANGAY_CHOICE.has(user?.role);
  const isLgu = user?.role === "LGU_OSCA";

  // Phase 8 — pension claim month/year filter, and barangay-comparison
  // search/sort (client-side over the barangay rows only — one row per
  // barangay, never per Senior, so this is bounded by the barangay count).
  const [pensionYear, setPensionYear] = useState("");
  const [pensionMonth, setPensionMonth] = useState("");
  const [comparisonSearch, setComparisonSearch] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });

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
    Promise.all([
      getSeniorAnalyticsSummary(barangayId, { pensionYear: pensionYear || undefined, pensionMonth: pensionYear ? pensionMonth || undefined : undefined }),
      getSeniorMapMarkers(barangayId),
    ])
      .then(([summaryData, mapData]) => {
        setSummary(summaryData);
        setMapInfo(mapData);
      })
      .catch((err) => {
        // Failed load must not look like "no data" (Step 22) — drop any
        // previous result so only the error banner renders.
        setSummary(null);
        setMapInfo(null);
        setError(err.message || "Failed to load analytics.");
      })
      .finally(() => setLoading(false));
  }, [canChooseBarangay, selectedBarangayId, pensionYear, pensionMonth]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      title={isLgu ? "LGU Dashboard" : "Senior Mapping & Analytics"}
      subtitle={
        canChooseBarangay
          ? "Multi-barangay senior population, demographics, and service analytics."
          : "Senior population, demographics, and service analytics for your assigned Barangay."
      }
    >
      <div className="mb-6 flex flex-wrap items-end gap-4">
        {canChooseBarangay && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="barangayFilter">
              Barangay
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
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="pensionYear">
            Pension Claim Year
          </label>
          <input
            id="pensionYear"
            type="number"
            min="2000"
            max="2100"
            placeholder="All time"
            value={pensionYear}
            onChange={(e) => {
              setPensionYear(e.target.value);
              if (!e.target.value) setPensionMonth("");
            }}
            className="border rounded-md px-3 py-2 text-sm w-28"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="pensionMonth">
            Month
          </label>
          <select
            id="pensionMonth"
            value={pensionMonth}
            onChange={(e) => setPensionMonth(e.target.value)}
            disabled={!pensionYear}
            className="border rounded-md px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            <option value="">Whole year</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {pensionYear && (
          <p className="text-xs text-slate-500 pb-2.5 max-w-xs">
            Filters pension claim counts by each claim's scheduled date. Senior, application, and workflow figures are
            current-state totals and are not date-filtered.
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
      ) : error ? null : !summary || summary.totals.seniors === 0 ? (
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
            <Section
              title="Pension Claim Records"
              subtitle={pensionYear ? `Claims scheduled in ${pensionMonth ? MONTHS[Number(pensionMonth) - 1] + " " : ""}${pensionYear}.` : "All-time claim outcomes for this scope."}
            >
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

          {/* Medical / priority aggregates (Phase 8, Step 9) — counts only.
              No individual Senior, illness, document, or remark is ever
              part of this payload; see analytics.service.js. */}
          <Section
            title="Medical & Priority Overview"
            subtitle="Aggregate counts only — no individual medical details are shown here."
          >
            {summary.medical.totalWithCondition === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No Seniors with a declared medical condition in this scope.</p>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" aria-hidden="true" /> Declared a condition: {summary.medical.totalWithCondition}
                  </p>
                  <BarList
                    items={[
                      { label: "Critical", count: summary.medical.classification.CRITICAL },
                      { label: "Non-Critical", count: summary.medical.classification.NON_CRITICAL },
                      { label: "Not yet classified", count: summary.medical.classification.unclassified },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Priority</p>
                  <BarList
                    items={[
                      { label: "High", count: summary.medical.priority.HIGH },
                      { label: "Normal", count: summary.medical.priority.NORMAL },
                      { label: "Not yet classified", count: summary.medical.priority.unclassified },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Home Visit (Admin decision)</p>
                  <BarList
                    items={[
                      { label: "Required", count: summary.medical.homeVisitRequired.REQUIRED },
                      { label: "Not required", count: summary.medical.homeVisitRequired.NOT_REQUIRED },
                      { label: "Not yet decided", count: summary.medical.homeVisitRequired.PENDING_DECISION },
                    ]}
                  />
                </div>
              </div>
            )}
          </Section>

          {/* Workflow monitoring (Step 8). Two tracks, shown separately on
              purpose: Barangay verification/Home Visit/endorsement live on
              the Senior record, while Approved/Released/Claimed live on
              BenefitApplication — merging them into one funnel would
              misrepresent which entity is being counted. */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Section
              title="Barangay Review Progress"
              subtitle="Seniors by Barangay verification, Home Visit, and endorsement stage."
              action={<ExportButton label="CSV" onClick={() => downloadAnalyticsCsv("workflow", canChooseBarangay ? selectedBarangayId || undefined : undefined)} />}
            >
              <BarList
                items={[
                  { label: "Pending verification", count: summary.workflow.barangayVerification.PENDING },
                  { label: "Verified", count: summary.workflow.barangayVerification.VERIFIED },
                  { label: "Revision required", count: summary.workflow.barangayVerification.REVISION_REQUIRED },
                  { label: "Rejected", count: summary.workflow.barangayVerification.REJECTED },
                  { label: "Home visits required", count: summary.medical.homeVisitRequired.REQUIRED },
                  { label: "Home visits completed", count: summary.medical.homeVisitExecution.COMPLETED },
                  { label: "Home visits pending / follow-up", count: summary.medical.homeVisitExecution.PENDING + summary.medical.homeVisitExecution.FOLLOW_UP_REQUIRED },
                  { label: "Endorsed", count: summary.workflow.endorsement.ENDORSED },
                  { label: "Ready for OSCA review", count: summary.workflow.readyForOscaReview },
                ]}
              />
            </Section>
            <Section
              title="Approved vs. Released vs. Claimed"
              subtitle="Kept as separate counts — approval is not release, and release is not a completed claim."
            >
              <BarList
                items={["ENDORSED", "REVISION_REQUIRED", "APPROVED", "RELEASED", "CLAIMED", "REJECTED"].map((status) => ({
                  label: APPLICATION_STATUS_LABELS[status] || status,
                  count: summary.applications.find((a) => a.status === status)?.count || 0,
                }))}
              />
            </Section>
          </div>

          {/* Barangay comparison — consolidated (LGU/Admin, no filter) only.
              Factual counts, sortable by any column; deliberately no
              ranking labels or performance scores. */}
          {summary.scope === "all" && summary.byBarangay.length > 0 && (
            <Section
              title="Barangay Comparison"
              subtitle="Operational overview — factual counts, not a performance ranking."
              action={<ExportButton label="CSV" onClick={() => downloadAnalyticsCsv("barangayComparison")} />}
            >
              <input
                type="search"
                value={comparisonSearch}
                onChange={(e) => setComparisonSearch(e.target.value)}
                placeholder="Filter barangays..."
                aria-label="Filter barangays"
                className="border rounded-md px-3 py-2 text-sm mb-3 w-full sm:w-64"
                style={{ borderColor: COLORS.alabaster }}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                      {COMPARISON_COLUMNS.map((col) => (
                        <th key={col.key} className={`py-2 pr-4 font-semibold ${col.align === "left" ? "" : "text-right"}`}>
                          <button
                            type="button"
                            onClick={() => setSort((cur) => ({ key: col.key, dir: cur.key === col.key && cur.dir === "asc" ? "desc" : "asc" }))}
                            className="font-semibold"
                            aria-label={`Sort by ${col.label}`}
                          >
                            {col.label}
                            {sort.key === col.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.byBarangay]
                      .filter((row) => row.name.toLowerCase().includes(comparisonSearch.trim().toLowerCase()))
                      .sort((a, b) => {
                        const av = a[sort.key];
                        const bv = b[sort.key];
                        const cmp = typeof av === "string" ? av.localeCompare(bv) : (av || 0) - (bv || 0);
                        return sort.dir === "asc" ? cmp : -cmp;
                      })
                      .map((row) => (
                        <tr key={row.barangayId} className="border-b last:border-0" style={{ borderColor: COLORS.alabaster }}>
                          {COMPARISON_COLUMNS.map((col) => (
                            <td
                              key={col.key}
                              className={`py-2.5 pr-4 ${col.align === "left" ? "font-medium" : "text-right"}`}
                              style={col.align === "left" ? { color: COLORS.yale } : undefined}
                            >
                              {row[col.key] ?? 0}
                            </td>
                          ))}
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
