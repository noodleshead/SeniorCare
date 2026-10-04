import { useCallback, useEffect, useState } from "react";
import { Search, X, Loader2, AlertCircle, HeartHandshake, Home, CheckCircle2 } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import { listQueue, getSummary, getDetail, recordVerification, recordHomeVisit, recordEndorsement } from "../../services/barangayEndorsementService.js";

const V_STATUS_LABELS = { PENDING: "Pending Verification", VERIFIED: "Verified", REVISION_REQUIRED: "Revision Required", REJECTED: "Rejected" };
const V_STATUS_COLORS = { PENDING: COLORS.baltic, VERIFIED: "#2f7d43", REVISION_REQUIRED: "#b8860b", REJECTED: "#b8452f" };
const HV_EXEC_LABELS = { PENDING: "Pending", COMPLETED: "Completed", FOLLOW_UP_REQUIRED: "Follow-up Required", UNABLE_TO_VERIFY: "Unable to Verify" };
const HV_RESULT_LABELS = { VERIFIED: "Verified", NEEDS_FOLLOW_UP: "Needs Follow-up", UNABLE_TO_VERIFY: "Unable to Verify", NOT_AVAILABLE: "Not Available", OTHER: "Other" };

function Badge({ color, children }) {
  return (
    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: color + "1a" }}>
      {children}
    </span>
  );
}
function Row({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase mb-0.5">{label}</p>
      <div className="text-sm text-slate-700">{children ?? "—"}</div>
    </div>
  );
}
function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: COLORS.alabaster }}>
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold" style={{ color: color || COLORS.yale }}>{value}</p>
    </div>
  );
}

function VerificationForm({ senior, onSaved, onError }) {
  const [decision, setDecision] = useState("VERIFIED");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (decision !== "VERIFIED" && !remarks.trim()) {
      setError(decision === "REJECTED" ? "Please provide a reason for rejecting." : "Please provide remarks for the requested revision.");
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const updated = await recordVerification(senior._id, { decision, remarks: remarks.trim() || undefined });
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Unable to save this decision.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold" style={{ color: COLORS.yale }}>Barangay Verification</h4>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        {["VERIFIED", "REVISION_REQUIRED", "REJECTED"].map((d) => (
          <button key={d} type="button" onClick={() => setDecision(d)} className="px-3 py-2 rounded-md text-sm font-semibold border"
            style={{ borderColor: decision === d ? COLORS.baltic : COLORS.alabaster, backgroundColor: decision === d ? COLORS.baltic + "1a" : "transparent", color: decision === d ? COLORS.baltic : COLORS.yale }}>
            {d === "VERIFIED" ? "Verify / For Endorsement" : d === "REVISION_REQUIRED" ? "Needs Revision" : "Reject"}
          </button>
        ))}
      </div>
      {decision !== "VERIFIED" && (
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Remarks (required)"
          className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: COLORS.alabaster }} />
      )}
      <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60 flex items-center gap-2" style={{ backgroundColor: COLORS.baltic }}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
      </button>
    </form>
  );
}

function HomeVisitForm({ senior, onSaved, onError }) {
  const existing = senior.barangayReview?.homeVisit;
  const [result, setResult] = useState(existing?.result || "VERIFIED");
  const [findings, setFindings] = useState(existing?.findings || "");
  const [followUpRequired, setFollowUpRequired] = useState(Boolean(existing?.followUpRequired));
  const [followUpRemarks, setFollowUpRemarks] = useState(existing?.followUpRemarks || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isCompleted = existing?.status === "COMPLETED";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!findings.trim()) { setError("Please record your findings from the visit."); return; }
    if (followUpRequired && !followUpRemarks.trim()) { setError("Please provide follow-up remarks."); return; }
    setSaving(true);
    onError(null);
    try {
      const updated = await recordHomeVisit(senior._id, { result, findings: findings.trim(), followUpRequired, followUpRemarks: followUpRemarks.trim() || undefined });
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Unable to save this Home Visit record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: COLORS.yale }}><Home className="w-4 h-4" /> Home Visit</h4>
      {isCompleted ? (
        <p className="text-sm text-slate-500">This visit is marked completed. Findings: {existing.findings}</p>
      ) : (
        <>
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Visit Result *</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              {Object.entries(HV_RESULT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Findings / Remarks *</label>
            <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} placeholder="Actual living situation, whether found at the registered address, relevant findings..."
              className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: COLORS.alabaster }} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.yale }}>
            <input type="checkbox" checked={followUpRequired} onChange={(e) => setFollowUpRequired(e.target.checked)} className="w-4 h-4" />
            Follow-up required
          </label>
          {followUpRequired && (
            <textarea value={followUpRemarks} onChange={(e) => setFollowUpRemarks(e.target.value)} rows={2} placeholder="Follow-up remarks (required)"
              className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: COLORS.alabaster }} />
          )}
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60 flex items-center gap-2" style={{ backgroundColor: COLORS.baltic }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Visit Record
          </button>
        </>
      )}
    </form>
  );
}

