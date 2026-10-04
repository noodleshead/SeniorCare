import { useState, useMemo, useRef, useEffect } from "react";
import {
  Heart,
  ShieldCheck,
  FileText,
  ClipboardCheck,
  CircleCheck,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Pencil,
  Search,
  ChevronDown,
  Loader2,
  WifiOff,
} from "lucide-react";
import {
  getBarangays,
  getIllnesses,
  registerSeniorCitizen,
} from "../services/registrationService.js";

/**
 * SENIORCARE — Senior Citizen Registration
 * Reuses the landing page design system: same palette, type scale,
 * button treatment, border/radius style, and iconography.
 */

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const STEPS = [
  { key: "barangay", label: "Barangay", n: "01" },
  { key: "personal", label: "Personal", n: "02" },
  { key: "contact", label: "Contact", n: "03" },
  { key: "status", label: "Status", n: "04" },
  { key: "medical", label: "Medical", n: "05" },
  { key: "guardian", label: "Guardian", n: "06" },
  { key: "documents", label: "Documents", n: "07" },
  { key: "account", label: "Account", n: "08" },
  { key: "review", label: "Review", n: "09" },
];

// Barangays now come from GET /api/barangays (see BarangayStep + the
// `barangays` state in SeniorCareRegisterPage). No static list here —
// the backend is the source of truth for which barangays are active.

// Basic client-side email format check. Intentionally not exhaustive —
// the backend (Zod's z.string().email()) remains the source of truth,
// this just catches obviously malformed input before Submit so the user
// isn't surprised by a 400 at the very end of the wizard.
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Philippine mobile number — mirrors the backend's phMobileRegex
// (registration.validator.js). Used for both the Senior's own mobile
// and the Guardian's, which previously had no format check at all here
// or on the backend.
const PH_MOBILE_RE = /^(\+?63|0)?9\d{9}$/;

// Mirrors backend/src/utils/textValidation.js's isValidPersonName /
// isValidAddressLine — reasonable, not-overly-strict sanity checks so
// the user sees the same "please enter a valid X" feedback here that
// the backend would otherwise only reveal after a round trip. The
// backend remains the authoritative check either way.
const JUNK_VALUES = new Set(["test", "n/a", "na", "none", "asdf", "asd", "xxx", "...", "???", "!!!", "-", "--"]);

function isValidPersonName(value) {
  const trimmed = (value || "").trim();
  if (trimmed.length < 2) return false;
  if (JUNK_VALUES.has(trimmed.toLowerCase())) return false;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(trimmed)) return false;
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  return letterCount >= 2;
}

function isValidAddressLine(value) {
  const trimmed = (value || "").trim();
  if (trimmed.length < 2) return false;
  if (JUNK_VALUES.has(trimmed.toLowerCase())) return false;
  const alnumCount = (trimmed.match(/[\p{L}\p{N}]/gu) || []).length;
  return alnumCount >= 2;
}

// ---------- shared field components ----------

function FieldLabel({ children, required, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[15px] font-semibold mb-1.5"
      style={{ color: COLORS.yale }}
    >
      {children}
      {required && <span style={{ color: COLORS.cerulean }}> *</span>}
    </label>
  );
}

function HelperText({ children }) {
  return (
    <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{children}</p>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p
      className="flex items-start gap-1.5 text-sm mt-1.5 leading-relaxed"
      style={{ color: "#b8452f" }}
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      {children}
    </p>
  );
}

function TextField({ id, label, required, helper, error, ...props }) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        className="w-full rounded-md border px-4 py-3 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-shadow"
        style={{
          borderColor: error ? "#b8452f" : COLORS.alabaster,
          boxShadow: "none",
        }}
        onFocus={(e) =>
          (e.target.style.boxShadow = `0 0 0 3px ${COLORS.sky}55`)
        }
        onBlur={(e) => (e.target.style.boxShadow = "none")}
        {...props}
      />
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : helper ? (
        <HelperText>{helper}</HelperText>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  required,
  helper,
  error,
  options,
  placeholder,
  ...props
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          id={id}
          className="w-full appearance-none rounded-md border px-4 py-3 text-[15px] text-slate-800 focus:outline-none focus:ring-2 transition-shadow bg-white pr-10"
          style={{ borderColor: error ? "#b8452f" : COLORS.alabaster }}
          onFocus={(e) =>
            (e.target.style.boxShadow = `0 0 0 3px ${COLORS.sky}55`)
          }
          onBlur={(e) => (e.target.style.boxShadow = "none")}
          {...props}
        >
          <option value="">{placeholder || "Select an option"}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : helper ? (
        <HelperText>{helper}</HelperText>
      ) : null}
    </div>
  );
}

function RadioGroup({
  label,
  required,
  helper,
  error,
  name,
  options,
  value,
  onChange,
}) {
  return (
    <fieldset>
      <legend
        className="text-[15px] font-semibold mb-2"
        style={{ color: COLORS.yale }}
      >
        {label}
        {required && <span style={{ color: COLORS.cerulean }}> *</span>}
      </legend>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const checked = value === opt;
          return (
            <label
              key={opt}
              className="flex items-center gap-2.5 rounded-md border px-4 py-3 cursor-pointer text-[15px] font-medium transition-colors"
              style={{
                borderColor: checked ? COLORS.baltic : COLORS.alabaster,
                backgroundColor: checked ? COLORS.sky + "22" : "white",
                color: checked ? COLORS.yale : "#334155",
              }}
            >
              <input
                type="radio"
                name={name}
                value={opt}
                checked={checked}
                onChange={() => onChange(opt)}
                className="w-4 h-4"
                style={{ accentColor: COLORS.baltic }}
              />
              {opt}
            </label>
          );
        })}
      </div>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : helper ? (
        <HelperText>{helper}</HelperText>
      ) : null}
    </fieldset>
  );
}

function FileUploadField({
  label,
  purpose,
  file,
  onChange,
  onRemove,
  error,
  required,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    if (files && files[0]) onChange(files[0]);
  };

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {purpose && (
        <p className="text-sm text-slate-500 mb-2 leading-relaxed">{purpose}</p>
      )}

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className="rounded-lg border-2 border-dashed p-6 flex flex-col items-center text-center gap-3 transition-colors"
          style={{
            borderColor: dragOver ? COLORS.baltic : COLORS.alabaster,
            backgroundColor: dragOver ? COLORS.sky + "1a" : "#f7f9f9",
          }}
        >
          <FileText
            className="w-8 h-8"
            style={{ color: COLORS.cerulean }}
            aria-hidden="true"
          />
          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-[15px] font-semibold px-5 py-2.5 rounded-md text-white"
              style={{ backgroundColor: COLORS.baltic }}
            >
              Upload Document
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <p className="text-xs text-slate-500 mt-2">
              Accepted formats: PDF, JPG, PNG · Maximum file size: 10MB
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg border flex items-center justify-between px-4 py-3.5"
          style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <CircleCheck
              className="w-5 h-5 shrink-0"
              style={{ color: COLORS.cerulean }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: COLORS.yale }}
              >
                {file.name}
              </p>
              <p className="text-xs text-slate-500">Uploaded</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-sm font-semibold shrink-0 ml-3"
            style={{ color: COLORS.cerulean }}
          >
            Remove
          </button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

