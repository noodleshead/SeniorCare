import { useCallback, useEffect, useState } from "react";
import { HandHeart, ClipboardList, Plus, X, Loader2, Search, FileText } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import {
  listPrograms,
  createProgram,
  updateProgram,
  listApplications,
  getApplication,
  fetchApplicationDocumentBlobUrl,
  startReview,
  endorseApplication,
  rejectApplication,
  approveApplication,
  releaseApplication,
  completeApplication,
  getOscaDetail,
  requestRevision,
} from "../../services/benefitAdminService.js";

const TABS = [
  { id: "programs", label: "Programs", icon: HandHeart },
  { id: "applications", label: "Applications", icon: ClipboardList },
];

const CATEGORY_OPTIONS = [
  { value: "AGE_BASED", label: "Age-Based Program" },
  { value: "FINANCIAL_ASSISTANCE", label: "Financial Assistance" },
  { value: "OTHER", label: "Other Assistance" },
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: "VALID_ID", label: "Valid ID" },
  { value: "SENIOR_CITIZEN_ID", label: "Senior Citizen ID" },
  { value: "PROOF_OF_RESIDENCY", label: "Proof of Residency" },
  { value: "BENEFIT_SUPPORTING_DOCUMENT", label: "Other Supporting Document" },
];

const STATUS_STYLE = {
  SUBMITTED: { label: "Submitted", color: COLORS.baltic },
  UNDER_REVIEW: { label: "Under Review", color: COLORS.baltic },
  ENDORSED: { label: "Endorsed — For OSCA Review", color: COLORS.cerulean },
  // Phase 7
  REVISION_REQUIRED: { label: "Revision Required (OSCA)", color: "#b8860b" },
  APPROVED: { label: "Approved", color: "#2f7d43" },
  RELEASED: { label: "Released", color: "#2f7d43" },
  CLAIMED: { label: "Claimed", color: "#2f7d43" },
  REJECTED: { label: "Rejected", color: "#b8452f" },
};

const STATUS_FILTERS = ["", "SUBMITTED", "UNDER_REVIEW", "ENDORSED", "REVISION_REQUIRED", "APPROVED", "RELEASED", "CLAIMED", "REJECTED"];

function formatCurrency(amount) {
  if (amount == null) return "—";
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

// ---------------- Programs tab ----------------

function ProgramFormModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      description: "",
      category: "AGE_BASED",
      minAge: "",
      maxAge: "",
      amount: "",
      requiredDocumentTypes: [],
      endDate: "",
      status: "ACTIVE",
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleDocType = (type) => {
    setForm((f) => ({
      ...f,
      requiredDocumentTypes: f.requiredDocumentTypes.includes(type)
        ? f.requiredDocumentTypes.filter((t) => t !== type)
        : [...f.requiredDocumentTypes, type],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        minAge: form.minAge === "" ? null : Number(form.minAge),
        maxAge: form.maxAge === "" ? null : Number(form.maxAge),
        amount: form.amount === "" ? null : Number(form.amount),
        requiredDocumentTypes: form.requiredDocumentTypes,
        endDate: form.endDate || null,
        status: form.status,
      };
      if (initial?._id) await updateProgram(initial._id, payload);
      else await createProgram(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "This program could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>
            {initial ? "Edit Program" : "New Benefit Program"}
          </h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Program name"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          />
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.minAge}
              onChange={(e) => setForm((f) => ({ ...f, minAge: e.target.value }))}
              placeholder="Minimum age (optional)"
              type="number"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster }}
            />
            <input
              value={form.maxAge}
              onChange={(e) => setForm((f) => ({ ...f, maxAge: e.target.value }))}
              placeholder="Maximum age (optional)"
              type="number"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>
          <input
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="Benefit amount (optional)"
            type="number"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          />
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: COLORS.cerulean }}>Required documents</p>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_TYPE_OPTIONS.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => toggleDocType(o.value)}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 border-2"
                  style={{
                    borderColor: COLORS.baltic,
                    backgroundColor: form.requiredDocumentTypes.includes(o.value) ? COLORS.baltic : "white",
                    color: form.requiredDocumentTypes.includes(o.value) ? "white" : COLORS.baltic,
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <input
            value={form.endDate ? String(form.endDate).slice(0, 10) : ""}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          />
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {error && <p className="text-sm font-semibold mt-3" style={{ color: "#b8452f" }}>{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: COLORS.baltic }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saving ? "Saving..." : "Save Program"}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md px-5 py-2.5 font-semibold border" style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramsTab({ canManage }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // program being edited, or null for new
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listPrograms().then(setPrograms).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-semibold text-white"
            style={{ backgroundColor: COLORS.yale }}
          >
            <Plus className="w-4 h-4" /> New Program
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} /></div>
      ) : programs.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No benefit programs configured yet.</p>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <div key={p._id} className="bg-white rounded-lg border p-4 flex items-start justify-between gap-4" style={{ borderColor: COLORS.alabaster }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.cerulean }}>
                  {CATEGORY_OPTIONS.find((o) => o.value === p.category)?.label || p.category} · {p.status}
                </p>
                <p className="font-bold" style={{ color: COLORS.yale }}>{p.name}</p>
                <p className="text-sm text-slate-600 mt-1 max-w-xl">{p.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {p.minAge != null && `Min age ${p.minAge}`} {p.maxAge != null && `· Max age ${p.maxAge}`} {p.amount != null && `· ${formatCurrency(p.amount)}`}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                  }}
                  className="text-sm font-semibold shrink-0"
                  style={{ color: COLORS.baltic }}
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProgramFormModal
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------- Applications tab ----------------

