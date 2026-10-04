import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getSystemSettings, updateSettingsSection } from "../../services/systemSettingsService.js";

function Toggle({ checked, onChange, label, id }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors shrink-0"
        style={{ backgroundColor: checked ? COLORS.baltic : "#cbd5e1" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}

function SettingsSection({ title, description, children, onSave, saving, savedMessage, error }) {
  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: COLORS.alabaster }}>
      <h3 className="text-base font-bold mb-0.5" style={{ color: COLORS.yale }}>
        {title}
      </h3>
      {description && <p className="text-xs text-slate-500 mb-4">{description}</p>}
      <div className="space-y-4">{children}</div>
      <div className="flex items-center gap-3 mt-5 pt-4 border-t" style={{ borderColor: COLORS.alabaster }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-md text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: COLORS.baltic }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Save Changes
        </button>
        {savedMessage && (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#2f7d43" }}>
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            {savedMessage}
          </span>
        )}
        {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#b8452f" }} aria-hidden="true" />
          <h3 className="text-base font-bold" style={{ color: COLORS.yale }}>
            {title}
          </h3>
        </div>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-semibold border"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm font-bold text-white"
            style={{ backgroundColor: "#b8452f" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Local draft state per section, so an edit in one section doesn't
  // require saving all sections at once (module requirement §23 —
  // section-level save, safer for configuration).
  const [general, setGeneral] = useState(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);
  const [registration, setRegistration] = useState(null);

  const [savingSection, setSavingSection] = useState(null);
  const [sectionMessages, setSectionMessages] = useState({});
  const [pendingConfirm, setPendingConfirm] = useState(null); // { section, payload, title, message, confirmLabel }

  useEffect(() => {
    getSystemSettings()
      .then((data) => {
        setSettings(data);
        setGeneral(data.general);
        setMaintenanceMode(data.maintenanceMode);
        setNotificationsEnabled(data.notifications.enabled);
        setApplicationsEnabled(data.applications.enabled);
        setRegistration(data.registration);
      })
      .catch((err) => setLoadError(err.message || "Unable to load system settings. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  async function save(section, payload) {
    setSavingSection(section);
    setSectionMessages((m) => ({ ...m, [section]: null }));
    try {
      const updated = await updateSettingsSection(section, payload);
      setSettings((s) => ({ ...s, ...(section === "maintenance" ? { maintenanceMode: updated.maintenanceMode } : { [section]: updated[section] }) }));
      setSectionMessages((m) => ({ ...m, [section]: { success: "Settings updated successfully." } }));
    } catch (err) {
      setSectionMessages((m) => ({ ...m, [section]: { error: err.message || "Unable to save settings. No changes were applied." } }));
    } finally {
      setSavingSection(null);
    }
  }

  function requestMaintenanceToggle(next) {
    setMaintenanceMode(next);
    if (next) {
      setPendingConfirm({
        section: "maintenance",
        payload: { maintenanceMode: true },
        title: "Enable Maintenance Mode?",
        message:
          "This will restrict normal Senior, Guardian, Barangay Staff, and LGU/OSCA access system-wide. Administrator access will remain available.",
        confirmLabel: "Enable",
        onCancelValue: false,
      });
    } else {
      save("maintenance", { maintenanceMode: false });
    }
  }

  function requestRegistrationToggle(key, next) {
    const nextRegistration = { ...registration, [key]: next };
    setRegistration(nextRegistration);
    if (!next) {
      const label = key === "seniorRegistrationEnabled" ? "Senior Registration" : "Guardian Registration";
      setPendingConfirm({
        section: "registration",
        payload: nextRegistration,
        title: `Disable ${label}?`,
        message: "New registrations of this type will no longer be accepted until re-enabled.",
        confirmLabel: "Disable",
        onCancelValue: { ...registration, [key]: true },
      });
    } else {
      save("registration", nextRegistration);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="System Settings" subtitle="Manage system-wide configuration and behavior.">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        </div>
      </DashboardLayout>
    );
  }

  if (loadError || !settings) {
    return (
      <DashboardLayout title="System Settings" subtitle="Manage system-wide configuration and behavior.">
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {loadError || "Unable to load system settings."}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="System Settings" subtitle="Manage system-wide configuration and behavior.">
      <div className="space-y-6">
        {/* General */}
        <SettingsSection
          title="General"
          description="System branding shown across the application (sidebar, and where relevant, the login/registration pages)."
          onSave={() => save("general", general)}
          saving={savingSection === "general"}
          savedMessage={sectionMessages.general?.success}
          error={sectionMessages.general?.error}
        >
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="systemName">
              System Name
            </label>
            <input
              id="systemName"
              type="text"
              value={general.systemName}
              onChange={(e) => setGeneral({ ...general, systemName: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="systemDescription">
              System Description
            </label>
            <input
              id="systemDescription"
              type="text"
              value={general.systemDescription}
              onChange={(e) => setGeneral({ ...general, systemDescription: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="contactEmail">
                Contact Email
              </label>
              <input
                id="contactEmail"
                type="email"
                value={general.contactEmail}
                onChange={(e) => setGeneral({ ...general, contactEmail: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="contactNumber">
                Contact Number
              </label>
              <input
                id="contactNumber"
                type="text"
                value={general.contactNumber}
                onChange={(e) => setGeneral({ ...general, contactNumber: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
              />
            </div>
          </div>
        </SettingsSection>

        {/* Maintenance Mode */}
        <SettingsSection
          title="System Status"
          description="While Maintenance Mode is ON, every authenticated action by Senior, Guardian, Barangay Staff, and LGU/OSCA accounts is blocked. Administrator access always remains available."
          onSave={() => save("maintenance", { maintenanceMode })}
          saving={savingSection === "maintenance"}
          savedMessage={sectionMessages.maintenance?.success}
          error={sectionMessages.maintenance?.error}
        >
          <Toggle id="maintenanceMode" label="Maintenance Mode" checked={maintenanceMode} onChange={requestMaintenanceToggle} />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          title="Notifications"
          description="Controls whether the system creates new in-app notifications for any event."
          onSave={() => save("notifications", { enabled: notificationsEnabled })}
          saving={savingSection === "notifications"}
          savedMessage={sectionMessages.notifications?.success}
          error={sectionMessages.notifications?.error}
        >
          <Toggle id="notificationsEnabled" label="Notifications" checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </SettingsSection>

        {/* Applications */}
        <SettingsSection
          title="Benefits / Applications"
          description="Controls whether Seniors and Guardians may submit new benefit/assistance applications. Applications already in the pipeline are unaffected."
          onSave={() => save("applications", { enabled: applicationsEnabled })}
          saving={savingSection === "applications"}
          savedMessage={sectionMessages.applications?.success}
          error={sectionMessages.applications?.error}
        >
          <Toggle id="applicationsEnabled" label="Accept New Applications" checked={applicationsEnabled} onChange={setApplicationsEnabled} />
        </SettingsSection>

        {/* Registration */}
        <SettingsSection
          title="Registration"
          description="Controls whether new Senior and/or Guardian registrations are accepted."
          onSave={() => save("registration", registration)}
          saving={savingSection === "registration"}
          savedMessage={sectionMessages.registration?.success}
          error={sectionMessages.registration?.error}
        >
          <Toggle
            id="seniorRegistrationEnabled"
            label="Senior Registration"
            checked={registration.seniorRegistrationEnabled}
            onChange={(v) => requestRegistrationToggle("seniorRegistrationEnabled", v)}
          />
          <Toggle
            id="guardianRegistrationEnabled"
            label="Guardian Registration"
            checked={registration.guardianRegistrationEnabled}
            onChange={(v) => requestRegistrationToggle("guardianRegistrationEnabled", v)}
          />
        </SettingsSection>
      </div>

      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmLabel={pendingConfirm.confirmLabel}
          onCancel={() => {
            if (pendingConfirm.section === "maintenance") setMaintenanceMode(false);
            else if (pendingConfirm.section === "registration") setRegistration(pendingConfirm.onCancelValue);
            setPendingConfirm(null);
          }}
          onConfirm={() => {
            save(pendingConfirm.section, pendingConfirm.payload);
            setPendingConfirm(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
