// No CSV/report-export library exists anywhere in this project (checked
// package.json) — a full dependency isn't justified for building a
// handful of flat, tabular CSV exports, so this is a small, dependency-
// free builder instead.

function escapeCsvCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a CSV string from a flat array of objects.
 * `columns`: [{ key, label }] — controls column order/headers explicitly
 * rather than relying on object key order.
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(","));
  return [header, ...lines].join("\r\n");
}

export function sendCsv(res, filename, csvContent) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // Leading BOM so Excel opens UTF-8 CSVs (barangay/senior names) correctly.
  res.send("\uFEFF" + csvContent);
}