function RemarksActionButton({ label, color, onConfirm, requireReason }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold rounded-md px-4 py-2 border-2"
        style={{ borderColor: color, color }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-md border-2 p-3 mt-2" style={{ borderColor: color }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={requireReason ? "Reason (required)" : "Remarks (optional)"}
        rows={2}
        className="w-full rounded-md border px-2 py-1.5 text-sm mb-2"
        style={{ borderColor: COLORS.alabaster }}
      />
      {error && <p className="text-xs font-semibold mb-2" style={{ color: "#b8452f" }}>{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || (requireReason && !text.trim())}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm(text.trim());
            } catch (err) {
              setError(err.message || "This action could not be completed.");
            } finally {
              setBusy(false);
            }
          }}
          className="text-sm font-bold text-white rounded-md px-4 py-1.5 disabled:opacity-60"
          style={{ backgroundColor: color }}
        >
          {busy ? "Working..." : `Confirm ${label}`}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-sm font-semibold px-3 py-1.5" style={{ color: COLORS.yale }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const V_STATUS_LABELS = { PENDING: "Pending", VERIFIED: "Verified", REVISION_REQUIRED: "Revision Required", REJECTED: "Rejected" };
const HV_EXEC_LABELS = { PENDING: "Pending", COMPLETED: "Completed", FOLLOW_UP_REQUIRED: "Follow-up Required", UNABLE_TO_VERIFY: "Unable to Verify" };

