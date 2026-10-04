import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Clock,
  Ban,
  UsersRound,
  Building2,
  Loader2,
} from "lucide-react";
import {
  login,
  storeSession,
  ROLE_DASHBOARD_ROUTES,
} from "../services/authService.js";

/**
 * SENIORCARE — Login Page
 * Shares the exact design system established by the Landing Page and
 * Registration Page: palette, type scale, input/button treatment,
 * border/radius style, and iconography.
 *
 * Single unified login form. No role selection. Role/status is resolved
 * after authentication and drives redirect + state messaging.
 */

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

// Backend AccountStatusError/AuthenticationError codes (see auth.service.js)
// mapped to this page's existing authState values. ACCOUNT_REJECTED and
// ACCOUNT_NOT_ACTIVE reuse the "inactive" visual treatment since no
// separate design exists for them yet — the backend's own message is
// still shown, so the user isn't told something inaccurate.
const STATUS_TO_AUTH_STATE = {
  AUTHENTICATION_ERROR: "invalid",
  ACCOUNT_PENDING_VERIFICATION: "pending",
  ACCOUNT_INACTIVE: "inactive",
  ACCOUNT_REJECTED: "inactive",
  ACCOUNT_NOT_ACTIVE: "inactive",
};

// ---------- shared field components (mirrors registration page styling) ----------

function FieldLabel({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[15px] font-semibold mb-1.5"
      style={{ color: COLORS.yale }}
    >
      {children}
    </label>
  );
}

function focusRing(el, on) {
  el.style.boxShadow = on ? `0 0 0 3px ${COLORS.sky}55` : "none";
}

function AuthMessage({ variant, title, children }) {
  const styles = {
    error: {
      bg: "#fbeae6",
      border: "#e3a893",
      icon: AlertCircle,
      iconColor: "#b8452f",
    },
    pending: {
      bg: COLORS.sky + "22",
      border: COLORS.sky,
      icon: Clock,
      iconColor: COLORS.yale,
    },
    inactive: {
      bg: "#f1f1ee",
      border: COLORS.alabaster,
      icon: Ban,
      iconColor: COLORS.yale,
    },
  };
  const s = styles[variant];
  const Icon = s.icon;
  return (
    <div
      role="alert"
      className="rounded-md border p-4 flex items-start gap-3 mb-6"
      style={{ backgroundColor: s.bg, borderColor: s.border }}
    >
      <Icon
        className="w-5 h-5 shrink-0 mt-0.5"
        style={{ color: s.iconColor }}
        aria-hidden="true"
      />
      <div>
        {title && (
          <p
            className="text-[15px] font-bold mb-1"
            style={{ color: COLORS.yale }}
          >
            {title}
          </p>
        )}
        <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
          {children}
        </p>
      </div>
    </div>
  );
}

// ---------- main component ----------

