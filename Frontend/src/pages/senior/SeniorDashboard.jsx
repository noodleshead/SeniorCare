import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Menu,
  X,
  Bell,
  UserCircle,
  LogOut,
  ShieldCheck,
  Clock,
  Ban,
  Wallet,
  HandHeart,
  ClipboardList,
  Megaphone,
  Users,
  HelpCircle,
  Phone,
  MapPin,
  Type,
  Contrast,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquareWarning,
} from "lucide-react";
import { getMyProfile, updateMyProfile } from "../../services/seniorService.js";
import PensionPanel from "./PensionPanel.jsx";
import BenefitsPanel from "./BenefitsPanel.jsx";
import ApplicationsPanel from "./ApplicationsPanel.jsx";
import AnnouncementsPanel from "./AnnouncementsPanel.jsx";
import NotificationsPanel from "./NotificationsPanel.jsx";
import ActivitiesPanel from "./ActivitiesPanel.jsx";
import ConcernsPanel from "./ConcernsPanel.jsx";
import NotificationBell from "../../components/NotificationBell.jsx";
import LogoutConfirmDialog from "../../components/LogoutConfirmDialog.jsx";
import { SeniorEditProfileDialog } from "../../components/EditProfileDialogs.jsx";
import { getStoredUser, logout, clearSession } from "../../services/authService.js";

/**
 * SENIORCARE — Senior Citizen Dashboard
 *
 * A single-scroll, plain-language "service portal" for the Senior
 * Citizen themselves — deliberately not a generic admin/SaaS dashboard.
 * Reuses the existing auth/session infrastructure (authService.js,
 * ProtectedRoute) and the shared SENIORCARE palette.
 *
 * Data comes from GET /api/seniors/me (senior.service.js), which the
 * backend always resolves from the authenticated user's own token — a
 * Senior can never see another Senior's information by tampering with
 * the URL, because there is no id in this URL or request to tamper with.
 *
 * Pension, Benefits & Assistance, Announcements, Notifications, and
 * Activities all have real backend modules (see PensionPanel.jsx /
 * BenefitsPanel.jsx / ApplicationsPanel.jsx / AnnouncementsPanel.jsx /
 * NotificationsPanel.jsx / ActivitiesPanel.jsx).
 */

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "pension", label: "My Pension" },
  { id: "benefits", label: "My Benefits" },
  { id: "applications", label: "My Applications" },
  { id: "announcements", label: "Announcements" },
  { id: "activities", label: "Activities" },
  { id: "concerns", label: "Report a Concern" },
  { id: "profile", label: "Profile" },
  { id: "help", label: "Help" },
];

const ACCOUNT_STATUS_COPY = {
  ACTIVE: {
    label: "Active and Verified",
    detail: "Your SENIORCARE account is verified and active.",
    icon: ShieldCheck,
    tone: "good",
  },
  PENDING_VERIFICATION: {
    label: "Pending Verification",
    detail: "Your barangay is still reviewing your registration.",
    icon: Clock,
    tone: "warn",
  },
  INACTIVE: {
    label: "Inactive",
    detail: "Your account is currently inactive. Please contact your barangay office.",
    icon: Ban,
    tone: "bad",
  },
  REJECTED: {
    label: "Registration Not Approved",
    detail: "Please contact your barangay office for more information.",
    icon: Ban,
    tone: "bad",
  },
};

// ---------- text-size scale (explicit class sets, not a global CSS zoom,
// so nothing overflows or overlaps as size increases) ----------
const TEXT_SCALES = {
  normal: {
    label: "Normal",
    greeting: "text-2xl sm:text-3xl",
    sectionTitle: "text-xl sm:text-2xl",
    cardTitle: "text-lg",
    body: "text-base",
    small: "text-sm",
    button: "text-base",
  },
  large: {
    label: "Large",
    greeting: "text-3xl sm:text-4xl",
    sectionTitle: "text-2xl sm:text-[28px]",
    cardTitle: "text-xl",
    body: "text-lg",
    small: "text-base",
    button: "text-lg",
  },
  xlarge: {
    label: "Extra Large",
    greeting: "text-4xl sm:text-5xl",
    sectionTitle: "text-3xl sm:text-[32px]",
    cardTitle: "text-2xl",
    body: "text-xl",
    small: "text-lg",
    button: "text-xl",
  },
};

