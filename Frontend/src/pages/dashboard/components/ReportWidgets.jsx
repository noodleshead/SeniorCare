import { COLORS } from "../theme.js";

/**
 * Shared, dependency-free report/chart building blocks. Originally built
 * for Senior Mapping & Barangay Analytics (SeniorAnalyticsPage.jsx);
 * Admin System Reports (AdminReportsPage.jsx) reuses these rather than
 * duplicating them, since both pages need the exact same kind of
 * summary cards / bar lists / donut splits — no charting library exists
 * in this project (checked package.json), and one isn't justified for
 * this handful of simple shapes.
 */

export function SummaryCard({ icon: Icon, label, value, sub, color = COLORS.baltic }) {
  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: COLORS.alabaster }}>
      <div className="flex items-center gap-3 mb-2">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "1a" }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-extrabold" style={{ color: COLORS.yale }}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export function EmptyNote({ text }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{text}</p>;
}

// Plain horizontal bar list — see file header for why no chart library.
export function BarList({ items, colorFor, emptyText = "No records yet in this scope." }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.every((i) => i.count === 0)) {
    return <EmptyNote text={emptyText} />;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="font-bold" style={{ color: COLORS.yale }}>
              {item.count}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.count / max) * 100}%`, backgroundColor: colorFor ? colorFor(item) : COLORS.cerulean }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Two-segment donut built from plain SVG stroke-dasharray.
export function SplitDonut({ segments, total, emptyText = "No records yet in this scope." }) {
  if (!total) return <EmptyNote text={emptyText} />;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width="110" height="110" viewBox="0 0 100 100" className="shrink-0" role="img" aria-label="Distribution chart">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={COLORS.alabaster} strokeWidth="14" />
        {segments.map((seg) => {
          const fraction = seg.count / total;
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={seg.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-600">{seg.label}</span>
            <span className="font-bold" style={{ color: COLORS.yale }}>
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Section({ title, subtitle, action, children }) {
  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: COLORS.alabaster }}>
      <div className="flex items-start justify-between gap-3 mb-0.5">
        <h3 className="text-base font-bold" style={{ color: COLORS.yale }}>
          {title}
        </h3>
        {action}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

export const APPLICATION_STATUS_LABELS = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ENDORSED: "Endorsed",
  APPROVED: "Approved",
  RELEASED: "Released",
  CLAIMED: "Claimed",
  REJECTED: "Rejected",
};
