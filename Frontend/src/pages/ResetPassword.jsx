import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Heart, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { resetPassword } from "../services/authService.js";

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

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const errs = {};
    if (!newPassword) errs.newPassword = "Please enter a new password.";
    else if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters.";
    else if (!/[A-Z]/.test(newPassword)) errs.newPassword = "Password must contain at least one uppercase letter.";
    else if (!/\d/.test(newPassword)) errs.newPassword = "Password must contain at least one number.";
    if (confirmPassword !== newPassword) errs.confirmPassword = "Passwords do not match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!token) {
      setSubmitError("This password reset link is missing its token. Please request a new one.");
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.message || "Unable to reset your password. Please try again.");
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
          {success ? (
            <div>
              <div className="mb-6 rounded-md border p-4 flex items-start gap-3" style={{ backgroundColor: COLORS.sky + "22", borderColor: COLORS.sky }}>
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: COLORS.yale }} aria-hidden="true" />
                <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
                  Your password has been reset. You may now log in with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-center text-[15px] font-bold px-6 py-3.5 rounded-md text-white"
                style={{ backgroundColor: COLORS.baltic }}
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-[1.75rem] sm:text-3xl font-extrabold tracking-tight mb-2" style={{ color: COLORS.yale }}>
                  Reset Password
                </h1>
                <p className="text-[15px] text-slate-600 leading-relaxed">Enter a new password for your SENIORCARE account.</p>
              </div>

              {submitError && (
                <div role="alert" className="rounded-md border p-4 flex items-start gap-3 mb-6" style={{ backgroundColor: "#fbeae6", borderColor: "#e3a893" }}>
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#b8452f" }} aria-hidden="true" />
                  <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{submitError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-5">
                  <label htmlFor="newPassword" className="block text-[15px] font-semibold mb-1.5" style={{ color: COLORS.yale }}>
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Enter your new password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setFieldErrors((f) => ({ ...f, newPassword: undefined }));
                      }}
                      className="w-full rounded-md border pl-4 pr-12 py-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-shadow"
                      style={{ borderColor: fieldErrors.newPassword ? "#b8452f" : COLORS.alabaster }}
                      onFocus={(e) => focusRing(e.target, true)}
                      onBlur={(e) => focusRing(e.target, false)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">At least 8 characters, one uppercase letter, and one number.</p>
                  {fieldErrors.newPassword && (
                    <p className="flex items-start gap-1.5 text-sm mt-1.5" style={{ color: "#b8452f" }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      {fieldErrors.newPassword}
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label htmlFor="confirmPassword" className="block text-[15px] font-semibold mb-1.5" style={{ color: COLORS.yale }}>
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
                    }}
                    className="w-full rounded-md border pl-4 pr-4 py-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-shadow"
                    style={{ borderColor: fieldErrors.confirmPassword ? "#b8452f" : COLORS.alabaster }}
                    onFocus={(e) => focusRing(e.target, true)}
                    onBlur={(e) => focusRing(e.target, false)}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="flex items-start gap-1.5 text-sm mt-1.5" style={{ color: "#b8452f" }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      {fieldErrors.confirmPassword}
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
                  Reset Password
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