function EndorsementForm({ senior, onSaved, onError }) {
  const [decision, setDecision] = useState("ENDORSED");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (decision === "NOT_ENDORSED" && !remarks.trim()) { setError("Please provide a reason for not endorsing."); return; }
    setSaving(true);
    onError(null);
    try {
      const updated = await recordEndorsement(senior._id, { decision, remarks: remarks.trim() || undefined });
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Unable to save the endorsement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: COLORS.yale }}><HeartHandshake className="w-4 h-4" /> Barangay Endorsement</h4>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        {["ENDORSED", "NOT_ENDORSED"].map((d) => (
          <button key={d} type="button" onClick={() => setDecision(d)} className="px-3 py-2 rounded-md text-sm font-semibold border"
            style={{ borderColor: decision === d ? COLORS.baltic : COLORS.alabaster, backgroundColor: decision === d ? COLORS.baltic + "1a" : "transparent", color: decision === d ? COLORS.baltic : COLORS.yale }}>
            {d === "ENDORSED" ? "Endorsed" : "Not Endorsed"}
          </button>
        ))}
      </div>
      {decision === "NOT_ENDORSED" && (
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Reason (required)"
          className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: COLORS.alabaster }} />
      )}
      <p className="text-xs text-slate-500">This forwards the Senior's case toward final OSCA review. It does not approve any benefit.</p>
      <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60 flex items-center gap-2" style={{ backgroundColor: COLORS.baltic }}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Endorsement
      </button>
    </form>
  );
}

