import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart, ClipboardCheck, LogOut, Menu, X, ShieldCheck, Building2, Users2, Wallet, HandHeart, Megaphone, Users, MessageSquareWarning, Map, BarChart3, History, Settings, UserCog, Stethoscope, ClipboardPlus, HeartHandshake } from "lucide-react";
import { logout as apiLogout, clearSession, getStoredUser } from "../../services/authService.js";
import { getPublicSettings } from "../../services/systemSettingsService.js";
import NotificationBell from "../../components/NotificationBell.jsx";
import LogoutConfirmDialog from "../../components/LogoutConfirmDialog.jsx";
import { COLORS, FONT_STACK } from "./theme.js";

const ROLE_LABELS = {
  BARANGAY_STAFF: "Barangay Staff",
  ADMIN: "Administrator",
  LGU_OSCA: "LGU-OSCA",
};

/**
 * Shared shell for the verification workflow's authenticated pages.
 * Nav items are role-aware: every authorized role sees "Senior
 * Verification" (the only feature staff needs); ADMIN additionally sees
 * "Barangay Management" and "Staff Management" — real, working sections,
 * not placeholders for unbuilt modules.
 */
export default function DashboardLayout({ children, title, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const isAdmin = user?.role === "ADMIN";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // System Settings' general.systemName is genuinely reflected here — not
  // just on the Settings page itself — via the public branding endpoint
  // (systemSettings.service.js#getPublicSettings). Falls back to the
  // static "SENIORCARE" name if the fetch hasn't resolved yet or fails.
  const [systemName, setSystemName] = useState("SENIORCARE");

  useEffect(() => {
    getPublicSettings().then((settings) => {
      if (settings?.systemName) setSystemName(settings.systemName);
    });
  }, []);

  const dashboardHome =
    user?.role === "ADMIN" ? "/admin/dashboard" : user?.role === "LGU_OSCA" ? "/lgu/dashboard" : "/barangay/dashboard";

  const navItems = [
    {
      to: dashboardHome,
      icon: ClipboardCheck,
      label: "Senior Verification",
      active: location.pathname === dashboardHome || location.pathname.startsWith("/verification/"),
    },
    {
      to: "/barangay-endorsement",
      icon: HeartHandshake,
      label: "Barangay Endorsement",
      active: location.pathname.startsWith("/barangay-endorsement"),
    },
    {
      to: "/pension-management",
      icon: Wallet,
      label: "Pension Management",
      active: location.pathname.startsWith("/pension-management"),
    },
    {
      to: "/benefits-management",
      icon: HandHeart,
      label: "Benefits & Assistance",
      active: location.pathname.startsWith("/benefits-management"),
    },
    {
      to: "/announcements-management",
      icon: Megaphone,
      label: "Announcements",
      active: location.pathname.startsWith("/announcements-management"),
    },
    {
      to: "/activities-management",
      icon: Users,
      label: "Social Activities",
      active: location.pathname.startsWith("/activities-management"),
    },
    {
      to: "/concerns-management",
      icon: MessageSquareWarning,
      label: "Reports / Concerns",
      active: location.pathname.startsWith("/concerns-management"),
    },
    {
      to: "/senior-analytics",
      icon: Map,
      label: "Senior Mapping & Analytics",
      active: location.pathname.startsWith("/senior-analytics"),
    },
    ...(isAdmin
      ? [
          {
            to: "/admin/users",
            icon: UserCog,
            label: "User Management",
            active: location.pathname.startsWith("/admin/users"),
          },
          {
            to: "/admin/reports",
            icon: BarChart3,
            label: "System Reports",
            active: location.pathname.startsWith("/admin/reports"),
          },
          {
            to: "/admin/audit-logs",
            icon: History,
            label: "Audit Logs",
            active: location.pathname.startsWith("/admin/audit-logs"),
          },
          {
            to: "/admin/illnesses",
            icon: Stethoscope,
            label: "Illness Database",
            active: location.pathname.startsWith("/admin/illnesses"),
          },
          {
            to: "/admin/medical-verification",
            icon: ClipboardPlus,
            label: "Medical Verification",
            active: location.pathname.startsWith("/admin/medical-verification"),
          },
          {
            to: "/admin/settings",
            icon: Settings,
            label: "System Settings",
            active: location.pathname.startsWith("/admin/settings"),
          },
          {
            to: "/admin/barangays",
            icon: Building2,
            label: "Barangay Management",
            active: location.pathname.startsWith("/admin/barangays"),
          },
          {
            to: "/admin/staff",
            icon: Users2,
            label: "Staff Management",
            active: location.pathname.startsWith("/admin/staff"),
          },
        ]
      : []),
  ];

  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      // Even if the network call fails, clear the local session so the
      // user isn't stuck "logged in" on a dead token.
    } finally {
      clearSession();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8f7]" style={{ fontFamily: FONT_STACK }}>
      {/* Mobile top bar */}
      <div
        className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-16 bg-white border-b"
        style={{ borderColor: COLORS.alabaster }}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 -ml-2 rounded-md"
          style={{ color: COLORS.yale }}
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center w-8 h-8 rounded-md"
            style={{ backgroundColor: COLORS.baltic }}
          >
            <Heart className="w-4 h-4 text-white" aria-hidden="true" />
          </span>
          <span className="font-bold" style={{ color: COLORS.yale }}>
            {systemName}
          </span>
        </div>
        <div className="flex items-center">
          <NotificationBell colors={COLORS} variant="dark" />
        </div>
      </div>

      <div className="flex">
        {/* Sidebar backdrop (mobile) */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 z-50 lg:z-0 h-screen lg:h-screen w-72 shrink-0 bg-white border-r flex flex-col transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
          style={{ borderColor: COLORS.alabaster }}
        >
          <div
            className="h-16 flex items-center justify-between px-5 border-b shrink-0"
            style={{ borderColor: COLORS.alabaster }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center w-9 h-9 rounded-md"
                style={{ backgroundColor: COLORS.baltic }}
              >
                <Heart className="w-5 h-5 text-white" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-tight" style={{ color: COLORS.yale }}>
                {systemName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-1"
              style={{ color: COLORS.yale }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-5 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  navigate(item.to);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[15px] font-semibold text-left transition-colors"
                style={
                  item.active
                    ? { backgroundColor: COLORS.baltic + "14", color: COLORS.yale }
                    : { color: "#475569" }
                }
              >
                <item.icon
                  className="w-5 h-5 shrink-0"
                  style={{ color: item.active ? COLORS.baltic : "#94a3b8" }}
                  aria-hidden="true"
                />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="px-4 py-4 border-t shrink-0" style={{ borderColor: COLORS.alabaster }}>
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: COLORS.cerulean }}
              >
                {(user?.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: COLORS.yale }}>
                  {user?.email || "Unknown user"}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {ROLE_LABELS[user?.role] || user?.role}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-[15px] font-semibold border hover:bg-slate-50 transition-colors"
              style={{ color: COLORS.yale, borderColor: COLORS.alabaster }}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Log Out
            </button>
          </div>
        </aside>

        {showLogoutConfirm && (
          <LogoutConfirmDialog
            colors={COLORS}
            loading={loggingOut}
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={handleLogout}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="hidden lg:flex justify-end mb-2">
            <NotificationBell colors={COLORS} variant="dark" />
          </div>
          {(title || subtitle) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight" style={{ color: COLORS.yale }}>
                  {title}
                </h1>
              )}
              {subtitle && <p className="text-[15px] text-slate-600 mt-1">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
