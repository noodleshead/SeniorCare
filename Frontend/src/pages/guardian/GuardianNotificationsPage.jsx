import GuardianLayout from "./GuardianLayout.jsx";
import NotificationsPanel from "../senior/NotificationsPanel.jsx";

// Notifications are always scoped to the authenticated user's own id
// server-side (see notification.service.js) — a Guardian's
// notifications are already correctly isolated with zero backend
// changes, so the existing Senior-dashboard panel is reused verbatim
// rather than building a second one.
const T = { cardTitle: "text-lg", body: "text-base" };

export default function GuardianNotificationsPage() {
  return (
    <GuardianLayout title="Notifications" subtitle="Updates relevant to you and the Seniors you manage.">
      <NotificationsPanel t={T} />
    </GuardianLayout>
  );
}