// ---------- progress ----------

function ProgressDesktop({ stepIndex }) {
  return (
    <ol
      className="hidden lg:flex items-center gap-2"
      aria-label="Registration progress"
    >
      {STEPS.map((s, i) => {
        const state =
          i < stepIndex ? "done" : i === stepIndex ? "current" : "upcoming";
        return (
          <li key={s.key} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor:
                    state === "upcoming" ? "white" : COLORS.baltic,
                  color: state === "upcoming" ? COLORS.yale : "white",
                  border:
                    state === "upcoming"
                      ? `2px solid ${COLORS.alabaster}`
                      : "none",
                }}
              >
                {state === "done" ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  s.n
                )}
              </div>
              <span
                className="text-xs font-semibold truncate hidden xl:inline"
                style={{
                  color: state === "upcoming" ? "#94a3b8" : COLORS.yale,
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 flex-1"
                style={{
                  backgroundColor:
                    i < stepIndex ? COLORS.baltic : COLORS.alabaster,
                }}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ProgressMobile({ stepIndex }) {
  const pct = ((stepIndex + 1) / STEPS.length) * 100;
  return (
    <div className="lg:hidden">
      <p className="text-xs font-semibold text-slate-500 mb-1">
        Step {stepIndex + 1} of {STEPS.length}
      </p>
      <p className="text-base font-bold mb-2" style={{ color: COLORS.yale }}>
        {STEPS[stepIndex].label}
      </p>
      <div
        className="h-2 rounded-full w-full overflow-hidden"
        style={{ backgroundColor: COLORS.alabaster }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: COLORS.baltic }}
        />
      </div>
    </div>
  );
}

// ---------- step navigation buttons ----------

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  showBack = true,
  nextDisabled,
  nextIcon: NextIcon,
  nextIconSpin,
}) {
  return (
    <div
      className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-8 pt-6 border-t"
      style={{ borderColor: COLORS.alabaster }}
    >
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={nextDisabled}
          className="inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-6 py-3.5 rounded-md border-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-busy={nextIconSpin || undefined}
        className="inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-7 py-3.5 rounded-md text-white shadow-sm hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed transition-opacity"
        style={{ backgroundColor: COLORS.baltic }}
      >
        {nextLabel}
        {NextIcon ? (
          <NextIcon
            className={`w-4 h-4 ${nextIconSpin ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        ) : (
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function StepHeading({ title, helper }) {
  return (
    <div className="mb-7">
      <h2
        className="text-2xl sm:text-[28px] font-extrabold tracking-tight mb-2"
        style={{ color: COLORS.yale }}
      >
        {title}
      </h2>
      {helper && (
        <p className="text-[15px] text-slate-600 leading-relaxed">{helper}</p>
      )}
    </div>
  );
}

// Backend validation errors are keyed by the API's field paths (e.g.
// "address.street", "guardian.firstName", "barangayId"). This maps them
// onto the local `errors` state's flat keys so they highlight the same
// fields the frontend's own validation would.
const BACKEND_TO_LOCAL_ERROR_KEY = {
  barangayId: "barangay",
  "address.houseLotBlock": "houseNo",
  "address.street": "street",
  "address.municipality": "municipality",
  "address.province": "province",
  "address.postalCode": "postalCode",
  accountEmail: "accountEmail",
  mobileNumber: "mobile",
  seniorCitizenId: "seniorId",
  dateOfBirth: "dob",
  "guardian.firstName": "guardianFirstName",
  "guardian.lastName": "guardianLastName",
  "guardian.relationship": "guardianRelationship",
  "guardian.mobileNumber": "guardianMobile",
  "medical.illnessId": "illnessName",
  medicalDocument: "medicalDocument",
  password: "password",
  documents: "documents",
};

function mapBackendFieldErrors(fieldErrors) {
  const mapped = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    const localKey = BACKEND_TO_LOCAL_ERROR_KEY[key] || key;
    mapped[localKey] = Array.isArray(message) ? message.join(" ") : message;
  }
  return mapped;
}

function calcAge(dobStr) {
  if (!dobStr) return "";
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : "";
}

// ---------- main component ----------

export default function SeniorCareRegisterPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState("");

  // Live barangay data from GET /api/barangays.
  const [barangays, setBarangays] = useState([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);
  const [barangaysError, setBarangaysError] = useState(null);

  // Final submission state (POST /api/registration).
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Captured once from the registration response so the one-time
  // Guardian temporary password can be shown on the success screen —
  // never persisted, never refetched, never shown again after this.
  const [guardianCredentials, setGuardianCredentials] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBarangays() {
      setBarangaysLoading(true);
      setBarangaysError(null);
      try {
        const data = await getBarangays();
        if (!cancelled) setBarangays(data);
      } catch (err) {
        if (!cancelled) setBarangaysError(err.message);
      } finally {
        if (!cancelled) setBarangaysLoading(false);
      }
    }
    loadBarangays();
    return () => {
      cancelled = true;
    };
  }, []);

  // Illness list for the medical step (GET /api/registration/illnesses).
  const [illnesses, setIllnesses] = useState([]);
  const [illnessesLoading, setIllnessesLoading] = useState(true);
  const [illnessesError, setIllnessesError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getIllnesses()
      .then((data) => !cancelled && setIllnesses(data))
      .catch((err) => !cancelled && setIllnessesError(err.message))
      .finally(() => !cancelled && setIllnessesLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const [form, setForm] = useState({
    barangayId: "",
    barangayName: "", // display-only, kept in sync with barangayId for the review step
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    dob: "",
    sex: "",
    civilStatus: "",
    seniorId: "",
    houseNo: "",
    street: "",
    municipality: "",
    province: "",
    postalCode: "",
    mobile: "",
    email: "",
    bedridden: "",
    hasMedicalCondition: "",
    illnessId: "",
    illnessName: "",
    medicalDocument: null,
    hasGuardian: "",
    guardianFirstName: "",
    guardianLastName: "",
    guardianRelationship: "",
    guardianMobile: "",
    guardianEmail: "",
    guardianIdType: "",
    guardianIdNumber: "",
    validId: null,
    seniorCitizenId: null,
    proofResidency: null,
    guardianAuthDoc: null,
    accountEmail: "",
    password: "",
    confirmPassword: "",
    confirmAccuracy: false,
    consentProcessing: false,
  });

  const age = useMemo(() => calcAge(form.dob), [form.dob]);

  // effective steps (skip guardian fields display but keep step for consistent nav)
  // const effectiveSteps = STEPS;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const clearError = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

  const validateStep = () => {
    const key = STEPS[stepIndex].key;
    const newErrors = {};
    if (key === "barangay") {
      if (!form.barangayId)
        newErrors.barangay = "Please select your barangay to continue.";
    }
    if (key === "personal") {
      if (!form.firstName) newErrors.firstName = "Please enter your first name.";
      else if (!isValidPersonName(form.firstName)) newErrors.firstName = "Please enter a valid first name.";
      if (!form.lastName) newErrors.lastName = "Please enter your last name.";
      else if (!isValidPersonName(form.lastName)) newErrors.lastName = "Please enter a valid last name.";
      if (!form.dob) newErrors.dob = "Please enter your date of birth.";
      if (!form.sex) newErrors.sex = "Please select your sex.";
      if (!form.civilStatus)
        newErrors.civilStatus = "Please select your civil status.";
    }
    if (key === "contact") {
      if (!form.mobile) newErrors.mobile = "Please enter a mobile number.";
      else if (!PH_MOBILE_RE.test(form.mobile.replace(/[\s-]/g, ""))) {
        newErrors.mobile = "Please enter a valid Philippine mobile number.";
      }
      if (!form.houseNo) newErrors.houseNo = "Please enter your house/lot/block.";
      else if (!isValidAddressLine(form.houseNo)) newErrors.houseNo = "Please enter a valid house/lot/block.";
      if (!form.street)
        newErrors.street = "Please enter your street, sitio, or purok.";
      else if (!isValidAddressLine(form.street)) newErrors.street = "Please enter a valid street, sitio, or purok.";
      if (!form.municipality)
        newErrors.municipality = "Please enter your municipality or city.";
      else if (!isValidAddressLine(form.municipality)) newErrors.municipality = "Please enter a valid municipality or city.";
      if (!form.province) newErrors.province = "Please enter your province.";
      else if (!isValidAddressLine(form.province)) newErrors.province = "Please enter a valid province.";
      if (!form.postalCode) newErrors.postalCode = "Please enter your postal code.";
      else if (!/^\d{4}$/.test(form.postalCode.trim())) newErrors.postalCode = "Postal code must be exactly 4 digits.";
    }
    if (key === "status") {
      if (!form.bedridden)
        newErrors.bedridden = "Please answer this question to continue.";
    }
    if (key === "medical") {
      if (!form.hasMedicalCondition) {
        newErrors.hasMedicalCondition = "Please answer this question to continue.";
      } else if (form.hasMedicalCondition === "Yes") {
        if (!form.illnessId) newErrors.illnessName = "Please select your medical condition.";
        if (!form.medicalDocument)
          newErrors.medicalDocument = "Please upload a supporting medical document.";
      }
    }
    if (key === "guardian" && form.hasGuardian === "Yes") {
      if (!form.guardianFirstName)
        newErrors.guardianFirstName =
          "Please enter the representative's first name.";
      else if (!isValidPersonName(form.guardianFirstName))
        newErrors.guardianFirstName = "Please enter a valid first name.";
      if (!form.guardianLastName)
        newErrors.guardianLastName =
          "Please enter the representative's last name.";
      else if (!isValidPersonName(form.guardianLastName))
        newErrors.guardianLastName = "Please enter a valid last name.";
      if (!form.guardianRelationship)
        newErrors.guardianRelationship = "Please select a relationship.";
      if (!form.guardianMobile)
        newErrors.guardianMobile = "Please enter a mobile number.";
      else if (!PH_MOBILE_RE.test(form.guardianMobile.replace(/[\s-]/g, "")))
        newErrors.guardianMobile = "Please enter a valid Philippine mobile number.";
      if (!form.guardianEmail)
        newErrors.guardianEmail =
          "Please enter an email address — this becomes the representative's login for their Guardian account.";
      else if (!EMAIL_FORMAT_RE.test(form.guardianEmail.trim()))
        newErrors.guardianEmail = "Please enter a valid email address.";
    } else if (key === "guardian" && !form.hasGuardian) {
      newErrors.hasGuardian = "Please answer this question to continue.";
    }
    if (key === "documents") {
      if (!form.validId) newErrors.validId = "Please upload a valid ID.";
      if (!form.seniorCitizenId)
        newErrors.seniorCitizenId = "Please upload your Senior Citizen ID.";
      if (!form.proofResidency)
        newErrors.proofResidency = "Please upload proof of residency.";
      if (form.hasGuardian === "Yes" && !form.guardianAuthDoc) {
        newErrors.guardianAuthDoc =
          "Please upload an authorization document for your representative.";
      }
    }
    if (key === "account") {
      if (!form.accountEmail) {
        newErrors.accountEmail = "Please enter an email address.";
      } else if (!EMAIL_FORMAT_RE.test(form.accountEmail.trim())) {
        // Catches malformed input (missing "@", missing domain, stray
        // spaces, etc.) at this step, matching the backend's
        // z.string().email() rule in registration.validator.js, so the
        // user isn't surprised by a 400 later at Submit.
        newErrors.accountEmail = "Please enter a valid email address.";
      }
      if (!form.password) newErrors.password = "Please create a password.";
      else if (
        form.password.length < 8 ||
        !/[A-Z]/.test(form.password) ||
        !/\d/.test(form.password)
      ) {
        newErrors.password = "Password does not meet the requirements below.";
      }
      if (form.password !== form.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match.";
    }
    if (key === "review") {
      if (!form.confirmAccuracy)
        newErrors.confirmAccuracy =
          "Please confirm your information is accurate.";
      if (!form.consentProcessing)
        newErrors.consentProcessing = "Please agree to continue.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = async () => {
    if (!validateStep()) return;

    if (stepIndex === STEPS.length - 1) {
      if (submitting) return; // guard against double submission
      setSubmitError(null);
      setSubmitting(true);
      try {
        const response = await registerSeniorCitizen(form);
        // Success: never auto-login, never redirect to a dashboard —
        // just show the existing Pending Verification confirmation state.
        if (response?.data?.guardian) {
          setGuardianCredentials(response.data.guardian);
        }
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        // err is a normalized { status, code, message, fieldErrors }
        if (err.fieldErrors) {
          setErrors((prev) => ({
            ...prev,
            ...mapBackendFieldErrors(err.fieldErrors),
          }));
        }
        setSubmitError(err);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const next = stepIndex + 1;
    setStepIndex(next);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (i) => {
    setStepIndex(i);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return <SuccessState guardianCredentials={guardianCredentials} />;
  }

  const currentKey = STEPS[stepIndex].key;

  return (
    <div
      className="min-h-screen bg-white antialiased"
      style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b"
        style={{ borderColor: COLORS.alabaster }}
      >
        <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span
              className="flex items-center justify-center w-9 h-9 rounded-md"
              style={{ backgroundColor: COLORS.baltic }}
            >
              <Heart className="w-5 h-5 text-white" aria-hidden="true" />
            </span>
            <span
              className="text-lg sm:text-xl font-bold tracking-tight"
              style={{ color: COLORS.yale }}
            >
              SENIORCARE
            </span>
          </a>
          <a
            href="/login"
            className="text-sm sm:text-[15px] font-semibold"
            style={{ color: COLORS.baltic }}
          >
            Already have an account? <span className="underline">Login</span>
          </a>
        </div>
      </header>

      <main className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Page intro */}
        <div className="max-w-2xl mb-8">
          <h1
            className="text-[1.75rem] sm:text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: COLORS.yale }}
          >
            Senior Citizen Registration
          </h1>
          <p className="text-[15px] sm:text-base text-slate-600 leading-relaxed">
            Create your SENIORCARE account to access available barangay
            services, benefits, pension schedules, assistance programs,
            announcements, and activities.
          </p>
        </div>

        {/* Progress */}
        <div
          className="mb-8 rounded-xl border p-5 sm:p-6"
          style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
        >
          <ProgressDesktop stepIndex={stepIndex} />
          <ProgressMobile stepIndex={stepIndex} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Form column */}
          <div
            className="lg:col-span-2 rounded-xl border p-6 sm:p-8"
            style={{ borderColor: COLORS.alabaster }}
          >
            {currentKey === "barangay" && (
              <BarangayStep
                form={form}
                set={set}
                errors={errors}
                search={barangaySearch}
                setSearch={setBarangaySearch}
                barangays={barangays}
                barangaysLoading={barangaysLoading}
                barangaysError={barangaysError}
                onRetry={() => {
                  setBarangaysError(null);
                  setBarangaysLoading(true);
                  getBarangays()
                    .then(setBarangays)
                    .catch((err) => setBarangaysError(err.message))
                    .finally(() => setBarangaysLoading(false));
                }}
                clearError={clearError}
              />
            )}
            {currentKey === "personal" && (
              <PersonalStep
                form={form}
                set={set}
                errors={errors}
                age={age}
                clearError={clearError}
              />
            )}
            {currentKey === "contact" && (
              <ContactStep
                form={form}
                set={set}
                errors={errors}
                clearError={clearError}
              />
            )}
            {currentKey === "status" && (
              <StatusStep
                form={form}
                set={set}
                errors={errors}
                clearError={clearError}
              />
            )}
            {currentKey === "medical" && (
              <MedicalStep
                form={form}
                set={set}
                setForm={setForm}
                errors={errors}
                clearError={clearError}
                illnesses={illnesses}
                loading={illnessesLoading}
                loadError={illnessesError}
              />
            )}
            {currentKey === "guardian" && (
              <GuardianStep
                form={form}
                set={set}
                errors={errors}
                clearError={clearError}
              />
            )}
            {currentKey === "documents" && (
              <DocumentsStep form={form} set={set} errors={errors} />
            )}
            {currentKey === "account" && (
              <AccountStep
                form={form}
                set={set}
                errors={errors}
                clearError={clearError}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
            )}
            {currentKey === "review" && (
              <ReviewStep
                form={form}
                age={age}
                errors={errors}
                set={set}
                goToStep={goToStep}
                submitError={submitError}
              />
            )}

            <StepNav
              onBack={goBack}
              onNext={goNext}
              showBack={stepIndex > 0}
              nextDisabled={
                submitting ||
                (currentKey === "barangay" &&
                  (barangaysLoading || !!barangaysError))
              }
              nextLabel={
                stepIndex === STEPS.length - 1
                  ? submitting
                    ? "Submitting..."
                    : "Submit Registration"
                  : "Continue"
              }
              nextIcon={submitting ? Loader2 : undefined}
              nextIconSpin={submitting}
            />
          </div>

          {/* Help column */}
          <aside
            className="rounded-xl border p-6"
            style={{
              borderColor: COLORS.alabaster,
              backgroundColor: "#f7f9f9",
            }}
          >
            <h3
              className="text-sm font-bold uppercase tracking-wide mb-3"
              style={{ color: COLORS.yale }}
            >
              Registration Help
            </h3>
            <HelpContent stepKey={currentKey} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function HelpContent({ stepKey }) {
  const content = {
    barangay:
      "Your SENIORCARE records will be managed by the barangay you select. Choose the barangay where you are registered as a resident.",
    personal:
      "Enter your information exactly as it appears on your official documents. Your age is calculated automatically from your date of birth.",
    contact:
      "Provide contact information that the barangay can use for important updates and notifications.",
    status:
      "This information helps the barangay understand your circumstances and provide appropriate services.",
    guardian:
      "Only an authorized representative may assist with services on behalf of the senior citizen. Authorization documents may be required.",
    documents:
      "These documents help the barangay verify your identity, residency, and eligibility.",
    account:
      "Create the login credentials you will use to access SENIORCARE after your registration is approved.",
    review:
      "Please review your information carefully. You can edit any section before submitting.",
  };
  return (
    <div className="flex items-start gap-3">
      <ShieldCheck
        className="w-5 h-5 shrink-0 mt-0.5"
        style={{ color: COLORS.cerulean }}
        aria-hidden="true"
      />
      <p className="text-sm text-slate-600 leading-relaxed">
        {content[stepKey]}
      </p>
    </div>
  );
}

// ---------- steps ----------

function BarangayStep({
  form,
  set,
  errors,
  search,
  setSearch,
  barangays,
  barangaysLoading,
  barangaysError,
  onRetry,
  clearError,
}) {
  // Defensive fallback: `barangays` is expected to always be an array
  // (state is initialized as [], and getBarangays() now always resolves
  // to an array — see registrationService.js). This guard just makes the
  // render safe against any future caller that forgets that contract,
  // without hiding fetch failures — those still surface via `barangaysError`.
  const safeBarangays = Array.isArray(barangays) ? barangays : [];

  const filtered = safeBarangays.filter((b) =>
    `${b.name} ${b.municipality}`.toLowerCase().includes(search.toLowerCase()),
  );

  const selectBarangay = (b) => {
    set("barangayId", b._id);
    set("barangayName", b.name);
    clearError("barangay");
  };

  return (
    <div>
      <StepHeading
        title="Select Your Barangay"
        helper="Your SENIORCARE records will be managed by the barangay you select. Choose the barangay where you are registered as a resident."
      />

      {barangaysLoading && (
        <div className="flex items-center gap-2.5 text-[15px] text-slate-500 py-6">
          <Loader2
            className="w-5 h-5 animate-spin"
            style={{ color: COLORS.baltic }}
            aria-hidden="true"
          />
          Loading barangays...
        </div>
      )}

      {!barangaysLoading && barangaysError && (
        <div
          className="rounded-md border p-4 flex items-start gap-3 mb-4"
          style={{ borderColor: "#e3a893", backgroundColor: "#fbeae6" }}
        >
          <WifiOff
            className="w-5 h-5 shrink-0 mt-0.5"
            style={{ color: "#b8452f" }}
            aria-hidden="true"
          />
          <div>
            <p
              className="text-[15px] font-semibold mb-1"
              style={{ color: COLORS.yale }}
            >
              Couldn't load barangays
            </p>
            <p className="text-sm text-slate-600 mb-3">{barangaysError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-semibold px-4 py-2 rounded-md text-white"
              style={{ backgroundColor: COLORS.baltic }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {!barangaysLoading && !barangaysError && (
        <>
          <div className="mb-4">
            <FieldLabel htmlFor="barangaySearch">Search Barangay</FieldLabel>
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="barangaySearch"
                type="text"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border pl-11 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2"
                style={{ borderColor: COLORS.alabaster }}
                onFocus={(e) =>
                  (e.target.style.boxShadow = `0 0 0 3px ${COLORS.sky}55`)
                }
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>
          </div>

          <div
            className="flex flex-col gap-2 mb-2"
            role="radiogroup"
            aria-label="Barangay list"
          >
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 py-3">
                No barangay matches your search.
              </p>
            )}
            {filtered.map((b) => {
              const selected = form.barangayId === b._id;
              return (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => selectBarangay(b)}
                  className="flex items-center justify-between rounded-md border px-4 py-3.5 text-left transition-colors"
                  style={{
                    borderColor: selected ? COLORS.baltic : COLORS.alabaster,
                    backgroundColor: selected ? COLORS.sky + "22" : "white",
                  }}
                >
                  <span
                    className="text-[15px] font-medium"
                    style={{ color: selected ? COLORS.yale : "#334155" }}
                  >
                    {b.name}
                    <span className="font-normal text-slate-500">
                      {" "}
                      — {b.municipality}
                    </span>
                  </span>
                  {selected && (
                    <CircleCheck
                      className="w-5 h-5"
                      style={{ color: COLORS.baltic }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <ErrorText>{errors.barangay}</ErrorText>

      {form.barangayId && (
        <div
          className="mt-5 rounded-md border p-4 flex items-start gap-3"
          style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
        >
          <CircleCheck
            className="w-5 h-5 shrink-0 mt-0.5"
            style={{ color: COLORS.cerulean }}
            aria-hidden="true"
          />
          <p className="text-[15px]" style={{ color: COLORS.yale }}>
            Your registration will be submitted to{" "}
            <span className="font-bold">{form.barangayName}</span>.
          </p>
        </div>
      )}
    </div>
  );
}

function PersonalStep({ form, set, errors, age, clearError }) {
  return (
    <div>
      <StepHeading
        title="Personal Information"
        helper="Enter your information exactly as it appears on your official documents."
      />
      <div className="grid sm:grid-cols-3 gap-5 mb-5">
        <TextField
          id="firstName"
          label="First Name"
          required
          value={form.firstName}
          onChange={(e) => {
            set("firstName", e.target.value);
            clearError("firstName");
          }}
          error={errors.firstName}
        />
        <TextField
          id="middleName"
          label="Middle Name"
          value={form.middleName}
          onChange={(e) => set("middleName", e.target.value)}
        />
        <TextField
          id="lastName"
          label="Last Name"
          required
          value={form.lastName}
          onChange={(e) => {
            set("lastName", e.target.value);
            clearError("lastName");
          }}
          error={errors.lastName}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-5 mb-5">
        <SelectField
          id="suffix"
          label="Suffix"
          value={form.suffix}
          options={["Jr.", "Sr.", "II", "III", "IV"]}
          placeholder="None"
          onChange={(e) => set("suffix", e.target.value)}
        />
        <TextField
          id="dob"
          label="Date of Birth"
          required
          type="date"
          value={form.dob}
          onChange={(e) => {
            set("dob", e.target.value);
            clearError("dob");
          }}
          error={errors.dob}
        />
        <div>
          <FieldLabel>Age</FieldLabel>
          <div
            className="w-full rounded-md border px-4 py-3 text-[15px] font-semibold"
            style={{
              borderColor: COLORS.alabaster,
              backgroundColor: "#f7f9f9",
              color: COLORS.yale,
            }}
          >
            {age !== "" ? `${age} years old` : "—"}
          </div>
          <HelperText>
            Calculated automatically from your date of birth.
          </HelperText>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <RadioGroup
          label="Sex"
          required
          name="sex"
          options={["Male", "Female"]}
          value={form.sex}
          onChange={(v) => {
            set("sex", v);
            clearError("sex");
          }}
          error={errors.sex}
        />
        <SelectField
          id="civilStatus"
          label="Civil Status"
          required
          value={form.civilStatus}
          options={["Single", "Married", "Widowed", "Divorced", "Separated"]}
          onChange={(e) => {
            set("civilStatus", e.target.value);
            clearError("civilStatus");
          }}
          error={errors.civilStatus}
        />
      </div>

      <TextField
        id="seniorId"
        label="Senior Citizen ID Number"
        value={form.seniorId}
        onChange={(e) => set("seniorId", e.target.value)}
        helper="Enter the Senior Citizen ID number shown on your identification, if you already have one."
      />
    </div>
  );
}

function ContactStep({ form, set, errors, clearError }) {
  return (
    <div>
      <StepHeading
        title="Contact Information"
        helper="Provide contact information that the barangay can use for important updates and notifications."
      />
      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <TextField
          id="mobile"
          label="Mobile Number"
          required
          placeholder="9XX XXX XXXX"
          value={form.mobile}
          onChange={(e) => {
            set("mobile", e.target.value);
            clearError("mobile");
          }}
          error={errors.mobile}
          helper={!errors.mobile ? "Format: +63 9XX XXX XXXX" : undefined}
        />
        <TextField
          id="email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>

      <FieldLabel>Barangay</FieldLabel>
      <div
        className="rounded-md border px-4 py-3 mb-5 flex items-center justify-between"
        style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
      >
        <span
          className="text-[15px] font-medium"
          style={{ color: COLORS.yale }}
        >
          {form.barangayName || "Not selected"}
        </span>
        <span
          className="text-xs font-semibold flex items-center gap-1"
          style={{ color: COLORS.cerulean }}
        >
          <CircleCheck className="w-4 h-4" aria-hidden="true" /> Selected
          earlier
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <TextField
          id="houseNo"
          label="House / Lot / Block"
          required
          value={form.houseNo}
          onChange={(e) => {
            set("houseNo", e.target.value);
            clearError("houseNo");
          }}
          error={errors.houseNo}
        />
        <TextField
          id="street"
          label="Street / Sitio / Purok"
          required
          value={form.street}
          onChange={(e) => {
            set("street", e.target.value);
            clearError("street");
          }}
          error={errors.street}
        />
      </div>
      <div className="grid sm:grid-cols-3 gap-5">
        <TextField
          id="municipality"
          label="Municipality / City"
          required
          value={form.municipality}
          onChange={(e) => {
            set("municipality", e.target.value);
            clearError("municipality");
          }}
          error={errors.municipality}
        />
        <TextField
          id="province"
          label="Province"
          required
          value={form.province}
          onChange={(e) => {
            set("province", e.target.value);
            clearError("province");
          }}
          error={errors.province}
        />
        <TextField
          id="postalCode"
          label="Postal Code"
          required
          value={form.postalCode}
          onChange={(e) => {
            set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 4));
            clearError("postalCode");
          }}
          error={errors.postalCode}
        />
      </div>
    </div>
  );
}

function StatusStep({ form, set, errors, clearError }) {
  return (
    <div>
      <StepHeading
        title="Senior Status & Additional Information"
        helper="This information helps the barangay understand your circumstances and provide appropriate services."
      />
      <RadioGroup
        label="Are you currently bedridden?"
        required
        name="bedridden"
        options={["No", "Yes"]}
        value={form.bedridden}
        onChange={(v) => {
          set("bedridden", v);
          clearError("bedridden");
        }}
        error={errors.bedridden}
        helper="This describes your current condition and does not affect your account type."
      />
    </div>
  );
}

function MedicalStep({ form, setForm, errors, clearError, illnesses, loading, loadError }) {
  const yes = form.hasMedicalCondition === "Yes";

  const handleAnswer = (v) => {
    // Switching to "No" wipes every dependent value so stale medical
    // data can never be submitted (the payload builder also checks).
    setForm((f) => ({
      ...f,
      hasMedicalCondition: v,
      ...(v === "No" ? { illnessId: "", illnessName: "", medicalDocument: null } : {}),
    }));
    clearError("hasMedicalCondition");
    clearError("illnessName");
    clearError("medicalDocument");
  };

  return (
    <div>
      <StepHeading
        title="Medical Information"
        helper="Tell us if you have an existing medical condition. Your barangay will review this information later; it does not change your registration right now."
      />
      <div className="flex flex-col gap-6">
        <RadioGroup
          label="Do you have any existing medical condition?"
          required
          name="hasMedicalCondition"
          options={["No", "Yes"]}
          value={form.hasMedicalCondition}
          onChange={handleAnswer}
          error={errors.hasMedicalCondition}
        />

        {form.hasMedicalCondition === "No" && (
          <p className="text-sm text-slate-500">No medical document is required.</p>
        )}

        {yes && (
          <>
            <SelectField
              id="illnessName"
              label="Medical Condition"
              required
              placeholder={loading ? "Loading conditions..." : "Select medical condition"}
              options={illnesses.map((i) => i.name)}
              value={form.illnessName}
              disabled={loading}
              onChange={(e) => {
                const match = illnesses.find((i) => i.name === e.target.value);
                setForm((f) => ({ ...f, illnessName: e.target.value, illnessId: match?._id || "" }));
                clearError("illnessName");
              }}
              error={errors.illnessName || (loadError ? "Unable to load the list of conditions. Please try again later." : undefined)}
              helper={!loading && !loadError && illnesses.length === 0 ? "No conditions are available yet. Please contact your barangay office." : undefined}
            />
            <FileUploadField
              label="Medical Supporting Document"
              required
              purpose="A medical certificate, doctor's certification, or medical record showing your condition."
              file={form.medicalDocument}
              onChange={(f) => {
                setForm((s) => ({ ...s, medicalDocument: f }));
                clearError("medicalDocument");
              }}
              onRemove={() => setForm((s) => ({ ...s, medicalDocument: null }))}
              error={errors.medicalDocument}
            />
          </>
        )}
      </div>
    </div>
  );
}

function GuardianStep({ form, set, errors, clearError }) {
  return (
    <div>
      <StepHeading
        title="Guardian or Authorized Representative"
        helper="If someone is authorized to assist you with SENIORCARE services, you may provide their information here."
      />
      <RadioGroup
        label="Do you have an authorized guardian or representative?"
        required
        name="hasGuardian"
        options={["Yes", "No"]}
        value={form.hasGuardian}
        onChange={(v) => {
          set("hasGuardian", v);
          clearError("hasGuardian");
        }}
        error={errors.hasGuardian}
      />

      {form.hasGuardian === "No" && (
        <div
          className="mt-5 rounded-md border p-4"
          style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
        >
          <p className="text-[15px] text-slate-600">
            No guardian or representative will be associated with this
            registration.
          </p>
        </div>
      )}

      {form.hasGuardian === "Yes" && (
        <div className="mt-6 flex flex-col gap-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <TextField
              id="guardianFirstName"
              label="Representative First Name"
              required
              value={form.guardianFirstName}
              onChange={(e) => {
                set("guardianFirstName", e.target.value);
                clearError("guardianFirstName");
              }}
              error={errors.guardianFirstName}
            />
            <TextField
              id="guardianLastName"
              label="Representative Last Name"
              required
              value={form.guardianLastName}
              onChange={(e) => {
                set("guardianLastName", e.target.value);
                clearError("guardianLastName");
              }}
              error={errors.guardianLastName}
            />
          </div>
          <SelectField
            id="guardianRelationship"
            label="Relationship to Senior"
            required
            value={form.guardianRelationship}
            options={[
              "Child",
              "Spouse",
              "Sibling",
              "Relative",
              "Caregiver",
              "Other",
            ]}
            onChange={(e) => {
              set("guardianRelationship", e.target.value);
              clearError("guardianRelationship");
            }}
            error={errors.guardianRelationship}
          />
          <div className="grid sm:grid-cols-2 gap-5">
            <TextField
              id="guardianMobile"
              label="Mobile Number"
              required
              value={form.guardianMobile}
              onChange={(e) => {
                set("guardianMobile", e.target.value);
                clearError("guardianMobile");
              }}
              error={errors.guardianMobile}
            />
            <TextField
              id="guardianEmail"
              label="Email Address"
              type="email"
              required
              helper="Used as the representative's login for their own Guardian account."
              value={form.guardianEmail}
              onChange={(e) => {
                set("guardianEmail", e.target.value);
                clearError("guardianEmail");
              }}
              error={errors.guardianEmail}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <SelectField
              id="guardianIdType"
              label="ID Type"
              value={form.guardianIdType}
              options={[
                "Philippine National ID",
                "Driver's License",
                "Passport",
                "UMID",
                "Other Government ID",
              ]}
              onChange={(e) => set("guardianIdType", e.target.value)}
            />
            <TextField
              id="guardianIdNumber"
              label="ID Number"
              value={form.guardianIdNumber}
              onChange={(e) => set("guardianIdNumber", e.target.value)}
            />
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Authorization documents may be required before the representative
            can manage services on your behalf. You'll be asked to upload these
            in the next step.
          </p>
        </div>
      )}
    </div>
  );
}

function DocumentsStep({ form, set, errors }) {
  return (
    <div>
      <StepHeading
        title="Supporting Documents"
        helper="Upload the documents required for barangay verification. These documents help confirm your identity, residency, and eligibility."
      />
      <div className="flex flex-col gap-6">
        <FileUploadField
          label="Valid Identification"
          required
          purpose="A government-issued ID showing your name and photo."
          file={form.validId}
          onChange={(f) => set("validId", f)}
          onRemove={() => set("validId", null)}
          error={errors.validId}
        />
        <FileUploadField
          label="Senior Citizen ID"
          required
          purpose="Your existing Senior Citizen ID, if available."
          file={form.seniorCitizenId}
          onChange={(f) => set("seniorCitizenId", f)}
          onRemove={() => set("seniorCitizenId", null)}
          error={errors.seniorCitizenId}
        />
        <FileUploadField
          label="Proof of Residency"
          required
          purpose="A document such as a barangay certificate or utility bill showing your address."
          file={form.proofResidency}
          onChange={(f) => set("proofResidency", f)}
          onRemove={() => set("proofResidency", null)}
          error={errors.proofResidency}
        />
        {form.hasGuardian === "Yes" && (
          <FileUploadField
            label="Guardian / Authorization Document"
            required
            purpose="A document authorizing your representative to assist with SENIORCARE services."
            file={form.guardianAuthDoc}
            onChange={(f) => set("guardianAuthDoc", f)}
            onRemove={() => set("guardianAuthDoc", null)}
            error={errors.guardianAuthDoc}
          />
        )}
      </div>
    </div>
  );
}

function AccountStep({
  form,
  set,
  errors,
  clearError,
  showPassword,
  setShowPassword,
}) {
  const reqs = [
    { met: form.password.length >= 8, label: "At least 8 characters" },
    { met: /[A-Z]/.test(form.password), label: "One uppercase letter" },
    { met: /\d/.test(form.password), label: "One number" },
  ];
  return (
    <div>
      <StepHeading
        title="Create Your Account"
        helper="Create the login credentials you will use to access SENIORCARE."
      />
      <div className="flex flex-col gap-5 max-w-lg">
        <TextField
          id="accountEmail"
          label="Email"
          required
          type="email"
          value={form.accountEmail}
          onChange={(e) => {
            set("accountEmail", e.target.value);
            clearError("accountEmail");
          }}
          error={errors.accountEmail}
        />

        <div>
          <FieldLabel htmlFor="password" required>
            Password
          </FieldLabel>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => {
                set("password", e.target.value);
                clearError("password");
              }}
              className="w-full rounded-md border px-4 py-3 pr-12 text-[15px] focus:outline-none focus:ring-2"
              style={{
                borderColor: errors.password ? "#b8452f" : COLORS.alabaster,
              }}
              onFocus={(e) =>
                (e.target.style.boxShadow = `0 0 0 3px ${COLORS.sky}55`)
              }
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          <ErrorText>{errors.password}</ErrorText>
          <div className="mt-2.5 flex flex-col gap-1">
            <p className="text-sm text-slate-500 mb-0.5">
              Your password should contain:
            </p>
            {reqs.map((r) => (
              <p
                key={r.label}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: r.met ? COLORS.cerulean : "#94a3b8" }}
              >
                {r.met ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="w-4 h-4 inline-block" />
                )}
                {r.label}
              </p>
            ))}
          </div>
        </div>

        <TextField
          id="confirmPassword"
          label="Confirm Password"
          required
          type={showPassword ? "text" : "password"}
          value={form.confirmPassword}
          onChange={(e) => {
            set("confirmPassword", e.target.value);
            clearError("confirmPassword");
          }}
          error={errors.confirmPassword}
        />
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
        {label}
      </p>
      <p className="text-[15px] text-slate-800">{value || "—"}</p>
    </div>
  );
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <div
      className="pb-6 mb-6 border-b last:border-b-0 last:mb-0 last:pb-0"
      style={{ borderColor: COLORS.alabaster }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: COLORS.yale }}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-sm font-semibold"
          style={{ color: COLORS.baltic }}
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

function ReviewStep({ form, age, errors, set, goToStep, submitError }) {
  const fullName = [form.firstName, form.middleName, form.lastName, form.suffix]
    .filter(Boolean)
    .join(" ");
  const address = [
    form.houseNo,
    form.street,
    form.barangayName,
    form.municipality,
    form.province,
    form.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <StepHeading
        title="Review Your Registration"
        helper="Please review your information carefully before submitting your registration."
      />

      {submitError && (
        <div
          role="alert"
          className="rounded-md border p-4 flex items-start gap-3 mb-6"
          style={{ borderColor: "#e3a893", backgroundColor: "#fbeae6" }}
        >
          {submitError.code === "NETWORK_ERROR" ? (
            <WifiOff
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: "#b8452f" }}
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: "#b8452f" }}
              aria-hidden="true"
            />
          )}
          <div>
            <p
              className="text-[15px] font-bold mb-1"
              style={{ color: COLORS.yale }}
            >
              We couldn't submit your registration
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
              {submitError.message}
            </p>
          </div>
        </div>
      )}

      <ReviewSection title="Barangay" onEdit={() => goToStep(0)}>
        <ReviewRow label="Selected Barangay" value={form.barangayName} />
      </ReviewSection>

      <ReviewSection title="Personal Information" onEdit={() => goToStep(1)}>
        <ReviewRow label="Full Name" value={fullName} />
        <ReviewRow label="Date of Birth" value={form.dob} />
        <ReviewRow label="Age" value={age !== "" ? `${age} years old` : ""} />
        <ReviewRow label="Sex" value={form.sex} />
        <ReviewRow label="Civil Status" value={form.civilStatus} />
        <ReviewRow label="Senior Citizen ID" value={form.seniorId} />
      </ReviewSection>

      <ReviewSection title="Contact Information" onEdit={() => goToStep(2)}>
        <ReviewRow label="Mobile" value={form.mobile} />
        <ReviewRow label="Email" value={form.email} />
        <ReviewRow label="Address" value={address} />
      </ReviewSection>

      <ReviewSection title="Senior Status" onEdit={() => goToStep(3)}>
        <ReviewRow label="Bedridden" value={form.bedridden} />
      </ReviewSection>

      <ReviewSection title="Medical Information" onEdit={() => goToStep(4)}>
        <ReviewRow label="Existing medical condition" value={form.hasMedicalCondition} />
        {form.hasMedicalCondition === "Yes" && (
          <>
            <ReviewRow label="Condition" value={form.illnessName} />
            <ReviewRow label="Supporting document" value={form.medicalDocument?.name} />
          </>
        )}
      </ReviewSection>

      <ReviewSection
        title="Guardian / Representative"
        onEdit={() => goToStep(5)}
      >
        {form.hasGuardian === "Yes" ? (
          <>
            <ReviewRow
              label="Name"
              value={[form.guardianFirstName, form.guardianLastName]
                .filter(Boolean)
                .join(" ")}
            />
            <ReviewRow label="Relationship" value={form.guardianRelationship} />
            <ReviewRow label="Mobile" value={form.guardianMobile} />
            <ReviewRow label="Email" value={form.guardianEmail} />
          </>
        ) : (
          <ReviewRow label="Guardian" value="Not applicable" />
        )}
      </ReviewSection>

      <ReviewSection title="Supporting Documents" onEdit={() => goToStep(6)}>
        <ReviewRow label="Valid ID" value={form.validId?.name} />
        <ReviewRow
          label="Senior Citizen ID"
          value={form.seniorCitizenId?.name}
        />
        <ReviewRow
          label="Proof of Residency"
          value={form.proofResidency?.name}
        />
        {form.hasGuardian === "Yes" && (
          <ReviewRow
            label="Guardian Authorization"
            value={form.guardianAuthDoc?.name}
          />
        )}
      </ReviewSection>

      <ReviewSection title="Account" onEdit={() => goToStep(7)}>
        <ReviewRow label="Email / Username" value={form.accountEmail} />
        <ReviewRow label="Password" value="••••••••" />
      </ReviewSection>

      <div className="flex flex-col gap-3 mt-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.confirmAccuracy}
            onChange={(e) => set("confirmAccuracy", e.target.checked)}
            className="w-5 h-5 mt-0.5 shrink-0"
            style={{ accentColor: COLORS.baltic }}
          />
          <span className="text-[15px] text-slate-700">
            I confirm that the information I provided is true and accurate to
            the best of my knowledge.
          </span>
        </label>
        <ErrorText>{errors.confirmAccuracy}</ErrorText>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.consentProcessing}
            onChange={(e) => set("consentProcessing", e.target.checked)}
            className="w-5 h-5 mt-0.5 shrink-0"
            style={{ accentColor: COLORS.baltic }}
          />
          <span className="text-[15px] text-slate-700">
            I agree to the processing of my information for SENIORCARE services,
            verification, and related barangay assistance. Read our{" "}
            <a
              href="/privacy"
              className="underline font-semibold"
              style={{ color: COLORS.baltic }}
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>
        <ErrorText>{errors.consentProcessing}</ErrorText>
      </div>

      <div
        className="mt-6 rounded-md border p-4"
        style={{ borderColor: COLORS.alabaster, backgroundColor: "#f7f9f9" }}
      >
        <p
          className="text-[15px] font-semibold mb-1"
          style={{ color: COLORS.yale }}
        >
          Ready to submit?
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Your registration will be sent to{" "}
          {form.barangayName || "your selected barangay"} for verification.
        </p>
      </div>
    </div>
  );
}

function SuccessState({ guardianCredentials }) {
  const flow = [
    "Registration Submitted",
    "Barangay Reviews Information",
    "Documents Are Verified",
    "Account Approved",
    "Account Activated",
    "Login to SENIORCARE",
  ];
  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-16"
      style={{ backgroundColor: "#f7f9f9" }}
    >
      <div
        className="max-w-lg w-full bg-white rounded-xl border p-8 sm:p-10 text-center"
        style={{ borderColor: COLORS.alabaster }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Check className="w-8 h-8 text-white" aria-hidden="true" />
        </div>
        <h1
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"
          style={{ color: COLORS.yale }}
        >
          Registration Submitted
        </h1>
        <p className="text-[15px] text-slate-600 leading-relaxed mb-6">
          Your SENIORCARE registration has been successfully submitted.
        </p>

        <div
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full mb-8"
          style={{ backgroundColor: COLORS.sky + "33", color: COLORS.yale }}
        >
          <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
          PENDING BARANGAY VERIFICATION
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-8">
          Your selected barangay will review your information and supporting
          documents. Once your registration is approved, your account will
          become active and you can log in to access your SENIORCARE services.
        </p>

        {guardianCredentials && (
          <div
            className="rounded-lg border-2 p-4 mb-8 text-left text-sm"
            style={{ borderColor: COLORS.baltic, backgroundColor: COLORS.baltic + "0d" }}
          >
            <p className="font-bold mb-1" style={{ color: COLORS.yale }}>
              Guardian / Authorized Representative Account Created
            </p>
            <p className="text-slate-600 mb-3">
              A login account was created for your representative. It will become active once this registration
              is approved. Save these credentials now — the temporary password will not be shown again.
            </p>
            <p style={{ color: COLORS.yale }}>
              Email: <strong>{guardianCredentials.email}</strong>
            </p>
            {guardianCredentials.temporaryPassword && (
              <p style={{ color: COLORS.yale }}>
                Temporary Password: <strong>{guardianCredentials.temporaryPassword}</strong>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 mb-8 text-left">
          {flow.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: i === 0 ? COLORS.baltic : COLORS.alabaster,
                  }}
                />
                {i < flow.length - 1 && (
                  <div
                    className="w-0.5 h-5"
                    style={{ backgroundColor: COLORS.alabaster }}
                  />
                )}
              </div>
              <span
                className="text-sm"
                style={{
                  color: i === 0 ? COLORS.yale : "#64748b",
                  fontWeight: i === 0 ? 700 : 500,
                }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/"
            className="flex-1 text-center text-[15px] font-semibold px-6 py-3.5 rounded-md border-2"
            style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
          >
            Back to Home
          </a>
          <a
            href="/login"
            className="flex-1 text-center text-[15px] font-semibold px-6 py-3.5 rounded-md text-white"
            style={{ backgroundColor: COLORS.baltic }}
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}
