import { LogOut, Loader2 } from "lucide-react";

// One shared confirmation dialog for the "Are you sure you want to log
// out?" prompt (Phase 1 fix — previously logout happened immediately on
// click, with no confirmation, across every role's layout). Used by
// DashboardLayout.jsx (Barangay Staff / Admin / LGU-OSCA),
// GuardianLayout.jsx, and SeniorDashboard.jsx so all roles get the exact
// same dialog rather than three slightly-different ad hoc modals.
//
// Colors are passed in rather than imported, since each of those three
// files already defines/imports its own COLORS constant with the same
// values (existing convention in this project — see theme.js and the
// locally-defined COLORS in Login.jsx/Register.jsx) — this avoids
// coupling this shared component to any one of them.
export default function LogoutConfirmDialog({ colors, onCancel, onConfirm, loading = false }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
    >
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: (colors?.sky || "#81c3d7") + "33" }}
          >
            <LogOut className="w-5 h-5" style={{ color: colors?.yale || "#16425b" }} aria-hidden="true" />
          </span>
          <h3 id="logout-confirm-title" className="text-base font-bold pt-2" style={{ color: colors?.yale || "#16425b" }}>
            Are you sure you want to log out?
          </h3>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-semibold border disabled:opacity-50"
            style={{ borderColor: colors?.alabaster || "#d9dcd6", color: colors?.yale || "#16425b" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-bold text-white flex items-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: colors?.baltic || "#2f6690" }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Confirm Logout
          </button>
        </div>
      </div>
    </div>
  );
}
