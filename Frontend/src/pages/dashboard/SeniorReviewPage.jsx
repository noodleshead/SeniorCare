import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Phone,
  HeartPulse,
  UsersRound,
  ExternalLink,
  X,
  KeyRound,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import {
  getVerificationDetail,
  approveVerification,
  rejectVerification,
  fetchDocumentBlobUrl,
  createGuardianAccount,
  resetGuardianPassword,
} from "../../services/verificationService.js";

function GuardianAccountAction({ guardian, verificationStatus, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState(guardian.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [resultAction, setResultAction] = useState(null); // "created" | "reset"
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);

  // IMPORTANT: this check must come BEFORE the `guardian.userId` check
  // below. handleCreate() calls onCreated(), which makes the parent page
  // refetch its data — that refetch brings back a `guardian` prop that
  // now HAS a userId, which would otherwise make the "already has a
  // login account" message win and hide the just-generated temporary
  // password the moment the refresh lands (often before the person even
  // sees it). Once this component has its own `result` from an action it
  // just performed, that always takes priority over whatever the parent
  // re-fetched.
  if (result) {
    return (
      <div className="mt-3 rounded-lg border-2 p-3 text-sm" style={{ borderColor: "#2f7d43", backgroundColor: "#2f7d4310" }}>
        <p className="font-bold" style={{ color: "#2f7d43" }}>
          {resultAction === "reset" ? "Guardian password reset." : "Guardian login created."}
        </p>
        <p className="mt-1" style={{ color: COLORS.yale }}>
          Email: <strong>{result.user?.email}</strong>
        </p>
        {result.temporaryPassword && (
          <p style={{ color: COLORS.yale }}>
            {resultAction === "reset" ? "New temporary password" : "Temporary password"}: <strong>{result.temporaryPassword}</strong>
          </p>
        )}
        <p className="text-slate-600 mt-1">Share these credentials with the Guardian directly and securely. This password will not be shown again.</p>
      </div>
    );
  }

  const handleReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const reset = await resetGuardianPassword(guardian._id);
      setResult(reset);
      setResultAction("reset");
    } catch (err) {
      setResetError(err.message || "Unable to reset the Guardian's password. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  // As of the registration-based Guardian flow, guardian.userId is set
  // during Senior Registration itself (see registration.service.js) —
  // Admin no longer creates this account. guardian.userId now comes back
  // populated ({ _id, status, email }, see verification.service.js's
  // getVerificationById) so we can show its actual status here instead
  // of just "has an account".
  if (guardian.userId) {
    const accountStatus = guardian.userId.status;
    const isActive = accountStatus === "ACTIVE";
    return (
      <div className="mt-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: isActive ? "#2f7d43" : COLORS.yale }}>
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          {isActive ? "Guardian Account — Active" : "Guardian Account Created — Pending Verification"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {isActive
            ? "This Guardian can log in and access their Guardian Dashboard."
            : "Created automatically during registration. It becomes active once this registration is approved."}
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm border-2 disabled:opacity-50"
          style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
        >
          {resetting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Reset Password
        </button>
        <p className="text-xs text-slate-500 mt-1">
          Use this if the original temporary password was lost before it could be shared with the Guardian.
        </p>
        {resetError && <p className="text-sm text-red-600 mt-2">{resetError}</p>}
      </div>
    );
  }

  // Fallback path — only reachable for Guardian records that predate the
  // registration-based flow and were never given a login account. Every
  // Guardian registered going forward already has guardian.userId set
  // above, so this button is not part of the normal workflow anymore.
  if (verificationStatus !== "APPROVED") {
    return (
      <p className="text-sm text-slate-500 mt-2">
        A Guardian login can be created once this registration is approved — approving confirms the Guardian's
        submitted authorization documents.
      </p>
    );
  }

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createGuardianAccount(guardian._id, { email });
      setResult(created);
      setResultAction("created");
      onCreated?.();
    } catch (err) {
      setError(err.message || "Unable to create the Guardian's login. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500 mb-2">
        This Guardian record has no login account yet, which is unusual for a registration submitted after this
        workflow changed — new registrations create the account automatically. Use this only to manually
        provision one for an older record.
      </p>
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm text-white"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          Create Guardian Login
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Guardian's email"
            className="px-3 py-2 rounded-md border-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          />
          <button
            type="button"
            disabled={saving || !email.trim()}
            onClick={handleCreate}
            className="px-3 py-2 rounded-md font-bold text-sm text-white disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: COLORS.baltic }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Create Login
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

const DOCUMENT_LABELS = {
  VALID_ID: "Valid Identification",
  SENIOR_CITIZEN_ID: "Senior Citizen ID",
  PROOF_OF_RESIDENCY: "Proof of Residency",
  GUARDIAN_ID: "Guardian Identification",
  AUTHORIZATION_DOCUMENT: "Guardian Authorization Document",
};

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: COLORS.alabaster }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: COLORS.baltic }} aria-hidden="true" />
        <h2 className="text-[15px] font-bold" style={{ color: COLORS.yale }}>
          {title}
        </h2>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-[15px]" style={{ color: COLORS.yale }}>
        {value || value === 0 ? value : "—"}
      </dd>
    </div>
  );
}

function DocumentRow({ doc }) {
  const [opening, setOpening] = useState(false);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const url = await fetchDocumentBlobUrl(doc._id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Silently no-op on failure to open; the row stays clickable to retry.
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-0" style={{ borderColor: COLORS.alabaster }}>
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: COLORS.sky + "33" }}
        >
          <FileText className="w-4 h-4" style={{ color: COLORS.yale }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate" style={{ color: COLORS.yale }}>
            {DOCUMENT_LABELS[doc.documentType] || doc.documentType}
          </p>
          <p className="text-xs text-slate-500 truncate">{doc.fileName}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-md border shrink-0 disabled:opacity-60"
        style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
      >
        {opening ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="w-4 h-4" aria-hidden="true" />}
        View
      </button>
    </div>
  );
}

