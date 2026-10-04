import axios from "axios";

// Single source of truth for the backend origin. Never hardcode
// http://localhost:5000 elsewhere in the app — read it from Vite's env.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_URL,
  // The backend's refresh token is an HttpOnly cookie scoped to /api/auth.
  // Registration itself doesn't need cookies, but keeping this consistent
  // across the client means auth-related calls (login, refresh, me) work
  // without a second axios instance.
  withCredentials: true,
});

// Attaches the stored access token (see authService.js storeSession) to
// every outgoing request, if one exists. Requests made before login (e.g.
// registration, the login call itself) simply have no token yet, so this
// is a no-op for them — nothing about existing unauthenticated flows changes.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("seniorcare_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalizes anything thrown by axios (validation errors, network errors,
// unexpected server responses) into one predictable shape the UI can
// always rely on: { message, code, fieldErrors }.
export function toApiError(error) {
  if (error.response) {
    const body = error.response.data || {};
    return {
      status: error.response.status,
      code: body.code || "SERVER_ERROR",
      message: body.message || "Something went wrong. Please try again.",
      fieldErrors: body.errors || null,
    };
  }
  if (error.request) {
    return {
      status: 0,
      code: "NETWORK_ERROR",
      message: "Cannot connect to the SENIORCARE server. Please check your connection and try again.",
      fieldErrors: null,
    };
  }
  return {
    status: 0,
    code: "CLIENT_ERROR",
    message: "Something went wrong while preparing your request. Please try again.",
    fieldErrors: null,
  };
}