export default function SeniorCareLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [authState, setAuthState] = useState("idle"); // idle | loading | invalid | pending | inactive | success
  // Backend-provided message shown inside the AuthMessage banner. Falls
  // back to a sensible default per variant if the backend didn't send one
  // (e.g. a network failure has no server message at all).
  const [authMessage, setAuthMessage] = useState("");

  const validate = () => {
    const errs = {};
    if (!identifier.trim())
      errs.identifier = "Please enter your email";
    if (!password) errs.password = "Please enter your password.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (authState === "loading") return;
    if (!validate()) return;

    setAuthState("loading");

    try {
      const { accessToken, user } = await login({ identifier, password });
      storeSession({ accessToken, user });
      setAuthState("idle"); // clear any prior error banner
      const destination = ROLE_DASHBOARD_ROUTES[user.role] || "/";
      navigate(destination);
    } catch (err) {
      // err is a normalized ApiError: { status, code, message, fieldErrors }
      const mappedState = STATUS_TO_AUTH_STATE[err.code] || "invalid";
      setAuthMessage(err.message || "Invalid email or password.");
      setAuthState(mappedState);
    }
  };

  const isLoading = authState === "loading";

  return (
    <div
      className="min-h-screen bg-white antialiased"
      style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      {/* Header — consistent with landing/registration */}
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
            href="/register"
            className="text-sm sm:text-[15px] font-semibold text-right"
            style={{ color: COLORS.baltic }}
          >
            Need an account?{" "}
            <span className="underline">Register as Senior Citizen</span>
          </a>
        </div>
      </header>

      <main className="min-h-[calc(100vh-72px)] grid lg:grid-cols-2">
        {/* Form panel */}
        <div className="flex items-center justify-center px-5 sm:px-8 py-12 sm:py-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1
                className="text-[1.75rem] sm:text-3xl font-extrabold tracking-tight mb-2"
                style={{ color: COLORS.yale }}
              >
                Welcome Back
              </h1>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Sign in to access your SENIORCARE account and the services
                available to you.
              </p>
            </div>

            {authState === "invalid" && (
              <AuthMessage variant="error">
                {authMessage || "Invalid email or password."}
              </AuthMessage>
            )}
            {authState === "pending" && (
              <AuthMessage
                variant="pending"
                title="Account Pending Barangay Verification"
              >
                {authMessage ||
                  "Your registration has been submitted successfully, but your barangay has not yet completed verification. You will be able to access SENIORCARE after your account is approved and activated."}
              </AuthMessage>
            )}
            {authState === "inactive" && (
              <AuthMessage variant="inactive" title="Account Inactive">
                {authMessage ||
                  "Your SENIORCARE account is currently inactive. Please contact your barangay office for assistance."}
              </AuthMessage>
            )}

            {authState === "pending" || authState === "inactive" ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/"
                  className="flex-1 text-center text-[15px] font-semibold px-6 py-3.5 rounded-md border-2"
                  style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
                >
                  Return to Home
                </a>
                <button
                  type="button"
                  onClick={() => setAuthState("idle")}
                  className="flex-1 text-center text-[15px] font-semibold px-6 py-3.5 rounded-md text-white"
                  style={{ backgroundColor: COLORS.baltic }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-5">
                  <FieldLabel htmlFor="identifier">
                    Email
                  </FieldLabel>
                  <div className="relative">
                    <Mail
                      className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your email "
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setFieldErrors((f) => ({
                          ...f,
                          identifier: undefined,
                        }));
                      }}
                      className="w-full rounded-md border pl-11 pr-4 py-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-shadow"
                      style={{
                        borderColor: fieldErrors.identifier
                          ? "#b8452f"
                          : COLORS.alabaster,
                      }}
                      onFocus={(e) => focusRing(e.target, true)}
                      onBlur={(e) => focusRing(e.target, false)}
                    />
                  </div>
                  {fieldErrors.identifier && (
                    <p
                      className="flex items-start gap-1.5 text-sm mt-1.5"
                      style={{ color: "#b8452f" }}
                    >
                      <AlertCircle
                        className="w-4 h-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      {fieldErrors.identifier}
                    </p>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <a
                      href="/forgot-password"
                      className="text-sm font-semibold"
                      style={{ color: COLORS.baltic }}
                    >
                      Forgot Password?
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((f) => ({ ...f, password: undefined }));
                      }}
                      className="w-full rounded-md border pl-4 pr-12 py-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-shadow"
                      style={{
                        borderColor: fieldErrors.password
                          ? "#b8452f"
                          : COLORS.alabaster,
                      }}
                      onFocus={(e) => focusRing(e.target, true)}
                      onBlur={(e) => focusRing(e.target, false)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p
                      className="flex items-start gap-1.5 text-sm mt-1.5"
                      style={{ color: "#b8452f" }}
                    >
                      <AlertCircle
                        className="w-4 h-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-6 py-3.5 rounded-md text-white shadow-sm hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed transition-opacity"
                  style={{ backgroundColor: COLORS.baltic }}
                >
                  {isLoading ? (
                    <>
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        aria-hidden="true"
                      />
                      Signing you in...
                    </>
                  ) : (
                    "Login"
                  )}
                </button>
              </form>
            )}

            {authState !== "pending" && authState !== "inactive" && (
              <p className="text-center text-[15px] text-slate-600 mt-7">
                New to SENIORCARE?{" "}
                <a
                  href="/register"
                  className="font-semibold underline"
                  style={{ color: COLORS.baltic }}
                >
                  Register as Senior Citizen
                </a>
              </p>
            )}

            <div
              className="flex items-center gap-2.5 mt-8 pt-6 border-t"
              style={{ borderColor: COLORS.alabaster }}
            >
              <ShieldCheck
                className="w-5 h-5 shrink-0"
                style={{ color: COLORS.cerulean }}
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500">
                Your account information is kept secure and verified by your
                barangay.
              </p>
            </div>
          </div>
        </div>

        {/* Visual panel — consistent with landing page's community language */}
        <div
          className="hidden lg:flex items-center justify-center border-l relative overflow-hidden"
          style={{
            borderColor: COLORS.alabaster,
            backgroundImage: `url("https://plus.unsplash.com/premium_photo-1663089870095-c231a534ac31?q=80&w=1151&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Background overlay */}
          <div className="absolute inset-0 bg-white/85" />

          {/* Content */}
          <div className="max-w-sm px-10 text-center relative z-10">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: COLORS.baltic }}
            >
              <UsersRound className="w-8 h-8 text-white" aria-hidden="true" />
            </div>

            <h2
              className="text-xl font-bold mb-3"
              style={{ color: COLORS.yale }}
            >
              One account, all your SENIORCARE services.
            </h2>

            <p className="text-[15px] text-slate-600 leading-relaxed mb-8">
              Sign in to check your pension schedule, view benefits and
              announcements, track applications, and stay connected with your
              barangay.
            </p>

            <div
              className="flex items-center gap-3 bg-white rounded-lg border px-4 py-3.5 text-left"
              style={{ borderColor: COLORS.alabaster }}
            >
              <Building2
                className="w-5 h-5 shrink-0"
                style={{ color: COLORS.baltic }}
                aria-hidden="true"
              />

              <p className="text-sm font-medium" style={{ color: COLORS.yale }}>
                Connected directly to your barangay's records
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
