import { useCallback, useEffect, useState } from "react";
import { Search, X, Loader2, AlertCircle, FileText, Stethoscope } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { listMedicalVerifications, getMedicalVerification, recordMedicalVerificationDecision } from "../../services/medicalVerificationService.js";
import { fetchDocumentBlobUrl } from "../../services/verificationService.js";

const STATUS_LABELS = { PENDING: "Pending Verification", VERIFIED: "Verified", REJECTED: "Rejected", REVISION_REQUIRED: "Revision Required" };
const STATUS_COLORS = { PENDING: COLORS.baltic, VERIFIED: "#2f7d43", REJECTED: "#b8452f", REVISION_REQUIRED: "#b8860b" };
const CLASS_LABELS = { CRITICAL: "Critical", NON_CRITICAL: "Non-Critical" };
const PRIORITY_LABELS = { HIGH: "High", NORMAL: "Normal" };
const HOME_VISIT_LABELS = { NOT_REQUIRED: "No", PENDING_DECISION: "Not Decided", REQUIRED: "Yes" };

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

function DecisionForm({ senior, illness, onSaved, onError }) {
  const systemClassification = illness?.classification || null;
  const systemPriority = illness?.priorityLevel || null;

  const [decision, setDecision] = useState("VERIFIED");
  const [classification, setClassification] = useState(systemClassification || "");
  const [priorityLevel, setPriorityLevel] = useState(systemPriority || "");
  const [overrideReason, setOverrideReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [homeVisitRequired, setHomeVisitRequired] = useState(null); // null = not chosen
  const [homeVisitRemarks, setHomeVisitRemarks] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isOverridden =
    decision === "VERIFIED" &&
    ((systemClassification && classification !== systemClassification) || (systemPriority && priorityLevel !== systemPriority));
  const isCriticalOrHigh = decision === "VERIFIED" && (classification === "CRITICAL" || priorityLevel === "HIGH");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (decision === "VERIFIED") {
      if (!classification) nextErrors.classification = "Please confirm or select a classification.";
      if (!priorityLevel) nextErrors.priorityLevel = "Please confirm or select a priority.";
      if (isOverridden && !overrideReason.trim()) nextErrors.overrideReason = "Please explain the override.";
      if (isCriticalOrHigh) {
        if (homeVisitRequired === null) nextErrors.homeVisitRequired = "Please decide Yes or No.";
        if (!homeVisitRemarks.trim()) nextErrors.homeVisitRemarks = "Remarks are required for Critical/High Priority cases.";
      }
    } else if (!remarks.trim()) {
      nextErrors.remarks = decision === "REJECTED" ? "Please provide a reason for rejecting this submission." : "Please provide a remark for the requested revision.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    onError(null);
    try {
      const payload = { decision };
      if (decision === "VERIFIED") {
        Object.assign(payload, {
          classification,
          priorityLevel,
          overrideReason: isOverridden ? overrideReason.trim() : undefined,
          remarks: remarks.trim() || undefined,
          homeVisitRequired: homeVisitRequired === null ? undefined : homeVisitRequired,
          homeVisitRemarks: homeVisitRemarks.trim() || undefined,
        });
      } else {
        payload.remarks = remarks.trim();
      }
      const updated = await recordMedicalVerificationDecision(senior._id, payload);
      onSaved(updated);
    } catch (err) {
      onError(err.message || "Unable to save this decision.");
      setErrors((prev) => ({ ...prev, ...(err.fieldErrors || {}) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">System-Generated (from Illness Database)</p>
        <div className="flex gap-2">
          <Badge color={systemClassification === "CRITICAL" ? "#b8452f" : COLORS.cerulean}>{CLASS_LABELS[systemClassification] || "Not set"}</Badge>
          <Badge color={systemPriority === "HIGH" ? "#b8452f" : "#64748b"}>{PRIORITY_LABELS[systemPriority] || "Not set"}</Badge>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>Decision *</label>
        <div className="flex gap-2 flex-wrap">
          {["VERIFIED", "REVISION_REQUIRED", "REJECTED"].map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDecision(d)}
              className="px-3 py-2 rounded-md text-sm font-semibold border"
              style={{ borderColor: decision === d ? COLORS.baltic : COLORS.alabaster, backgroundColor: decision === d ? COLORS.baltic + "1a" : "transparent", color: decision === d ? COLORS.baltic : COLORS.yale }}
            >
              {d === "VERIFIED" ? "Verify" : d === "REVISION_REQUIRED" ? "Request Revision" : "Reject"}
            </button>
          ))}
        </div>
      </div>

      {decision === "VERIFIED" ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>Classification *</label>
              <select value={classification} onChange={(e) => setClassification(e.target.value)} className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: errors.classification ? "#b8452f" : COLORS.alabaster }}>
                <option value="">Select</option>
                <option value="CRITICAL">Critical</option>
                <option value="NON_CRITICAL">Non-Critical</option>
              </select>
              {errors.classification && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.classification}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>Priority *</label>
              <select value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value)} className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: errors.priorityLevel ? "#b8452f" : COLORS.alabaster }}>
                <option value="">Select</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
              </select>
              {errors.priorityLevel && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.priorityLevel}</p>}
            </div>
          </div>

          {isOverridden && (
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>Override Reason *</label>
              <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: errors.overrideReason ? "#b8452f" : COLORS.alabaster }} placeholder="Explain why the classification/priority differs from the system-generated value." />
              {errors.overrideReason && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.overrideReason}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>Remarks (optional)</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: COLORS.alabaster }} />
          </div>

          <div className="rounded-md border p-3" style={{ borderColor: isCriticalOrHigh ? "#e3a893" : COLORS.alabaster, backgroundColor: isCriticalOrHigh ? "#fff8f5" : "transparent" }}>
            <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>
              Home Visit Required?{isCriticalOrHigh ? " *" : ""}
            </label>
            <div className="flex gap-2 mb-2">
              {[["Yes", true], ["No", false]].map(([label, val]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => setHomeVisitRequired(val)}
                  className="px-3 py-2 rounded-md text-sm font-semibold border"
                  style={{ borderColor: homeVisitRequired === val ? COLORS.baltic : COLORS.alabaster, backgroundColor: homeVisitRequired === val ? COLORS.baltic + "1a" : "transparent", color: homeVisitRequired === val ? COLORS.baltic : COLORS.yale }}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.homeVisitRequired && <p className="text-xs mb-2" style={{ color: "#b8452f" }}>{errors.homeVisitRequired}</p>}
            <textarea
              value={homeVisitRemarks}
              onChange={(e) => setHomeVisitRemarks(e.target.value)}
              rows={2}
              placeholder="Home Visit remarks"
              className="w-full rounded-md border px-3 py-2.5 text-sm"
              style={{ borderColor: errors.homeVisitRemarks ? "#b8452f" : COLORS.alabaster }}
            />
            {errors.homeVisitRemarks && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.homeVisitRemarks}</p>}
            {isCriticalOrHigh && <p className="text-xs text-slate-500 mt-1">Required for Critical classification or High priority cases.</p>}
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.yale }}>
            {decision === "REJECTED" ? "Reason for Rejection *" : "Revision Remarks *"}
          </label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2.5 text-sm" style={{ borderColor: errors.remarks ? "#b8452f" : COLORS.alabaster }} />
          {errors.remarks && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{errors.remarks}</p>}
        </div>
      )}

      <button type="submit" disabled={saving} className="w-full px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.baltic }}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Decision
      </button>
    </form>
  );
}

