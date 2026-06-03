import { SquarePen } from "lucide-react";

/**
 * Premium read-only data table with per-column filter inputs.
 * When `onLoadRow` is provided, an Actions column with a "Load" button is shown
 * so a saved quotation can be loaded back into its form for editing.
 */
export default function DataTable({ headers, rows, filters, onFilterChange, onLoadRow }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {onLoadRow && (
              <th className="th-action">
                <div className="th-label">Actions</div>
              </th>
            )}
            {headers.map((h) => (
              <th key={h}>
                <div className="th-label">{h}</div>
                <input
                  className="th-filter"
                  value={filters[h] || ""}
                  placeholder="Filter…"
                  onChange={(e) => onFilterChange(h, e.target.value)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {onLoadRow && (
                <td className="td-action">
                  <button
                    className="btn btn-soft btn-xs"
                    onClick={() => onLoadRow(row)}
                    title="Load this quotation into the form for editing"
                  >
                    <SquarePen size={14} /> Load
                  </button>
                </td>
              )}
              {headers.map((h, ci) => (
                <td key={ci} title={String(row[ci] ?? "")}>
                  {String(row[ci] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
