import { api, toApiError } from "../utils/api.js";

/**
 * Senior (and, once activated, Guardian) self-service Benefits API.
 * Backend: benefitProgram.routes.js / benefitApplication.routes.js.
 * Every endpoint resolves the acting Senior from the authenticated
 * token server-side (see utils/guardianAccess.js) — there is no
 * seniorId anywhere in these calls for the caller to tamper with.
 */

/** Active programs scoped to the Senior's own barangay, each with the backend's eligibility verdict attached. */
export async function getMyEligiblePrograms() {
  try {
    const res = await api.get("/benefits/me/eligible");
    return res.data?.data || []; // [{ program, eligible, reasons }]
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyApplications() {
  try {
    const res = await api.get("/benefit-applications/me");
    return res.data?.data || [];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getMyApplication(applicationId) {
  try {
    const res = await api.get(`/benefit-applications/me/${applicationId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * Submits a benefit application. `documents` is an array of
 * { file, documentType } — documentType must be one of the backend's
 * DOCUMENT_TYPES values so it can be matched against the program's
 * requiredDocumentTypes.
 */
export async function applyForBenefit({ benefitProgramId, documents = [] }) {
  try {
    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({ benefitProgramId, documentTypes: documents.map((d) => d.documentType) })
    );
    documents.forEach((d) => formData.append("documents", d.file));

    const res = await api.post("/benefit-applications", formData);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