function DetailDrawer({ seniorId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docUrl, setDocUrl] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMedicalVerification(seniorId)
      .then(setDetail)
      .catch((e) => setError(e.message || "Unable to load this record."))
      .finally(() => setLoading(false));
  }, [seniorId]);
  useEffect(load, [load]);

  const openDocument = async () => {
    if (!detail?.document) return;
    setDocLoading(true);
    try {
      const url = await fetchDocumentBlobUrl(detail.document._id);
      setDocUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message || "Unable to open the supporting document.");
    } finally {
      setDocLoading(false);
    }
  };
  useEffect(() => () => docUrl && URL.revokeObjectURL(docUrl), [docUrl]);

  const senior = detail?.senior;
  const isFinal = senior && ["VERIFIED", "REJECTED"].includes(senior.medicalVerificationStatus);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: COLORS.yale }}>Medical Verification</h3>
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
              <Row label="Barangay">{senior.barangayId?.name}</Row>
              <Row label="Date of Birth / Age">{senior.dateOfBirth ? new Date(senior.dateOfBirth).toLocaleDateString() : "—"}{senior.age != null ? ` (${senior.age} y/o)` : ""}</Row>
            </div>

            <hr style={{ borderColor: COLORS.alabaster }} />

            <div className="space-y-3">
              <Row label="Submitted Condition">{senior.medicalConditionId?.name}</Row>
              <Row label="Verification Status">
                <Badge color={STATUS_COLORS[senior.medicalVerificationStatus]}>{STATUS_LABELS[senior.medicalVerificationStatus]}</Badge>
              </Row>
              <Row label="Supporting Document">
                {detail.document ? (
                  <button type="button" onClick={openDocument} disabled={docLoading} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: COLORS.baltic }}>
                    {docLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {detail.document.originalName || "View document"}
                  </button>
                ) : "No document on file"}
              </Row>
            </div>

            {isFinal && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <div className="space-y-3">
                  <Row label="Final Classification">{senior.medicalClassification ? CLASS_LABELS[senior.medicalClassification] : "—"}</Row>
                  <Row label="Final Priority">{senior.medicalPriorityLevel ? PRIORITY_LABELS[senior.medicalPriorityLevel] : "—"}</Row>
                  <Row label="Admin Remarks">{senior.medicalVerificationRemarks}</Row>
                  <Row label="Home Visit">{senior.homeVisitStatus ? HOME_VISIT_LABELS[senior.homeVisitStatus] : "—"}</Row>
                  {senior.homeVisitRemarks && <Row label="Home Visit Remarks">{senior.homeVisitRemarks}</Row>}
                </div>
              </>
            )}

            {!isFinal && (
              <>
                <hr style={{ borderColor: COLORS.alabaster }} />
                <DecisionForm
                  senior={senior}
                  illness={senior.medicalConditionId}
                  onError={setError}
                  onSaved={() => {
                    load();
                    onChanged();
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MedicalVerificationPage() {
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", classification: "", priority: "", homeVisit: "" });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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
    listMedicalVerifications({ ...filters, page, pageSize: 20 })
      .then(({ items: rows, pagination: p }) => {
        setItems(rows);
        setPagination(p);
      })
      .catch((e) => setError(e.message || "Unable to load medical verification records."))
      .finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(load, [load]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <DashboardLayout title="Medical Verification" subtitle="Review Seniors' submitted medical conditions and decide on Home Visit needs.">
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
            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Classification</label>
            <select value={filters.classification} onChange={(e) => setFilter("classification", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="NON_CRITICAL">Non-Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
            <select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Home Visit</label>
            <select value={filters.homeVisit} onChange={(e) => setFilter("homeVisit", e.target.value)} className="border rounded-md px-3 py-2 text-sm" style={{ borderColor: COLORS.alabaster }}>
              <option value="">All</option>
              <option value="NOT_DECIDED">Not Decided</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
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
            <Stethoscope className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No medical submissions match the selected search and filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b" style={{ borderColor: COLORS.alabaster }}>
                  <th className="py-3 px-4 font-semibold">Senior</th>
                  <th className="py-3 px-4 font-semibold">Senior ID</th>
                  <th className="py-3 px-4 font-semibold">Condition</th>
                  <th className="py-3 px-4 font-semibold">Classification</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Home Visit</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id} onClick={() => setSelectedId(s._id)} className="border-b last:border-0 cursor-pointer hover:bg-slate-50" style={{ borderColor: COLORS.alabaster }}>
                    <td className="py-2.5 px-4 font-medium" style={{ color: COLORS.yale }}>{s.firstName} {s.lastName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{s.seniorCitizenId || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600">{s.medicalConditionId?.name || "—"}</td>
                    <td className="py-2.5 px-4">{s.medicalClassification ? <Badge color={s.medicalClassification === "CRITICAL" ? "#b8452f" : COLORS.cerulean}>{CLASS_LABELS[s.medicalClassification]}</Badge> : "—"}</td>
                    <td className="py-2.5 px-4">{s.medicalPriorityLevel ? <Badge color={s.medicalPriorityLevel === "HIGH" ? "#b8452f" : "#64748b"}>{PRIORITY_LABELS[s.medicalPriorityLevel]}</Badge> : "—"}</td>
                    <td className="py-2.5 px-4"><Badge color={STATUS_COLORS[s.medicalVerificationStatus]}>{STATUS_LABELS[s.medicalVerificationStatus]}</Badge></td>
                    <td className="py-2.5 px-4 text-slate-500">{s.homeVisitStatus ? HOME_VISIT_LABELS[s.homeVisitStatus] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm" style={{ borderColor: COLORS.alabaster }}>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>Previous</button>
            <span className="text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="font-semibold disabled:opacity-40" style={{ color: COLORS.cerulean }}>Next</button>
          </div>
        )}
      </div>

      {selectedId && <DetailDrawer seniorId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </DashboardLayout>
  );
}