const A11Y_STORAGE_KEY = "seniorcare_a11y_prefs";

function loadA11yPrefs() {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { textScale: "normal", highContrast: false };
    const parsed = JSON.parse(raw);
    return {
      textScale: TEXT_SCALES[parsed.textScale] ? parsed.textScale : "normal",
      highContrast: Boolean(parsed.highContrast),
    };
  } catch {
    return { textScale: "normal", highContrast: false };
  }
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

// ---------- reusable pieces ----------

function ServiceCard({ icon: Icon, title, description, cta, onClick, t, highContrast }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-xl border-2 p-5 sm:p-6 flex flex-col gap-3 focus:outline-none focus-visible:ring-4 transition-shadow hover:shadow-md w-full"
      style={{
        borderColor: highContrast ? COLORS.yale : COLORS.alabaster,
        boxShadow: "0 1px 2px rgba(22,66,91,0.06)",
      }}
    >
      <div
        className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: COLORS.baltic + "1a" }}
      >
        <Icon className="w-7 h-7" style={{ color: COLORS.baltic }} aria-hidden="true" />
      </div>
      <div>
        <h3 className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
          {title}
        </h3>
        <p className={`${t.body} text-slate-600 mt-1 leading-relaxed`}>{description}</p>
      </div>
      <span className={`${t.body} font-bold mt-1`} style={{ color: COLORS.cerulean }}>
        {cta} →
      </span>
    </button>
  );
}

function EmptyState({ icon: Icon, title, message, t }) {
  return (
    <div
      className="rounded-lg border-2 border-dashed p-6 sm:p-8 flex flex-col items-center text-center gap-2"
      style={{ borderColor: COLORS.alabaster }}
    >
      <Icon className="w-9 h-9 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
        {title}
      </p>
      <p className={`${t.body} text-slate-600 max-w-md`}>{message}</p>
    </div>
  );
}

