import { useCallback, useEffect, useState } from "react";
import { Megaphone, Plus, X, Loader2, Search, Send, Archive, Trash2, Pencil, AlertTriangle } from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import { COLORS } from "./theme.js";
import { getStoredUser } from "../../services/authService.js";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
} from "../../services/announcementService.js";

const CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "PENSION", label: "Pension" },
  { value: "BENEFITS", label: "Benefits" },
  { value: "ASSISTANCE", label: "Assistance" },
  { value: "REQUIREMENTS", label: "Requirements" },
  { value: "PROGRAM", label: "Program" },
  { value: "BARANGAY", label: "Barangay" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "IMPORTANT", label: "Important" },
];

const AUDIENCE_OPTIONS = [
  { value: "ALL", label: "Everyone" },
  { value: "SENIOR_CITIZEN", label: "Senior Citizens" },
  { value: "GUARDIAN", label: "Guardians" },
  { value: "STAFF_ADMIN", label: "Staff & Admin" },
];

const STATUS_STYLE = {
  DRAFT: { label: "Draft", color: "#6b7280" },
  PUBLISHED: { label: "Published", color: "#2f7d43" },
  ARCHIVED: { label: "Archived", color: "#b8452f" },
};

const STATUS_FILTERS = ["", "DRAFT", "PUBLISHED", "ARCHIVED"];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { label: status, color: COLORS.baltic };
  return (
    <span
      className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: s.color + "1a", color: s.color }}
    >
      {s.label}
    </span>
  );
}

function AnnouncementFormModal({ initial, currentUser, onClose, onSaved }) {
  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "LGU_OSCA";
  const [form, setForm] = useState(
    initial || {
      title: "",
      content: "",
      category: "GENERAL",
      targetAudience: "ALL",
      scope: isAdmin ? "SYSTEM_WIDE" : "BARANGAY",
      isImportant: false,
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (initial?._id) {
        await updateAnnouncement(initial._id, form);
      } else {
        await createAnnouncement(form);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b-2" style={{ borderColor: COLORS.alabaster }}>
          <h3 className="text-lg font-extrabold" style={{ color: COLORS.yale }}>
            {initial?._id ? "Edit Announcement" : "Create Announcement"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: COLORS.yale }} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2 focus:outline-none focus-visible:ring-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>
              Content
            </label>
            <textarea
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={5}
              className="w-full px-3 py-2 rounded-md border-2 focus:outline-none focus-visible:ring-2"
              style={{ borderColor: COLORS.alabaster }}
              maxLength={5000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>
                Audience
              </label>
              <select
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: COLORS.yale }}>
                Scope
              </label>
              <select
                value={form.scope}
                onChange={(e) => update("scope", e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2"
                style={{ borderColor: COLORS.alabaster }}
              >
                <option value="SYSTEM_WIDE">System-wide (all Barangays)</option>
                <option value="BARANGAY">Specific Barangay(s)</option>
              </select>
              {form.scope === "BARANGAY" && (
                <p className="text-xs text-slate-500 mt-1">
                  Barangay selection defaults to your own; a full Barangay picker can be added here as the
                  Barangay Management module grows.
                </p>
              )}
            </div>
          )}
          {!isAdmin && (
            <p className="text-xs text-slate-500">
              This announcement will only be visible to your assigned Barangay.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.yale }}>
            <input
              type="checkbox"
              checked={form.isImportant}
              onChange={(e) => update("isImportant", e.target.checked)}
            />
            Mark as Important
          </label>
        </div>

        <div className="sticky bottom-0 bg-white flex justify-end gap-2 px-5 py-4 border-t-2" style={{ borderColor: COLORS.alabaster }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md font-bold border-2"
            style={{ borderColor: COLORS.alabaster, color: COLORS.yale }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !form.title.trim() || !form.content.trim()}
            className="px-4 py-2 rounded-md font-bold text-white disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: COLORS.baltic }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsManagementPage() {
  const currentUser = getStoredUser();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAnnouncements({ status: status || undefined, category: category || undefined, search: search || undefined })
      .then(setAnnouncements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, category, search]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleAction = async (action, id) => {
    setBusyId(id);
    try {
      if (action === "publish") await publishAnnouncement(id);
      if (action === "archive") await archiveAnnouncement(id);
      if (action === "delete") {
        if (!window.confirm("Delete this draft announcement? This cannot be undone.")) {
          setBusyId(null);
          return;
        }
        await deleteAnnouncement(id);
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout title="Announcements" subtitle="Create and manage notices for Seniors, Guardians, and Staff.">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 pr-3 py-2 rounded-md border-2 text-sm"
              style={{ borderColor: COLORS.alabaster }}
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-md border-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-md border-2 text-sm"
            style={{ borderColor: COLORS.alabaster }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s ? STATUS_STYLE[s].label : "All Statuses"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-bold text-white shrink-0"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create Announcement
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.cerulean }} aria-hidden="true" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center gap-2" style={{ borderColor: COLORS.alabaster }}>
          <Megaphone className="w-8 h-8" style={{ color: COLORS.cerulean }} aria-hidden="true" />
          <p className="font-bold" style={{ color: COLORS.yale }}>
            No announcements found.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 overflow-x-auto" style={{ borderColor: COLORS.alabaster }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2" style={{ borderColor: COLORS.alabaster }}>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Title</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Category</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Audience</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Status</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Date</th>
                <th className="px-4 py-3 font-bold" style={{ color: COLORS.yale }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((a) => (
                <tr key={a._id} className="border-b last:border-b-0" style={{ borderColor: COLORS.alabaster }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {a.isImportant && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />}
                      <span className="font-semibold" style={{ color: COLORS.yale }}>{a.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.category}</td>
                  <td className="px-4 py-3 text-slate-600">{a.targetAudience}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(a.publishedAt || a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(a);
                          setShowForm(true);
                        }}
                        disabled={a.status === "ARCHIVED"}
                        className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                        style={{ color: COLORS.baltic }}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      {a.status !== "PUBLISHED" && a.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          aria-label="Publish"
                          onClick={() => handleAction("publish", a._id)}
                          disabled={busyId === a._id}
                          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                          style={{ color: "#2f7d43" }}
                        >
                          <Send className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {a.status === "PUBLISHED" && (
                        <button
                          type="button"
                          aria-label="Archive"
                          onClick={() => handleAction("archive", a._id)}
                          disabled={busyId === a._id}
                          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                          style={{ color: "#b8452f" }}
                        >
                          <Archive className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {a.status === "DRAFT" && (
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => handleAction("delete", a._id)}
                          disabled={busyId === a._id}
                          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40"
                          style={{ color: "#b8452f" }}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AnnouncementFormModal
          initial={editing}
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </DashboardLayout>
  );
}