function DetailDrawer({ seniorId, onClose, onChanged }) {
  const me = getStoredUser();
  const canAct = me?.role === "BARANGAY_STAFF";
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getDetail(seniorId).then(setDetail).catch((e) => setError(e.message || "Unable to load this record.")).finally(() => setLoading(false));
  }, [seniorId]);
  useEffect(load, [load]);

  const senior = detail?.senior;
  const review = senior?.barangayReview;
  const vStatus = review?.verificationStatus || "PENDING";
  const homeVisitRequired = senior?.homeVisitStatus === "REQUIRED";
  const homeVisitCompleted = review?.homeVisit?.status === "COMPLETED";
  const canShowHomeVisit = vStatus === "VERIFIED" && homeVisitRequired;
  const canShowEndorsement = vStatus === "VERIFIED" && (!homeVisitRequired || homeVisitCompleted) && !review?.endorsement?.decision;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: COLORS.yale }}>Barangay Review</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : !senior ? null : (
          <div className="space-y-5">
            <div className="space-y-3">
              <Row label="Senior">{senior.firstName} {senior.lastName}</Row>
              <Row label="Senior Citizen ID">{senior.seniorCitizenId}</Row>
              <Row label="Birth Date / Age">{senior.dateOfBirth ? new Date(senior.dateOfBirth).toLocaleDateString() : "—"}{senior.age != null ? ` (${senior.age} y/o)` : ""}</Row>
              <Row label="Sex / Civil Status">{senior.sex} / {senior.civilStatus}</Row>
              <Row label="Contact">{senior.mobileNumber}</Row>
              <Row label="Address">{senior.address ? [senior.address.houseLotBlock, senior.address.street, senior.address.municipality, senior.address.province, senior.address.postalCode].filter(Boolean).join(", ") : null}</Row>
              <Row label="Barangay">{senior.barangayId?.name}</Row>
            </div>

            {detail.guardians?.length > 0 && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <Row label="Guardian / Authorized Representative">
                  {detail.guardians.map((g) => (
                    <div key={g._id}>{g.firstName} {g.lastName} — {g.relationship} {g.authorizationConfirmed ? "(Authorized)" : "(Pending authorization)"}</div>
                  ))}
                </Row>
              </>
            )}

            <hr style={{ borderColor: COLORS.alabaster }} />
            <Row label="Barangay Verification Status"><Badge color={V_STATUS_COLORS[vStatus]}>{V_STATUS_LABELS[vStatus]}</Badge></Row>
            {review?.verificationRemarks && <Row label="Verification Remarks">{review.verificationRemarks}</Row>}

            {homeVisitRequired && (
              <Row label="Home Visit (Admin Required)">
                <Badge color={homeVisitCompleted ? "#2f7d43" : COLORS.baltic}>{review?.homeVisit?.status ? HV_EXEC_LABELS[review.homeVisit.status] : "Pending"}</Badge>
              </Row>
            )}

            {review?.endorsement?.decision && (
              <Row label="Endorsement">
                <Badge color={review.endorsement.decision === "ENDORSED" ? "#2f7d43" : "#b8452f"}>{review.endorsement.decision === "ENDORSED" ? "Endorsed" : "Not Endorsed"}</Badge>
                {review.endorsement.remarks && <p className="mt-1 text-slate-600">{review.endorsement.remarks}</p>}
              </Row>
            )}

            {!canAct && <p className="text-xs text-slate-500">Read-only — only Barangay Staff may record decisions here.</p>}

            {canAct && vStatus !== "VERIFIED" && vStatus !== "REJECTED" && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <VerificationForm senior={senior} onError={setError} onSaved={() => { load(); onChanged(); }} />
              </>
            )}

            {canAct && canShowHomeVisit && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <HomeVisitForm senior={senior} onError={setError} onSaved={() => { load(); onChanged(); }} />
              </>
            )}

            {canAct && canShowEndorsement && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <EndorsementForm senior={senior} onError={setError} onSaved={() => { load(); onChanged(); }} />
              </>
            )}

            {review?.readyForOscaReview && (
              <div className="rounded-md border p-3 flex items-center gap-2" style={{ borderColor: "#2f7d43", backgroundColor: "#2f7d4312" }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: "#2f7d43" }} />
                <p className="text-sm font-semibold" style={{ color: "#2f7d43" }}>Ready for OSCA Review</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BarangayEndorsementPage() {
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", homeVisit: "" });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const me = getStoredUser();

  useEffect(() => {
    if (me?.role === "BARANGAY_STAFF") getSummary().then(setSummary).catch(() => setSummary(null));
  }, [me?.role]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listQueue({ ...filters, page, pageSize: 20 })
      .then(({ items: rows, pagination: p }) => { setItems(rows); setPagination(p); })
      .catch((e) => setError(e.message || "Unable to load the Barangay queue."))
      .finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(load, [load]);

  const setFilter = (key, value) => { setPage(1); setFilters((f) => ({ ...f, [key]: value })); };

  return (
    <DashboardLayout title="Barangay Endorsement" subtitle="Initial verification, Home Visit, and endorsement for Seniors in your Barangay.">
      {summary && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard label="Pending Verification" value={summary.pendingVerification} />
          <SummaryCard label="Home Visits Required" value={summary.homeVisitsRequired} color={COLORS.cerulean} />
          <SummaryCard label="Home Visits Pending" value={summary.homeVisitsPending} color="#b8860b" />
          <SummaryCard label="Home Visits Completed" value={summary.homeVisitsCompleted} color="#2f7d43" />
          <SummaryCard label="For Endorsement" value={summary.forEndorsement} color={COLORS.baltic} />
          <SummaryCard label="Endorsed" value={summary.endorsed} color="#2f7d43" />
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: COLORS.alabaster }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name or Senior Citizen ID" className="w-full border rounded-md pl-8 pr-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Verification Status</label>
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              {Object.entries(V_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Home Visit</label>
            <select value={filters.homeVisit} onChange={(e) => setFilter("homeVisit", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="REQUIRED_PENDING">Required — Pending/Follow-up</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.alabaster }}>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <HeartHandshake className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No Seniors match the selected search and filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                  <th className="py-3 px-4 font-semibold">Senior</th>
                  <th className="py-3 px-4 font-semibold">Senior ID</th>
                  <th className="py-3 px-4 font-semibold">Barangay</th>
                  <th className="py-3 px-4 font-semibold">Verification</th>
                  <th className="py-3 px-4 font-semibold">Home Visit</th>
                  <th className="py-3 px-4 font-semibold">Endorsement</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id} onClick={() => setSelectedId(s._id)} className="border-b last:border-0 cursor-pointer hover:bg-slate-50" style={{ borderColor: COLORS.alabaster }}>
                    <td className="py-2.5 px-4 font-medium" style={{ color: COLORS.yale }}>{s.firstName} {s.lastName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{s.seniorCitizenId || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-500">{s.barangayId?.name || "—"}</td>
                    <td className="py-2.5 px-4"><Badge color={V_STATUS_COLORS[s.barangayVerificationStatus]}>{V_STATUS_LABELS[s.barangayVerificationStatus]}</Badge></td>
                    <td className="py-2.5 px-4 text-slate-500">{s.homeVisitRequired ? (HV_EXEC_LABELS[s.homeVisitExecutionStatus] || "Pending") : "Not required"}</td>
                    <td className="py-2.5 px-4 text-slate-500">{s.endorsementDecision ? (s.endorsementDecision === "ENDORSED" ? "Endorsed" : "Not Endorsed") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm" style={{ borderColor: COLORS.alabaster }}>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>Previous</button>
            <span className="text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} Seniors)</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>Next</button>
          </div>
        )}
      </div>

      {selectedId && <DetailDrawer seniorId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </DashboardLayout>
  );
}
