import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, AlertCircle, Check, CheckCheck } from "lucide-react";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/notificationService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function EmptyBlock({ t }) {
  return (
    <div
      className="rounded-lg border-2 border-dashed p-6 flex flex-col items-center text-center gap-2"
      style={{ borderColor: COLORS.alabaster }}
    >
      <Bell className="w-8 h-8 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
        You're all caught up.
      </p>
      <p className={`${t.body} text-slate-600 max-w-md`}>
        Updates about your applications, pension, and account will appear here.
      </p>
    </div>
  );
}

export default function NotificationsPanel({ t }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyNotifications({ limit: 50 })
      .then((data) => setNotifications(Array.isArray(data) ? data : data?.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkOne = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch {
      // silent — list simply doesn't update on failure
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600" role="alert">
        <AlertCircle className="w-5 h-5" aria-hidden="true" />
        <span className={t.body}>{error}</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return <EmptyBlock t={t} />;
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-sm font-bold"
            style={{ color: COLORS.baltic }}
          >
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            Mark all as read
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border-2 divide-y-2" style={{ borderColor: COLORS.alabaster }}>
        {notifications.map((n) => (
          <div
            key={n._id}
            className="flex items-start gap-3 px-4 py-3.5"
            style={{ backgroundColor: n.read ? "transparent" : COLORS.baltic + "0a" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: COLORS.sky + "40" }}
            >
              <Bell className="w-4.5 h-4.5" style={{ color: COLORS.baltic }} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`${t.body} font-bold`} style={{ color: COLORS.yale }}>
                {n.title}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
            </div>
            {!n.read && (
              <button
                type="button"
                aria-label="Mark as read"
                onClick={() => handleMarkOne(n._id)}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 mt-0.5"
                style={{ color: COLORS.baltic }}
              >
                <Check className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