function ConfirmDialog({ variant, onCancel, onConfirm, submitting }) {
  const [reason, setReason] = useState("");
  const isReject = variant === "reject";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onCancel} aria-hidden="true" />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold mb-2" style={{ color: COLORS.yale }}>
          {isReject ? "Reject Registration" : "Approve this senior citizen registration?"}
        </h3>

        {!isReject && (
          <p className="text-[15px] text-slate-600 mb-4 leading-relaxed">
            Once approved, this account will become <strong>ACTIVE</strong> and the senior citizen will be allowed
            to log in.
          </p>
        )}

        {isReject && (
          <div className="mb-4">
            <label htmlFor="reject-reason" className="block text-sm font-semibold mb-1.5" style={{ color: COLORS.yale }}>
              Reason for rejection <span style={{ color: "#b8452f" }}>*</span>
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3.5 py-2.5 text-[15px] focus:outline-none resize-none"
              style={{ borderColor: COLORS.alabaster }}
              placeholder="Explain why this registration is being rejected..."
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 text-center text-[15px] font-semibold px-5 py-2.5 rounded-md border-2 disabled:opacity-60"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || (isReject && !reason.trim())}
            onClick={() => onConfirm(reason.trim())}
            className="flex-1 inline-flex items-center justify-center gap-2 text-center text-[15px] font-semibold px-5 py-2.5 rounded-md text-white disabled:opacity-60"
            style={{ backgroundColor: isReject ? "#b8452f" : COLORS.baltic }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {isReject ? "Reject Registration" : "Approve Registration"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SeniorReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dialog, setDialog] = useState(null); // "approve" | "reject" | null
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVerificationDetail(id);
      setDetail(data);
    } catch (err) {
      setError(err.message || "Unable to load this registration.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (reasonText) => {
    setSubmitting(true);
    setActionError(null);
    try {
      if (dialog === "approve") {
        await approveVerification(id, {});
        setSuccessMessage("Registration approved successfully. The senior citizen account is now active.");
      } else {
        await rejectVerification(id, { reason: reasonText });
        setSuccessMessage("Registration rejected successfully.");
      }
      setDialog(null);
      await load();
    } catch (err) {
      setActionError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const senior = detail?.seniorId;
  const guardian = detail?.guardian;
  const documents = detail?.documents || [];
  const isPending = detail?.status === "PENDING";

  return (
    <DashboardLayout>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold mb-5"
        style={{ color: COLORS.baltic }}
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Verification Dashboard
      </button>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mb-3" style={{ color: COLORS.baltic }} aria-hidden="true" />
          <p className="text-[15px]">Loading registration...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg border p-10 flex flex-col items-center text-center" style={{ borderColor: COLORS.alabaster }}>
          <AlertCircle className="w-8 h-8 mb-3" style={{ color: "#b8452f" }} aria-hidden="true" />
          <p className="text-[15px] font-semibold mb-1" style={{ color: COLORS.yale }}>
            Unable to load this registration.
          </p>
          <p className="text-sm text-slate-500 mb-4">Please try again.</p>
          <button
            type="button"
            onClick={load}
            className="text-[15px] font-semibold px-5 py-2.5 rounded-md text-white"
            style={{ backgroundColor: COLORS.baltic }}
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-5 max-w-4xl">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: COLORS.yale }}>
              {senior?.firstName} {senior?.middleName} {senior?.lastName} {senior?.suffix}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {detail?.barangayId?.name} · Submitted {formatDate(detail?.createdAt)}
            </p>
          </div>

          {successMessage && (
            <div
              role="status"
              className="rounded-md border p-4 flex items-start gap-3"
              style={{ backgroundColor: "#eaf7ee", borderColor: "#2f9e5f" }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#2f9e5f" }} aria-hidden="true" />
              <p className="text-sm leading-relaxed" style={{ color: "#1e5f3a" }}>
                {successMessage}
              </p>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="rounded-md border p-4 flex items-start gap-3"
              style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893" }}
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#b8452f" }} aria-hidden="true" />
              <p className="text-sm leading-relaxed" style={{ color: "#7a2e1c" }}>
                {actionError}
              </p>
            </div>
          )}

          {!isPending && !successMessage && (
            <div
              className="rounded-md border p-4 text-sm"
              style={{ backgroundColor: "#f1f1ee", borderColor: COLORS.alabaster, color: COLORS.yale }}
            >
              This registration has already been reviewed. Status: <strong>{detail?.status}</strong>
            </div>
          )}

          <Section icon={User} title="Personal Information">
            <Field label="First Name" value={senior?.firstName} />
            <Field label="Middle Name" value={senior?.middleName} />
            <Field label="Last Name" value={senior?.lastName} />
            <Field label="Suffix" value={senior?.suffix} />
            <Field label="Date of Birth" value={formatDate(senior?.dateOfBirth)} />
            <Field label="Age" value={calculateAge(senior?.dateOfBirth)} />
            <Field label="Sex" value={senior?.sex} />
            <Field label="Civil Status" value={senior?.civilStatus} />
            <Field label="Senior Citizen ID" value={senior?.seniorCitizenId} />
          </Section>

          <Section icon={Phone} title="Contact Information">
            <Field label="Mobile Number" value={senior?.mobileNumber} />
            <Field label="Email" value={senior?.email} />
            <Field
              label="Complete Address"
              value={[senior?.address?.houseLotBlock, senior?.address?.street, senior?.address?.sitio, senior?.address?.purok]
                .filter(Boolean)
                .join(", ")}
            />
            <Field label="Barangay" value={detail?.barangayId?.name} />
          </Section>

          <Section icon={HeartPulse} title="Senior Status">
            <Field label="Bedridden" value={senior?.bedridden ? "Yes" : "No"} />
          </Section>

          {guardian && (
            <Section icon={UsersRound} title="Guardian / Authorized Representative">
              <Field label="Name" value={`${guardian.firstName} ${guardian.middleName || ""} ${guardian.lastName}`.replace(/\s+/g, " ").trim()} />
              <Field label="Relationship" value={guardian.relationship} />
              <Field label="Contact Number" value={guardian.mobileNumber} />
              <Field label="Address" value={guardian.address} />
              <Field label="ID Type" value={guardian.idType} />
              <Field label="ID Number" value={guardian.idNumber} />
              <GuardianAccountAction guardian={guardian} verificationStatus={detail?.status} onCreated={load} />
            </Section>
          )}

          <div className="bg-white rounded-lg border p-5" style={{ borderColor: COLORS.alabaster }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" style={{ color: COLORS.baltic }} aria-hidden="true" />
              <h2 className="text-[15px] font-bold" style={{ color: COLORS.yale }}>
                Supporting Documents
              </h2>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No documents were found for this registration.</p>
            ) : (
              <div>
                {documents.map((doc) => (
                  <DocumentRow key={doc._id} doc={doc} />
                ))}
              </div>
            )}
          </div>

          {isPending && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialog("reject")}
                className="flex-1 inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-6 py-3 rounded-md border-2"
                style={{ borderColor: "#b8452f", color: "#b8452f" }}
              >
                <XCircle className="w-5 h-5" aria-hidden="true" />
                Reject Registration
              </button>
              <button
                type="button"
                onClick={() => setDialog("approve")}
                className="flex-1 inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-6 py-3 rounded-md text-white"
                style={{ backgroundColor: COLORS.baltic }}
              >
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                Approve Registration
              </button>
            </div>
          )}
        </div>
      )}

      {dialog && (
        <ConfirmDialog
          variant={dialog}
          submitting={submitting}
          onCancel={() => (submitting ? null : setDialog(null))}
          onConfirm={handleConfirm}
        />
      )}
    </DashboardLayout>
  );
}
