import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Heart,
  LayoutGrid,
  Users,
  Wallet,
  FileText,
  MessageSquareWarning,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  UserCircle,
} from "lucide-react";
import { logout as apiLogout, clearSession, getStoredUser } from "../../services/authService.js";
import { getManagedSeniors, getSelectedSeniorId, setSelectedSeniorId, getMyGuardianProfile, updateMyGuardianProfile } from "../../services/guardianService.js";
import NotificationBell from "../../components/NotificationBell.jsx";
import LogoutConfirmDialog from "../../components/LogoutConfirmDialog.jsx";
import { GuardianEditProfileDialog } from "../../components/EditProfileDialogs.jsx";
import { COLORS, FONT_STACK } from "../dashboard/theme.js";

const NAV_ITEMS = [
  { to: "/guardian/dashboard", icon: LayoutGrid, label: "Overview" },
  { to: "/guardian/seniors", icon: Users, label: "My Seniors" },
  { to: "/guardian/pension", icon: Wallet, label: "Pension" },
  { to: "/guardian/documents", icon: FileText, label: "Documents" },
  { to: "/guardian/concerns", icon: MessageSquareWarning, label: "Reports / Concerns" },
  { to: "/guardian/notifications", icon: Bell, label: "Notifications" },
];

/**
 * Shared shell for every Guardian page. Shows which managed Senior is
 * currently selected and lets the Guardian switch — purely a UX
 * convenience (see guardianService.js's selected-senior helpers): every
 * page underneath still re-verifies authorization against the real
 * authenticated Guardian on every request, this banner is never itself
 * trusted as access.
 */
export default function GuardianLayout({ children, title, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [seniors, setSeniors] = useState([]);
  const [selectedId, setSelectedIdState] = useState(getSelectedSeniorId());
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [guardianProfile, setGuardianProfile] = useState(null); // set when the Edit Profile dialog is open

  useEffect(() => {
    getManagedSeniors()
      .then((list) => {
        setSeniors(list);
        // Auto-select the only managed Senior, or restore a previously
        // selected one if it's still valid; never invent a selection
        // the Guardian doesn't actually have.
        const stored = getSelectedSeniorId();
        const stillValid = stored && list.some((s) => s._id === stored);
        if (stillValid) {
          setSelectedIdState(stored);
        } else if (list.length > 0) {
          setSelectedSeniorId(list[0]._id);
          setSelectedIdState(list[0]._id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedSenior = seniors.find((s) => s._id === selectedId) || null;

  const handleSelect = (seniorId) => {
    setSelectedSeniorId(seniorId);
    setSelectedIdState(seniorId);
    setSwitcherOpen(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiLogout();
    } finally {
      clearSession();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: FONT_STACK }}>
      {/* Mobile top bar */}
      <div
        className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: COLORS.yale }}
      >
        <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="p-2 -ml-2">
          <Menu className="w-6 h-6" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2 font-bold">
          <Heart className="w-5 h-5" aria-hidden="true" />
          SENIORCARE
        </div>
        <NotificationBell colors={COLORS} variant="dark" />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen w-72 shrink-0 z-50 lg:z-auto bg-white border-r-2 transition-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
          style={{ borderColor: COLORS.alabaster }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
            <div className="flex items-center gap-2 font-extrabold" style={{ color: COLORS.yale }}>
              <Heart className="w-6 h-6" style={{ color: COLORS.baltic }} aria-hidden="true" />
              SENIORCARE
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5" aria-label="Close menu">
              <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
            </button>
          </div>

          <div className="px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">Guardian</p>
            <p className="text-sm font-semibold px-1" style={{ color: COLORS.yale }}>{user?.email}</p>
          </div>

          <nav className="px-3 py-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold text-sm"
                  style={{
                    backgroundColor: active ? COLORS.baltic + "1a" : "transparent",
                    color: active ? COLORS.baltic : COLORS.yale,
                  }}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t-2" style={{ borderColor: COLORS.alabaster }}>
            <button
              type="button"
              onClick={() => getMyGuardianProfile().then(setGuardianProfile).catch(() => {})}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold text-sm w-full mb-1"
              style={{ color: COLORS.yale }}
            >
              <UserCircle className="w-5 h-5" aria-hidden="true" />
              Edit My Profile
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold text-sm w-full"
              style={{ color: "#b8452f" }}
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              Log Out
            </button>
          </div>
        </aside>

        {guardianProfile && (
          <GuardianEditProfileDialog
            initial={guardianProfile}
            submit={updateMyGuardianProfile}
            colors={COLORS}
            onClose={() => setGuardianProfile(null)}
            onSaved={() => setGuardianProfile(null)}
          />
        )}

        {showLogoutConfirm && (
          <LogoutConfirmDialog
            colors={COLORS}
            loading={loggingOut}
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={handleLogout}
          />
        )}

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="hidden lg:flex justify-end mb-2">
            <NotificationBell colors={COLORS} variant="dark" />
          </div>

          {/* Managing Senior banner */}
          <div className="relative mb-6">
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              disabled={seniors.length === 0}
              className="w-full text-left rounded-xl border-2 p-4 flex items-center justify-between gap-3 disabled:opacity-60"
              style={{ borderColor: COLORS.sky, backgroundColor: COLORS.sky + "1a" }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.baltic }}>Managing</p>
                {selectedSenior ? (
                  <>
                    <p className="font-extrabold text-lg" style={{ color: COLORS.yale }}>
                      {selectedSenior.firstName} {selectedSenior.lastName}
                    </p>
                    <p className="text-sm text-slate-600">
                      SC ID: {selectedSenior.seniorCitizenId}
                      {selectedSenior.barangay?.name && ` · ${selectedSenior.barangay.name}`}
                      {selectedSenior.bedridden && " · Bedridden"}
                    </p>
                  </>
                ) : (
                  <p className="font-semibold text-slate-500">No managed Seniors yet.</p>
                )}
              </div>
              {seniors.length > 1 && <ChevronDown className="w-5 h-5 shrink-0" style={{ color: COLORS.baltic }} aria-hidden="true" />}
            </button>

            {switcherOpen && seniors.length > 1 && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg border-2 shadow-lg z-30 overflow-hidden" style={{ borderColor: COLORS.alabaster }}>
                {seniors.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => handleSelect(s._id)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50"
                    style={{ color: COLORS.yale }}
                  >
                    {s.firstName} {s.lastName} <span className="text-slate-400">· {s.seniorCitizenId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(title || subtitle) && (
            <div className="mb-6">
              {title && <h1 className="text-2xl font-extrabold" style={{ color: COLORS.yale }}>{title}</h1>}
              {subtitle && <p className="text-slate-600 mt-1">{subtitle}</p>}
            </div>
          )}

          {typeof children === "function" ? children({ selectedSenior, seniors }) : children}
        </main>
      </div>
    </div>
  );
}