function Section({ id, icon: Icon, title, children, t }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24 py-8 sm:py-10 border-t" style={{ borderColor: COLORS.alabaster }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.yale }}>
          <Icon className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <h2 id={`${id}-heading`} className={`${t.sectionTitle} font-extrabold`} style={{ color: COLORS.yale }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function SeniorDashboard() {
  const navigate = useNavigate();
  const storedUser = getStoredUser();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [a11y, setA11y] = useState(loadA11yPrefs);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const t = TEXT_SCALES[a11y.textScale];

  useEffect(() => {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(a11y));
  }, [a11y]);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyProfile()
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message || "We couldn't load your information."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Even if the server call fails (e.g. offline), still clear the
      // local session so the user isn't stuck "logged in" on this device.
    } finally {
      clearSession();
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const scrollToSection = useCallback((id) => {
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const greetingName = useMemo(() => {
    if (profile?.firstName) return profile.firstName;
    if (storedUser?.email) return storedUser.email.split("@")[0];
    return "there";
  }, [profile, storedUser]);

  const greetingPrefix = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const status = ACCOUNT_STATUS_COPY[profile?.accountStatus] || ACCOUNT_STATUS_COPY.ACTIVE;
  const StatusIcon = status.icon;

  const bodyTextClass = a11y.highContrast ? "text-slate-800" : "text-slate-600";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f6f8f7", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* ---------- Header ---------- */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: COLORS.yale, borderColor: COLORS.yale }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-white" aria-hidden="true" />
            <span className="text-white font-extrabold text-lg tracking-tight">SENIORCARE</span>
          </div>

          {/* Desktop nav */}
          <nav aria-label="Dashboard sections" className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`${t.small} font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded-md px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell colors={COLORS} />
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="hidden sm:flex items-center gap-2 rounded-md px-3 py-2.5 font-bold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span className={t.small}>Logout</span>
            </button>
            <button
              type="button"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((v) => !v)}
              className="lg:hidden w-11 h-11 rounded-md flex items-center justify-center hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {mobileNavOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNavOpen && (
          <nav aria-label="Dashboard sections" className="lg:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`${t.body} text-left font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded-md px-3 py-3`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className={`${t.body} text-left font-bold text-white flex items-center gap-2 rounded-md px-3 py-3 hover:bg-white/10`}
            >
              <LogOut className="w-5 h-5" aria-hidden="true" /> Logout
            </button>
          </nav>
        )}
      </header>

      <main id="home" className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* ---------- Loading ---------- */}
        {loading && (
          <div className="py-16 flex flex-col items-center text-center gap-3" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: COLORS.baltic }} aria-hidden="true" />
            <p className={`${t.body} font-semibold`} style={{ color: COLORS.yale }}>
              Loading your information...
            </p>
          </div>
        )}

        {/* ---------- Error ---------- */}
        {!loading && error && (
          <div className="py-10">
            <div className="rounded-lg border-2 p-6 flex flex-col items-center text-center gap-3" style={{ borderColor: "#e3a893", backgroundColor: "#fbeae6" }}>
              <AlertCircle className="w-8 h-8" style={{ color: "#b8452f" }} aria-hidden="true" />
              <p className={`${t.cardTitle} font-bold`} style={{ color: "#b8452f" }}>
                We couldn't load your information.
              </p>
              <p className={`${t.body} text-slate-700`}>Please check your connection and try again.</p>
              <button
                type="button"
                onClick={loadProfile}
                className={`${t.button} inline-flex items-center gap-2 font-bold text-white rounded-md px-5 py-3 focus:outline-none focus-visible:ring-4`}
                style={{ backgroundColor: COLORS.baltic }}
              >
                <RefreshCw className="w-5 h-5" aria-hidden="true" /> Try Again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ---------- Welcome / Accessibility bar ---------- */}
            <div className="pt-8 pb-6 flex flex-col gap-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h1 className={`${t.greeting} font-extrabold`} style={{ color: COLORS.yale }}>
                    {greetingPrefix}, {greetingName}
                  </h1>
                  <p className={`${t.body} ${bodyTextClass} mt-1`}>
                    Senior Citizen
                    {profile?.barangay?.name ? ` · Barangay ${profile.barangay.name}` : ""}
                  </p>
                </div>

                {/* Accessibility controls */}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Accessibility settings">
                  <span className="sr-only" id="text-size-label">Text size</span>
                  <div className="flex items-center gap-1 bg-white rounded-lg border-2 p-1" style={{ borderColor: COLORS.alabaster }}>
                    <Type className="w-4 h-4 ml-1.5" style={{ color: COLORS.yale }} aria-hidden="true" />
                    {Object.entries(TEXT_SCALES).map(([key, scale]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={a11y.textScale === key}
                        aria-labelledby="text-size-label"
                        onClick={() => setA11y((prev) => ({ ...prev, textScale: key }))}
                        className="text-sm font-bold rounded-md px-2.5 py-1.5 focus:outline-none focus-visible:ring-2"
                        style={{
                          backgroundColor: a11y.textScale === key ? COLORS.baltic : "transparent",
                          color: a11y.textScale === key ? "#fff" : COLORS.yale,
                        }}
                      >
                        {scale.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-pressed={a11y.highContrast}
                    onClick={() => setA11y((prev) => ({ ...prev, highContrast: !prev.highContrast }))}
                    className="flex items-center gap-2 bg-white rounded-lg border-2 px-3 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2"
                    style={{
                      borderColor: a11y.highContrast ? COLORS.yale : COLORS.alabaster,
                      color: COLORS.yale,
                      backgroundColor: a11y.highContrast ? COLORS.alabaster : "#fff",
                    }}
                  >
                    <Contrast className="w-4 h-4" aria-hidden="true" />
                    High Contrast
                  </button>
                </div>
              </div>

              {/* Account status */}
              <div
                className="rounded-xl border-2 p-5 sm:p-6 flex items-start gap-4"
                style={{
                  borderColor: status.tone === "good" ? "#bcdfc3" : status.tone === "warn" ? COLORS.sky : "#e3a893",
                  backgroundColor: status.tone === "good" ? "#eef8f0" : status.tone === "warn" ? COLORS.sky + "22" : "#fbeae6",
                }}
              >
                <StatusIcon
                  className="w-8 h-8 shrink-0 mt-0.5"
                  style={{ color: status.tone === "good" ? "#2f7d43" : status.tone === "warn" ? COLORS.baltic : "#b8452f" }}
                  aria-hidden="true"
                />
                <div>
                  <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
                    Account Status: {status.label}
                  </p>
                  <p className={`${t.body} ${bodyTextClass} mt-1`}>{status.detail}</p>
                </div>
              </div>
            </div>

            {/* ---------- My Barangay ---------- */}
            {profile?.barangay && (
              <div className="pb-6">
                <div className="rounded-xl border-2 p-5 sm:p-6 flex items-start gap-4 bg-white" style={{ borderColor: COLORS.alabaster }}>
                  <MapPin className="w-8 h-8 shrink-0" style={{ color: COLORS.cerulean }} aria-hidden="true" />
                  <div>
                    <p className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
                      My Barangay
                    </p>
                    <p className={`${t.cardTitle} font-bold mt-0.5`} style={{ color: COLORS.yale }}>
                      Barangay {profile.barangay.name}
                    </p>
                    <p className={`${t.body} ${bodyTextClass} mt-1`}>
                      Your registered barangay manages your senior citizen services.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ---------- Service cards ---------- */}
            <div className="pb-4">
              <h2 className={`${t.sectionTitle} font-extrabold mb-4`} style={{ color: COLORS.yale }}>
                My Services
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ServiceCard
                  icon={Wallet}
                  title="My Pension"
                  description="View your pension information and claiming schedule."
                  cta="View Pension"
                  onClick={() => scrollToSection("pension")}
                  t={t}
                  highContrast={a11y.highContrast}
                />
                <ServiceCard
                  icon={HandHeart}
                  title="My Benefits"
                  description="See assistance programs available to you."
                  cta="View Benefits"
                  onClick={() => scrollToSection("benefits")}
                  t={t}
                  highContrast={a11y.highContrast}
                />
                <ServiceCard
                  icon={ClipboardList}
                  title="My Applications"
                  description="Track the programs you've applied for."
                  cta="View Applications"
                  onClick={() => scrollToSection("applications")}
                  t={t}
                  highContrast={a11y.highContrast}
                />
                <ServiceCard
                  icon={Megaphone}
                  title="Announcements"
                  description="Read the latest news from your barangay."
                  cta="View Announcements"
                  onClick={() => scrollToSection("announcements")}
                  t={t}
                  highContrast={a11y.highContrast}
                />
                <ServiceCard
                  icon={Users}
                  title="Activities"
                  description="See upcoming senior citizen activities and events."
                  cta="View Activities"
                  onClick={() => scrollToSection("activities")}
                  t={t}
                  highContrast={a11y.highContrast}
                />
                <ServiceCard
                  icon={Bell}
                  title="Notifications"
                  description="Check updates about your account and applications."
                  cta="View Notifications"
                  onClick={() => scrollToSection("notifications")}
                  t={t}
                  highContrast={a11y.highContrast}
                />
              </div>
            </div>

            {/* ---------- My Pension ---------- */}
            <Section id="pension" icon={Wallet} title="My Pension" t={t}>
              <PensionPanel t={t} />
            </Section>

            {/* ---------- My Benefits ---------- */}
            <Section id="benefits" icon={HandHeart} title="My Benefits" t={t}>
              <BenefitsPanel t={t} />
            </Section>

            {/* ---------- My Applications ---------- */}
            <Section id="applications" icon={ClipboardList} title="My Applications" t={t}>
              <ApplicationsPanel t={t} />
            </Section>

            {/* ---------- Announcements ---------- */}
            <Section id="announcements" icon={Megaphone} title="Announcements" t={t}>
              <AnnouncementsPanel t={t} />
            </Section>

            {/* ---------- Activities ---------- */}
            <Section id="activities" icon={Users} title="Activities" t={t}>
              <ActivitiesPanel t={t} />
            </Section>

            {/* ---------- Report a Concern ---------- */}
            <Section id="concerns" icon={MessageSquareWarning} title="Report a Concern" t={t}>
              <ConcernsPanel t={t} />
            </Section>

            {/* ---------- Notifications ---------- */}
            <Section id="notifications" icon={Bell} title="Notifications" t={t}>
              <NotificationsPanel t={t} />
            </Section>

            {/* ---------- Profile ---------- */}
            <Section id="profile" icon={UserCircle} title="Profile" t={t}>
              {profile ? (
                <div className="bg-white rounded-xl border-2 p-5 sm:p-6" style={{ borderColor: COLORS.alabaster }}>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <ProfileField t={t} label="Full Name" value={[profile.firstName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(" ")} />
                    <ProfileField t={t} label="Senior Citizen ID" value={profile.seniorCitizenId || "Not yet issued"} />
                    <ProfileField t={t} label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
                    <ProfileField t={t} label="Age" value={profile.age != null ? `${profile.age} years old` : "—"} />
                    <ProfileField t={t} label="Sex" value={profile.sex} />
                    <ProfileField t={t} label="Civil Status" value={profile.civilStatus} />
                    <ProfileField t={t} label="Mobile Number" value={profile.mobileNumber} />
                    <ProfileField t={t} label="Email" value={profile.email || "—"} />
                    <ProfileField
                      t={t}
                      label="Address"
                      value={
                        profile.address
                          ? [profile.address.houseLotBlock, profile.address.street, profile.address.sitio, profile.address.purok, profile.address.municipality, profile.address.province]
                              .filter(Boolean)
                              .join(", ")
                          : "—"
                      }
                    />
                    <ProfileField t={t} label="Barangay" value={profile.barangay ? `Barangay ${profile.barangay.name}` : "—"} />
                  </dl>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className={`${t.small} text-slate-500`}>
                      You can correct your name, contact number, and address. Your Senior Citizen ID, birth date, and
                      barangay were verified by your barangay — contact your barangay office to change those.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowEditProfile(true)}
                      className="px-4 py-2 rounded-md text-sm font-bold text-white"
                      style={{ backgroundColor: COLORS.baltic }}
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState icon={UserCircle} title="Profile not available." message="Please try again later." t={t} />
              )}
            </Section>

            {/* ---------- Help ---------- */}
            <Section id="help" icon={HelpCircle} title="Need Help?" t={t}>
              <div className="rounded-xl border-2 p-5 sm:p-6" style={{ borderColor: COLORS.alabaster, backgroundColor: COLORS.yale }}>
                <p className={`${t.cardTitle} font-bold text-white`}>
                  If you need assistance with your account, documents, applications, or barangay services, contact your Barangay Office.
                </p>
                {profile?.barangay ? (
                  <div className={`${t.body} text-white/90 mt-4 flex items-start gap-2`}>
                    <Phone className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Barangay {profile.barangay.name}, {profile.barangay.municipality}
                      {profile.barangay.province ? `, ${profile.barangay.province}` : ""}. Please visit or call your barangay office for
                      contact details and office hours.
                    </span>
                  </div>
                ) : null}
              </div>
            </Section>
          </>
        )}
      </main>

      {showEditProfile && profile && (
        <SeniorEditProfileDialog
          initial={profile}
          submit={updateMyProfile}
          colors={COLORS}
          onClose={() => setShowEditProfile(false)}
          onSaved={(updated) => {
            setProfile(updated);
            setShowEditProfile(false);
          }}
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
    </div>
  );
}

function ProfileField({ t, label, value }) {
  return (
    <div>
      <dt className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
        {label}
      </dt>
      <dd className={`${t.body} font-semibold mt-0.5`} style={{ color: COLORS.yale }}>
        {value || "—"}
      </dd>
    </div>
  );
}
