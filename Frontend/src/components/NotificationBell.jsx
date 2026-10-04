import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

/**
 * Shared notification bell + dropdown panel.
 *
 * Used in both the Senior Dashboard header and the Staff/Admin
 * DashboardLayout header — the API it calls (notificationService.js)
 * always resolves notifications for the authenticated user, so this
 * component works unmodified for every role.
 *
 * `colors` accepts the caller's own palette object (both existing
 * headers already define one with the same SENIORCARE hex values) so
 * this stays visually consistent without introducing a new theme
 * source of truth.
 */
export default function NotificationBell({ colors, variant = "light" }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const refreshUnreadCount = useCallback(() => {
    getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const loadNotifications = useCallback(() => {
    setLoading(true);
    getMyNotifications({ limit: 10 })
      .then((data) => setNotifications(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  };

  const handleMarkOne = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent — bell state simply doesn't update on failure
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const iconColor = variant === "dark" ? colors.yale : "#ffffff";
  const hoverBg = variant === "dark" ? "rgba(22,66,91,0.08)" : "rgba(255,255,255,0.1)";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        onClick={handleToggle}
        className="relative w-11 h-11 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2"
        style={{ color: iconColor, backgroundColor: open ? hoverBg : "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = open ? hoverBg : "transparent")}
      >
        <Bell className="w-6 h-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ backgroundColor: "#dc2626" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-xl border-2 bg-white shadow-xl z-50 overflow-hidden"
          style={{ borderColor: colors.alabaster }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b-2"
            style={{ borderColor: colors.alabaster }}
          >
            <span className="font-bold" style={{ color: colors.yale }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: colors.baltic }}
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.cerulean }} aria-hidden="true" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className="px-4 py-3 border-b last:border-b-0 flex items-start gap-3"
                  style={{ borderColor: colors.alabaster, backgroundColor: n.read ? "transparent" : colors.baltic + "0a" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: colors.yale }}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      onClick={() => handleMarkOne(n._id)}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100"
                      style={{ color: colors.baltic }}
                    >
                      <Check className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
