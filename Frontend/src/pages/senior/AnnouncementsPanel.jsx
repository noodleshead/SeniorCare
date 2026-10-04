import { useCallback, useEffect, useState } from "react";
import { Megaphone, Loader2, AlertCircle, AlertTriangle, X, Search } from "lucide-react";
import { getMyAnnouncements } from "../../services/announcementService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const CATEGORY_LABELS = {
  GENERAL: "General",
  PENSION: "Pension",
  BENEFITS: "Benefits",
  ASSISTANCE: "Assistance",
  REQUIREMENTS: "Requirements",
  PROGRAM: "Program",
  BARANGAY: "Barangay",
  ACTIVITY: "Activity",
  IMPORTANT: "Important",
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
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
      <Megaphone className="w-8 h-8 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
        No announcements right now.
      </p>
      <p className={`${t.body} text-slate-600 max-w-md`}>
        Barangay notices, pension schedules, and program updates will appear here.
      </p>
    </div>
  );
}

function AnnouncementDetailDialog({ announcement, onClose, t }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <div>
            {announcement.isImportant && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-1.5" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                Important
              </span>
            )}
            <h3 className={`${t.cardTitle} font-extrabold`} style={{ color: COLORS.yale }}>
              {announcement.title}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: COLORS.baltic + "1a", color: COLORS.baltic }}>
              {CATEGORY_LABELS[announcement.category] || announcement.category}
            </span>
            <span className="text-xs text-slate-500">{formatDate(announcement.publishedAt)}</span>
          </div>
          <p className={`${t.body} text-slate-700 whitespace-pre-wrap`}>{announcement.content}</p>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsPanel({ t }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyAnnouncements({ search: search || undefined })
      .then(setAnnouncements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcements..."
          className={`${t.body} w-full pl-9 pr-3 py-2 rounded-md border-2 focus:outline-none focus-visible:ring-2`}
          style={{ borderColor: COLORS.alabaster }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600" role="alert">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
          <span className={t.body}>{error}</span>
        </div>
      ) : announcements.length === 0 ? (
        <EmptyBlock t={t} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {announcements.map((a) => (
            <button
              key={a._id}
              type="button"
              onClick={() => setSelected(a)}
              className="text-left bg-white rounded-xl border-2 p-4 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2"
              style={{ borderColor: a.isImportant ? "#fca5a5" : COLORS.alabaster }}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {a.isImportant && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    Important
                  </span>
                )}
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.baltic + "1a", color: COLORS.baltic }}>
                  {CATEGORY_LABELS[a.category] || a.category}
                </span>
              </div>
              <p className={`${t.cardTitle} font-bold mb-1`} style={{ color: COLORS.yale }}>
                {a.title}
              </p>
              <p className="text-sm text-slate-600 line-clamp-2 mb-2">{a.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{formatDate(a.publishedAt)}</span>
                <span className="text-xs font-bold" style={{ color: COLORS.baltic }}>
                  View Details →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <AnnouncementDetailDialog announcement={selected} onClose={() => setSelected(null)} t={t} />}
    </div>
  );
}
