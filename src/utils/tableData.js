/**
 * Pure helpers for the Database table: search, per-column filtering, CSV export.
 * Rows are arrays of cell values aligned to `headers`.
 */

/** Free-text search across every cell. Returns matching row indexes preserved. */
export function searchRows(rows, query) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    row.some((cell) => String(cell ?? "").toLowerCase().includes(q))
  );
}

/**
 * Apply per-column "contains" filters.
 * @param {Array<Array>} rows
 * @param {string[]} headers
 * @param {Object<string,string>} filters - { [header]: substring }
 */
export function filterRows(rows, headers, filters) {
  const active = Object.entries(filters).filter(([, v]) => v && v.trim());
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every(([header, value]) => {
      const col = headers.indexOf(header);
      if (col === -1) return true;
      return String(row[col] ?? "").toLowerCase().includes(value.trim().toLowerCase());
    })
  );
}

/** Escape a single CSV cell. */
function csvCell(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Build a CSV string from headers + rows. */
export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  rows.forEach((row) => lines.push(row.map(csvCell).join(",")));
  return lines.join("\n");
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
