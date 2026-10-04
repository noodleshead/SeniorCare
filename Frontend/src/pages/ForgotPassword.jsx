import { useState } from "react";
import { Heart, Mail, AlertCircle, Loader2, CheckCircle2, Info } from "lucide-react";
import { requestPasswordReset } from "../services/authService.js";

/**
 * Phase 1 bug fix: Login.jsx has always linked to "/forgot-password",
 * but no route or page for it existed anywhere in this project — the
 * link was simply dead. This page (and ResetPassword.jsx) complete an
 * otherwise-already-built backend flow (auth.routes.js's
 * /forgot-password and /reset-password were fully implemented and
 * validated, just unreachable from the UI).
 */

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

function focusRing(el, on) {
  el.style.boxShadow = on ? `0 0 0 3px ${COLORS.sky}55` : "none";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { message, devOnlyResetToken?, devOnlyNote? }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const data = await requestPasswordReset(email.trim());
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white antialiased" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b" style={{ borderColor: COLORS.alabaster }}>
        <div className="max-w-310 mx-auto px-5 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="flex items-center justify-center w-9 h-9 rounded-md" style={{ backgroundColor: COLORS.baltic }}>
              <Heart className="w-5 h-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: COLORS.yale }}>
              SENIORCARE
            </span>
          </a>
          <a href="/login" className="text-sm sm:text-[15px] font-semibold" style={{ color: COLORS.baltic }}>
            Back to Login
          </a>
        </div>
      </header>

      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 sm:px-8 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-[1.75rem] sm:text-3xl font-extrabold tracking-tight mb-2" style={{ color: COLORS.yale }}>
              Forgot Password
            </h1>
            <p className="text-[15px] text-slate-600 leading-relaxed">
              Enter the email address on your SENIORCARE account and we'll send you instructions to reset your password.
            </p>
          </div>

          {result ? (
            <div className="space-y-4">
              <div
                role="status"
                className="rounded-md border p-4 flex items-start gap-3"
                style={{ backgroundColor: COLORS.sky + "22", borderColor: COLORS.sky }}
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: COLORS.yale }} aria-hidden="true" />
                <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{result.message}</p>
              </div>

              {result.devOnlyResetToken && (
                <div className="rounded-md border p-4" style={{ backgroundColor: "#fff8e6", borderColor: "#e3c893" }}>
                  <div className="flex items-start gap-2 mb-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#8a6d1a" }} aria-hidden="true" />
                    <p className="text-xs font-semibold" style={{ color: "#8a6d1a" }}>
                      Development mode only — no email service is configured in this environment.
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{result.devOnlyNote}</p>
                  <a
                    href={`/reset-password?token=${encodeURIComponent(result.devOnlyResetToken)}`}
                    className="text-sm font-bold underline break-all"
                    style={{ color: COLORS.baltic }}
                  >
                    Continue to reset your password
                  </a>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-5">
                <label htmlFor="email" className="block text-[15px] font-semibold mb-1.5" style={{ color: COLORS.yale }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    className="w-full rounded-md border pl-11 pr-4 py-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-shadow"
                    style={{ borderColor: error ? "#b8452f" : COLORS.alabaster }}
                    onFocus={(e) => focusRing(e.target, true)}
                    onBlur={(e) => focusRing(e.target, false)}
                  />
                </div>
                {error && (
                  <p className="flex items-start gap-1.5 text-sm mt-1.5" style={{ color: "#b8452f" }}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-[15px] font-bold px-6 py-3.5 rounded-md text-white disabled:opacity-60"
                style={{ backgroundColor: COLORS.baltic }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Send Reset Instructions
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