function ApplicationDetailModal({ applicationId, currentUser, onClose, onChanged }) {
  const [application, setApplication] = useState(null);
  const [seniorContext, setSeniorContext] = useState(null); // Phase 7: Senior's barangayReview/medical, OSCA-only
  const [loading, setLoading] = useState(true);
  const [docUrls, setDocUrls] = useState({});
  const isBroadAccess = currentUser?.role === "ADMIN" || currentUser?.role === "LGU_OSCA";

  const load = useCallback(() => {
    setLoading(true);
    // OSCA (Admin/LGU-OSCA) gets the richer Phase 7 payload — Senior's
    // Barangay verification/Home Visit/Endorsement context — so the
    // final-review decision can be made without a second screen.
    // Barangay Staff keeps using the existing, unchanged getApplication.
    const fetcher = isBroadAccess ? getOscaDetail(applicationId) : getApplication(applicationId);
    Promise.resolve(fetcher)
      .then((data) => {
        if (isBroadAccess) {
          setApplication(data.application);
          setSeniorContext({ senior: data.senior, guardians: data.guardians });
        } else {
          setApplication(data);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, isBroadAccess]);
  useEffect(load, [load]);

  useEffect(() => {
    return () => {
      Object.values(docUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewDocument = async (documentId) => {
    if (docUrls[documentId]) {
      window.open(docUrls[documentId], "_blank", "noopener,noreferrer");
      return;
    }
    const url = await fetchApplicationDocumentBlobUrl(documentId);
    setDocUrls((u) => ({ ...u, [documentId]: url }));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const refreshAndNotify = () => {
    load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>Application Details</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} />
          </button>
        </div>

        {loading || !application ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Senior Citizen</p>
                <p className="text-sm font-bold" style={{ color: COLORS.yale }}>
                  {application.seniorId?.firstName} {application.seniorId?.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Senior Citizen ID</p>
                <p className="text-sm font-bold" style={{ color: COLORS.yale }}>{application.seniorId?.seniorCitizenId || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Program</p>
                <p className="text-sm font-bold" style={{ color: COLORS.yale }}>{application.benefitProgramId?.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Status</p>
                <p className="text-sm font-bold" style={{ color: (STATUS_STYLE[application.status] || {}).color }}>
                  {(STATUS_STYLE[application.status] || {}).label || application.status}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Date Applied</p>
                <p className="text-sm font-bold" style={{ color: COLORS.yale }}>{formatDate(application.createdAt)}</p>
              </div>
              {application.status === "REJECTED" && (
                <div>
                  <p className="text-xs font-semibold uppercase" style={{ color: COLORS.cerulean }}>Rejection Reason</p>
                  <p className="text-sm font-bold" style={{ color: "#b8452f" }}>{application.rejectionReason}</p>
                </div>
              )}
            </div>

            {isBroadAccess && seniorContext?.senior && !["SUBMITTED", "UNDER_REVIEW"].includes(application.status) && (
              <div className="mb-4 rounded-lg border p-3" style={{ borderColor: COLORS.alabaster, backgroundColor: "#f8fafc" }}>
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: COLORS.cerulean }}>
                  Barangay &amp; Medical Review (OSCA Context)
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Medical Verification: </span>
                    <span className="font-semibold" style={{ color: COLORS.yale }}>
                      {seniorContext.senior.hasMedicalCondition ? seniorContext.senior.medicalVerificationStatus || "—" : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Home Visit (Admin): </span>
                    <span className="font-semibold" style={{ color: COLORS.yale }}>{seniorContext.senior.homeVisitStatus || "Not required"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Barangay Verification: </span>
                    <span className="font-semibold" style={{ color: COLORS.yale }}>
                      {V_STATUS_LABELS[seniorContext.senior.barangayReview?.verificationStatus] || "Pending"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Home Visit (Barangay): </span>
                    <span className="font-semibold" style={{ color: COLORS.yale }}>
                      {HV_EXEC_LABELS[seniorContext.senior.barangayReview?.homeVisit?.status] || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Barangay Endorsement: </span>
                    <span className="font-semibold" style={{ color: COLORS.yale }}>
                      {seniorContext.senior.barangayReview?.endorsement?.decision || "Not yet endorsed"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Guardian: </span>
                    <span className="font-semibold" style={{ color: COLORS.yale }}>
                      {seniorContext.guardians?.length ? seniorContext.guardians.map((g) => `${g.firstName} ${g.lastName} (${g.relationship})`).join(", ") : "None"}
                    </span>
                  </div>
                </div>
                {seniorContext.senior.barangayReview?.endorsement?.remarks && (
                  <p className="text-xs text-slate-500 mt-2">Endorsement remarks: {seniorContext.senior.barangayReview.endorsement.remarks}</p>
                )}
              </div>
            )}

            {application.documentIds?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: COLORS.cerulean }}>Submitted Documents</p>
                <div className="flex flex-wrap gap-2">
                  {application.documentIds.map((doc) => (
                    <button
                      key={doc._id}
                      type="button"
                      onClick={() => viewDocument(doc._id)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-md border px-3 py-1.5"
                      style={{ borderColor: COLORS.alabaster, color: COLORS.baltic }}
                    >
                      <FileText className="w-4 h-4" /> {doc.fileName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4" style={{ borderColor: COLORS.alabaster }}>
              <p className="text-xs font-semibold uppercase mb-3" style={{ color: COLORS.cerulean }}>Actions</p>
              <div className="flex flex-wrap gap-3">
                {application.status === "SUBMITTED" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await startReview(application._id);
                      refreshAndNotify();
                    }}
                    className="text-sm font-semibold rounded-md px-4 py-2 border-2"
                    style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
                  >
                    Start Review
                  </button>
                )}

                {["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED"].includes(application.status) && (
                  <RemarksActionButton
                    label={application.status === "REVISION_REQUIRED" ? "Re-Endorse" : "Endorse"}
                    color="#2f7d43"
                    onConfirm={async (remarks) => {
                      await endorseApplication(application._id, remarks);
                      refreshAndNotify();
                    }}
                  />
                )}

                {["SUBMITTED", "UNDER_REVIEW"].includes(application.status) && (
                  <RemarksActionButton
                    label="Reject"
                    color="#b8452f"
                    requireReason
                    onConfirm={async (reason) => {
                      await rejectApplication(application._id, reason);
                      refreshAndNotify();
                    }}
                  />
                )}

                {application.status === "REVISION_REQUIRED" && (
                  <p className="text-sm text-slate-500 w-full">
                    OSCA returned this application. Remarks: {application.remarks || "—"}
                  </p>
                )}

                {application.status === "ENDORSED" && isBroadAccess && (
                  <RemarksActionButton
                    label="Approve (OSCA Final Decision)"
                    color="#2f7d43"
                    onConfirm={async (remarks) => {
                      await approveApplication(application._id, remarks);
                      refreshAndNotify();
                    }}
                  />
                )}
                {application.status === "ENDORSED" && isBroadAccess && (
                  <RemarksActionButton
                    label="Reject (OSCA Final Decision)"
                    color="#b8452f"
                    requireReason
                    onConfirm={async (reason) => {
                      await rejectApplication(application._id, reason);
                      refreshAndNotify();
                    }}
                  />
                )}
                {application.status === "ENDORSED" && isBroadAccess && (
                  <RemarksActionButton
                    label="Return for Revision"
                    color="#b8860b"
                    requireReason
                    onConfirm={async (reason) => {
                      await requestRevision(application._id, reason);
                      refreshAndNotify();
                    }}
                  />
                )}
                {application.status === "ENDORSED" && !isBroadAccess && (
                  <p className="text-sm text-slate-500">Awaiting OSCA review and decision.</p>
                )}

                {application.status === "APPROVED" && (
                  <RemarksActionButton
                    label="Release"
                    color={COLORS.baltic}
                    onConfirm={async (remarks) => {
                      await releaseApplication(application._id, remarks);
                      refreshAndNotify();
                    }}
                  />
                )}

                {application.status === "RELEASED" && (
                  <RemarksActionButton
                    label="Mark Claimed"
                    color="#2f7d43"
                    onConfirm={async (remarks) => {
                      await completeApplication(application._id, remarks);
                      refreshAndNotify();
                    }}
                  />
                )}

                {["CLAIMED", "REJECTED"].includes(application.status) && (
                  <p className="text-sm text-slate-500">This application has reached a final state.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ApplicationsTab({ currentUser }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    listApplications({ status: status || undefined, search: search || undefined })
      .then(setApplications)
      .finally(() => setLoading(false));
  }, [status, search]);
  useEffect(load, [load]);

  return (
    <div>
      <div className="bg-white rounded-lg border p-4 mb-6 flex flex-col sm:flex-row gap-3" style={{ borderColor: COLORS.alabaster }}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.cerulean }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search senior name or SC ID"
            className="w-full rounded-md border pl-9 pr-3 py-2.5 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border px-3 py-2.5 text-sm"
          style={{ borderColor: COLORS.alabaster }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s ? (STATUS_STYLE[s]?.label || s) : "All Statuses"}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.baltic }} /></div>
      ) : applications.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No applications found.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: COLORS.alabaster, color: COLORS.cerulean }}>
                <th className="px-4 py-3 font-semibold">Senior</th>
                <th className="px-4 py-3 font-semibold">Program</th>
                <th className="px-4 py-3 font-semibold">Applied</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => {
                const display = STATUS_STYLE[a.status] || {};
                return (
                  <tr
                    key={a._id}
                    onClick={() => setSelectedId(a._id)}
                    className="border-b last:border-0 cursor-pointer hover:bg-slate-50"
                    style={{ borderColor: COLORS.alabaster }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: COLORS.yale }}>{a.seniorId?.lastName}, {a.seniorId?.firstName}</td>
                    <td className="px-4 py-3">{a.benefitProgramId?.name}</td>
                    <td className="px-4 py-3">{formatDate(a.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: display.color }}>{display.label || a.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <ApplicationDetailModal
          applicationId={selectedId}
          currentUser={currentUser}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

export default function BenefitsManagementPage() {
  const [tab, setTab] = useState("programs");
  const currentUser = getStoredUser();
  const canManagePrograms = currentUser?.role === "ADMIN" || currentUser?.role === "LGU_OSCA";

  return (
    <DashboardLayout title="Benefits & Assistance Management" subtitle="Manage assistance programs and review Senior applications.">
      <div className="flex gap-1 border-b mb-6" style={{ borderColor: COLORS.alabaster }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px"
            style={{
              borderColor: tab === t.id ? COLORS.baltic : "transparent",
              color: tab === t.id ? COLORS.yale : "#64748b",
            }}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "programs" && <ProgramsTab canManage={canManagePrograms} />}
      {tab === "applications" && <ApplicationsTab currentUser={currentUser} />}
    </DashboardLayout>
  );
}
