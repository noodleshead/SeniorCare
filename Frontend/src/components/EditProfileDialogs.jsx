import { useState } from "react";
import { X, Loader2, AlertCircle, Lock } from "lucide-react";
import { isValidPersonName, isValidAddressLine, PH_MOBILE_RE } from "../utils/validation.js";

const DEFAULT_COLORS = { yale: "#16425b", baltic: "#2f6690", sky: "#81c3d7", alabaster: "#d9dcd6" };

function Field({ id, label, value, onChange, error, colors, readOnly, hint, inputMode, maxLength }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-1" style={{ color: colors.yale }}>
        {label}
        {readOnly && <Lock className="inline w-3.5 h-3.5 ml-1.5 text-slate-400" aria-label="Read-only" />}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full rounded-md border px-3 py-2.5 text-[15px] focus:outline-none read-only:bg-slate-50 read-only:text-slate-500"
        style={{ borderColor: error ? "#b8452f" : colors.alabaster }}
      />
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs mt-1" style={{ color: "#b8452f" }}>{error}</p>}
    </div>
  );
}

function DialogShell({ title, onClose, saving, error, children, onSubmit, colors }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <form
        onSubmit={onSubmit}
        noValidate
        className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <button type="button" onClick={onClose} disabled={saving} className="absolute top-4 right-4 text-slate-400" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold mb-4" style={{ color: colors.yale }}>{title}</h3>
        {error && (
          <div className="flex items-start gap-2 rounded-md border p-3 mb-4 text-sm" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893", color: "#7a2e1c" }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}
        <div className="space-y-4">{children}</div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-md text-sm font-semibold border" style={{ borderColor: colors.alabaster, color: colors.yale }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-md text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: colors.baltic }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// Backend field paths -> local error keys, so server-side rejections show inline.
const flattenServerErrors = (fieldErrors = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(fieldErrors)) out[k.replace(/^address\./, "")] = v;
  return out;
};

/**
 * Senior profile correction. Used for both self-service (Senior Dashboard)
 * and Admin correction (User Management) — `allowIdEdit` is only ever
 * true for Admin; a Senior sees the ID as read-only. Verified identity
 * fields (ID, birth date, sex, civil status, barangay) are never editable
 * by the Senior; the backend enforces that independently of this form.
 */
export function SeniorEditProfileDialog({ initial, submit, onClose, onSaved, colors = DEFAULT_COLORS, allowIdEdit = false }) {
  const a = initial.address || {};
  const [f, setF] = useState({
    firstName: initial.firstName || "",
    middleName: initial.middleName || "",
    lastName: initial.lastName || "",
    suffix: initial.suffix || "",
    mobileNumber: initial.mobileNumber || "",
    seniorCitizenId: initial.seniorCitizenId || "",
    houseLotBlock: a.houseLotBlock || "",
    street: a.street || "",
    sitio: a.sitio || "",
    purok: a.purok || "",
    municipality: a.municipality || "",
    province: a.province || "",
    postalCode: a.postalCode || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!isValidPersonName(f.firstName)) e.firstName = "Please enter a valid first name.";
    if (!isValidPersonName(f.lastName)) e.lastName = "Please enter a valid last name.";
    if (!PH_MOBILE_RE.test(f.mobileNumber.replace(/[\s-]/g, ""))) e.mobileNumber = "Please enter a valid Philippine mobile number.";
    if (!isValidAddressLine(f.houseLotBlock)) e.houseLotBlock = "Please enter a valid house/lot/block.";
    if (!isValidAddressLine(f.street)) e.street = "Please enter a valid street, sitio, or purok.";
    if (!isValidAddressLine(f.municipality)) e.municipality = "Please enter a valid municipality or city.";
    if (!isValidAddressLine(f.province)) e.province = "Please enter a valid province.";
    if (!/^\d{4}$/.test(f.postalCode.trim())) e.postalCode = "Postal code must be exactly 4 digits.";
    if (allowIdEdit && f.seniorCitizenId.trim() && !isValidAddressLine(f.seniorCitizenId)) e.seniorCitizenId = "Please enter a valid Senior Citizen ID.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        firstName: f.firstName, middleName: f.middleName, lastName: f.lastName, suffix: f.suffix,
        mobileNumber: f.mobileNumber.replace(/[\s-]/g, ""),
        address: {
          houseLotBlock: f.houseLotBlock, street: f.street, sitio: f.sitio, purok: f.purok,
          municipality: f.municipality, province: f.province, postalCode: f.postalCode,
        },
      };
      if (allowIdEdit) payload.seniorCitizenId = f.seniorCitizenId;
      const result = await submit(payload);
      onSaved(result);
    } catch (err) {
      setError(err.message || "Unable to save your changes.");
      setErrors((prev) => ({ ...prev, ...flattenServerErrors(err.fieldErrors) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell title="Edit Profile" onClose={onClose} saving={saving} error={error} onSubmit={handleSubmit} colors={colors}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="ep-first" label="First Name" value={f.firstName} onChange={set("firstName")} error={errors.firstName} colors={colors} />
        <Field id="ep-middle" label="Middle Name" value={f.middleName} onChange={set("middleName")} colors={colors} />
        <Field id="ep-last" label="Last Name" value={f.lastName} onChange={set("lastName")} error={errors.lastName} colors={colors} />
        <Field id="ep-suffix" label="Suffix" value={f.suffix} onChange={set("suffix")} colors={colors} />
      </div>
      <Field id="ep-mobile" label="Mobile Number" value={f.mobileNumber} onChange={set("mobileNumber")} error={errors.mobileNumber} colors={colors} inputMode="tel" />
      <Field
        id="ep-scid"
        label="Senior Citizen ID"
        value={f.seniorCitizenId}
        onChange={allowIdEdit ? set("seniorCitizenId") : undefined}
        readOnly={!allowIdEdit}
        error={errors.seniorCitizenId}
        hint={allowIdEdit ? "Sensitive: changes are checked for duplicates and recorded in the Audit Log." : "Verified by your barangay — contact your barangay office to correct it."}
        colors={colors}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="ep-house" label="House / Lot / Block" value={f.houseLotBlock} onChange={set("houseLotBlock")} error={errors.houseLotBlock} colors={colors} />
        <Field id="ep-street" label="Street / Sitio / Purok" value={f.street} onChange={set("street")} error={errors.street} colors={colors} />
        <Field id="ep-muni" label="Municipality / City" value={f.municipality} onChange={set("municipality")} error={errors.municipality} colors={colors} />
        <Field id="ep-prov" label="Province" value={f.province} onChange={set("province")} error={errors.province} colors={colors} />
        <Field id="ep-zip" label="Postal Code" value={f.postalCode} onChange={(v) => set("postalCode")(v.replace(/\D/g, "").slice(0, 4))} error={errors.postalCode} colors={colors} inputMode="numeric" maxLength={4} />
      </div>
      <p className="text-xs text-slate-500">
        Birth date, sex, civil status, and barangay were verified at registration and can't be changed here.
      </p>
    </DialogShell>
  );
}

export function GuardianEditProfileDialog({ initial, submit, onClose, onSaved, colors = DEFAULT_COLORS }) {
  const [f, setF] = useState({
    firstName: initial.firstName || "",
    lastName: initial.lastName || "",
    mobileNumber: initial.mobileNumber || "",
    address: initial.address || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    const e = {};
    if (!isValidPersonName(f.firstName)) e.firstName = "Please enter a valid first name.";
    if (!isValidPersonName(f.lastName)) e.lastName = "Please enter a valid last name.";
    if (!PH_MOBILE_RE.test(f.mobileNumber.replace(/[\s-]/g, ""))) e.mobileNumber = "Please enter a valid Philippine mobile number.";
    if (!isValidAddressLine(f.address)) e.address = "Please enter a valid address.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const result = await submit({ ...f, mobileNumber: f.mobileNumber.replace(/[\s-]/g, "") });
      onSaved(result);
    } catch (err) {
      setError(err.message || "Unable to save your changes.");
      setErrors((prev) => ({ ...prev, ...(err.fieldErrors || {}) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell title="Edit My Profile" onClose={onClose} saving={saving} error={error} onSubmit={handleSubmit} colors={colors}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="gp-first" label="First Name" value={f.firstName} onChange={set("firstName")} error={errors.firstName} colors={colors} />
        <Field id="gp-last" label="Last Name" value={f.lastName} onChange={set("lastName")} error={errors.lastName} colors={colors} />
      </div>
      <Field id="gp-mobile" label="Mobile Number" value={f.mobileNumber} onChange={set("mobileNumber")} error={errors.mobileNumber} colors={colors} inputMode="tel" />
      <Field id="gp-address" label="Address" value={f.address} onChange={set("address")} error={errors.address} colors={colors} />
      <Field id="gp-email" label="Login Email" value={initial.email || ""} readOnly colors={colors} hint="Your login email and the Seniors you are authorized for can't be changed here." />
    </DialogShell>
  );
}
