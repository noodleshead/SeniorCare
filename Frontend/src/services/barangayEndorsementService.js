import { api, toApiError } from "../utils/api.js";

// Barangay Verification / Home Visit / Endorsement — Barangay Staff
// (own barangay, enforced server-side) plus Admin/LGU-OSCA read-only.
// Action calls (verify/home-visit/endorsement) are rejected server-side
// for anyone but Barangay Staff, regardless of what this client sends.

export async function listQueue(params) {
  try {
    const res = await api.get("/barangay/endorsement", { params });
    return { items: res.data?.data || [], pagination: res.data?.pagination };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getSummary() {
  try {
    const res = await api.get("/barangay/endorsement/summary");
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getDetail(seniorId) {
  try {
    const res = await api.get(`/barangay/endorsement/${seniorId}`);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function recordVerification(seniorId, payload) {
  try {
    const res = await api.post(`/barangay/endorsement/${seniorId}/verification`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function recordHomeVisit(seniorId, payload) {
  try {
    const res = await api.post(`/barangay/endorsement/${seniorId}/home-visit`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function recordEndorsement(seniorId, payload) {
  try {
    const res = await api.post(`/barangay/endorsement/${seniorId}/endorsement`, payload);
    return res.data?.data;
  } catch (err) {
    throw toApiError(err);
  }
}
