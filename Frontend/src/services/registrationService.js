import { api, toApiError } from "../utils/api.js";

/**
 * GET /api/barangays
 * Returns only active barangays, exactly as SENIORCARE's registration
 * step requires. Backend route: src/routes/registration.routes.js
 * (aliased at /api/barangays in app.js).
 */
export async function getIllnesses() {
  try {
    const res = await api.get("/registration/illnesses");
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getBarangays() {
  try {
    const res = await api.get("/barangays");
    // Backend returns { success: true, data: [...] } (see
    // registration.controller.js → getBarangays). Guard against any
    // shape drift (empty body, a bare array, a differently-named key)
    // so this function always resolves to an array — callers should
    // never have to defensively re-check the shape themselves.
    const payload = res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Maps the registration wizard's local form state into the exact shape
 * the backend's Zod schema expects (src/validators/registration.validator.js).
 * Kept as one explicit function so field-name drift between frontend state
 * and backend fields is caught in one place.
 *
 * IMPORTANT — guardian fields:
 * The backend's guardianSchema marks firstName/lastName/relationship/
 * mobileNumber as `.optional()`, which only allows those keys to be
 * *absent*. It does not exempt them from `.min(1)` if present as an
 * empty string. When the user has no guardian, we must therefore omit
 * those fields entirely (send `undefined`, which JSON.stringify drops)
 * rather than sending `""`. Sending `""` previously caused every
 * no-guardian submission to fail validation with:
 *   "guardian.firstName": "String must contain at least 1 character(s)"
 *   "guardian.lastName": "String must contain at least 1 character(s)"
 */
function buildRegistrationPayload(form) {
  const hasGuardian = form.hasGuardian === "Yes";

  return {
    barangayId: form.barangayId,

    firstName: form.firstName.trim(),
    middleName: form.middleName.trim(),
    lastName: form.lastName.trim(),
    suffix: form.suffix.trim(),

    dateOfBirth: form.dob, // backend computes/validates age itself
    sex: form.sex,
    civilStatus: form.civilStatus,

    seniorCitizenId: form.seniorId.trim(),

    mobileNumber: normalizeMobile(form.mobile),
    email: form.email.trim(),

    address: {
      houseLotBlock: form.houseNo.trim(),
      street: form.street.trim(),
      municipality: form.municipality.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
    },

    // "Yes"/"No" (UI) → boolean (API contract)
    bedridden: form.bedridden === "Yes",

    guardian: {
      hasGuardian,
      // Required-when-present fields: omit entirely (undefined) when
      // there is no guardian, instead of sending "".
      firstName: hasGuardian ? form.guardianFirstName.trim() : undefined,
      lastName: hasGuardian ? form.guardianLastName.trim() : undefined,
      relationship: hasGuardian
        ? form.guardianRelationship || undefined
        : undefined,
      mobileNumber: hasGuardian
        ? normalizeMobile(form.guardianMobile)
        : undefined,

      // Always-optional-with-default fields: safe to send "" either way,
      // but keep them empty when there's no guardian for clarity.
      middleName: hasGuardian ? form.guardianMiddleName?.trim() || "" : "",
      suffix: hasGuardian ? form.guardianSuffix?.trim() || "" : "",
      email: hasGuardian ? form.guardianEmail.trim() : "",
      address: hasGuardian ? form.guardianAddress?.trim() || "" : "",
      idType: hasGuardian ? form.guardianIdType || "" : "",
      idNumber: hasGuardian ? form.guardianIdNumber.trim() : "",
    },

    // Only the two client-controlled medical values are ever sent — no
    // status/classification/priority. "No" never carries an illness.
    medical: {
      hasMedicalCondition: form.hasMedicalCondition === "Yes",
      illnessId: form.hasMedicalCondition === "Yes" ? form.illnessId || undefined : undefined,
    },

    accountEmail: form.accountEmail.trim(),
    password: form.password, // sent once, over HTTPS in production; never persisted client-side
  };
}

// Backend expects a Philippine mobile number the Zod pattern can match:
// ^(\+?63|0)?9\d{9}$ — strip spaces/dashes the user may have typed.
function normalizeMobile(raw) {
  return (raw || "").replace(/[\s-]/g, "");
}

/**
 * POST /api/registration (multipart/form-data)
 *
 * The backend controller (registration.controller.js) expects:
 *  - a `data` field containing the JSON-encoded payload above
 *  - file fields: validId, seniorCitizenId, proofResidency, guardianAuthDoc
 *
 * Returns the backend's safe success payload:
 *   { success: true, message, data: { status: "PENDING_VERIFICATION", seniorId } }
 *
 * Throws a normalized ApiError ({ status, code, message, fieldErrors })
 * on any failure — duplicate email/SC ID, invalid barangay, validation
 * errors, or network failure are all surfaced the same way.
 */
export async function registerSeniorCitizen(form) {
  const payload = buildRegistrationPayload(form);

  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));

  if (form.validId) formData.append("validId", form.validId);
  if (form.seniorCitizenId)
    formData.append("seniorCitizenId", form.seniorCitizenId);
  if (form.proofResidency)
    formData.append("proofResidency", form.proofResidency);
  if (payload.medical.hasMedicalCondition && form.medicalDocument) {
    formData.append("medicalDocument", form.medicalDocument);
  }
  if (payload.guardian.hasGuardian && form.guardianAuthDoc) {
    formData.append("guardianAuthDoc", form.guardianAuthDoc);
  }

  try {
    // Do NOT set Content-Type manually — the browser generates the
    // multipart boundary automatically when the body is a FormData.
    const res = await api.post("/registration", formData);
    return res.data; // { success, message, data: { status, seniorId } }
  } catch (err) {
    throw toApiError(err);
  }
}
