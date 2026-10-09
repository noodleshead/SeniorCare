import { api, toApiError } from "../utils/api.js";

/**
 * POST /api/auth/login
 *
 * Backend: auth.routes.js -> auth.controller.js#login -> auth.service.js#login
 * Backend expects { emailOrUsername, password } (see auth.validator.js
 * loginSchema) — the login page's own field is called `identifier`, so
 * the mapping happens here, once, rather than renaming the UI field.
 *
 * On success the backend also sets an httpOnly refresh-token cookie
 * (scoped to /api/auth) via `withCredentials: true` on the shared `api`
 * instance — nothing to do here for that part.
 *
 * Returns: { accessToken, user: { id, email, role, status } }
 * Throws: normalized ApiError { status, code, message, fieldErrors }
 *   - code "AUTHENTICATION_ERROR"           -> invalid credentials
 *   - code "ACCOUNT_PENDING_VERIFICATION"   -> registered, not yet approved
 *   - code "ACCOUNT_INACTIVE"               -> deactivated account
 *   - code "ACCOUNT_REJECTED"               -> registration was rejected
 *   - code "ACCOUNT_NOT_ACTIVE"             -> defensive fallback status
 *   - code "NETWORK_ERROR"                  -> couldn't reach the server
 */
export async function login({ identifier, password }) {
  try {
    const res = await api.post("/auth/login", {
      emailOrUsername: identifier,
      password,
    });
    // Backend responds { success: true, message, data: { accessToken, user } }
    return res.data.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * POST /api/auth/logout
 * Clears the httpOnly refresh cookie server-side. Access token removal
 * from client storage is the caller's responsibility (see clearSession).
 */
export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * GET /api/auth/me
 * Re-fetches the authenticated user's profile from the backend — used to
 * get fields not included in the login response (e.g. a Barangay Staff
 * member's resolved `barangayName`, which login() doesn't return but
 * auth.service.js#getAuthenticatedUser does). Always resolved from the
 * authenticated user's own DB record — never trusts anything the client
 * previously stored.
 */
export async function getMe() {
  try {
    const res = await api.get("/auth/me");
    return res.data.user;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Backend: auth.routes.js -> auth.controller.js#forgotPassword ->
 * auth.service.js#requestPasswordReset. Always resolves the same way
 * whether or not the account exists (no enumeration) in production.
 *
 * Outside production, the backend has no email service configured (see
 * auth.controller.js's own comment) and includes `devOnlyResetToken` /
 * `devOnlyNote` directly in the response so the flow can be completed
 * without a real inbox — ForgotPassword.jsx surfaces that clearly to
 * whoever is testing, rather than silently using it.
 */
export async function requestPasswordReset(email) {
  try {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * POST /api/auth/reset-password
 * Backend: auth.controller.js#resetPassword -> auth.service.js#resetPassword.
 */
export async function resetPassword({ token, newPassword }) {
  try {
    const res = await api.post("/auth/reset-password", { token, newPassword });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---- Minimal client-side session storage ----
// No auth context/store exists yet in this project. Kept intentionally
// small and swappable: if the project later adds a real AuthContext or
// state manager, only these three functions need to change — callers
// (Login.jsx, api.js request interceptor, protected routes) shouldn't
// need to know how the token is actually stored.

const ACCESS_TOKEN_KEY = "seniorcare_access_token";

export function storeSession({ accessToken, user }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem("seniorcare_user", JSON.stringify(user));
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem("seniorcare_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem("seniorcare_user");
}

// Role -> route map. Routes are not yet implemented in App.jsx
// (Dashboard/Profile are commented out there) — this only decides
// *where* Login.jsx should navigate once those pages exist; it does not
// create them.
export const ROLE_DASHBOARD_ROUTES = {
  SENIOR_CITIZEN: "/senior/dashboard",
  GUARDIAN: "/guardian/dashboard",
  BARANGAY_STAFF: "/barangay/dashboard",
  ADMIN: "/admin/dashboard",
  // Phase 8: LGU-OSCA lands on the multi-barangay analytics dashboard.
  // The registration verification queue previously used as its home is
  // unchanged and still reachable at /lgu/dashboard via the sidebar's
  // "Senior Verification" item.
  LGU_OSCA: "/senior-analytics",
};
