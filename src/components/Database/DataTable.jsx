import { memo, useState } from "react";
import StatusBadge from "./StatusBadge";

/** Rows rendered initially / added per "Show more" click. Keeps huge sheets smooth. */
const ROW_CHUNK = 150;

/**
 * Premium read-only data table with per-column filter inputs.
 *
 * `rowActions` = array of { label, icon, title, variant?, onClick(row) } rendered
 * in an Actions column. `statusColumns` headers render as coloured status badges.
 * `leadingColumns` = array of { header, render(row) } custom cells rendered
 * before the data columns (no filter input) — e.g. a document-status badge.
 *
 * Memoized: with stable callbacks/actions from the parent it skips re-rendering
 * when unrelated state (status banners, etc.) changes.
 */
function DataTable({
  headers,
  rows,
  filters,
  onFilterChange,
  rowActions = [],
  statusColumns = [],
  leadingColumns = [],
}) {
  const hasActions = rowActions.length > 0;
  const isStatus = (h) => statusColumns.includes(h);

  // Incremental rendering: large datasets paint the first chunk instantly and
  // grow on demand. Reset whenever the row set changes (search/filter/reload).
  const [limit, setLimit] = useState(ROW_CHUNK);
  const [prevRows, setPrevRows] = useState(rows);
  if (prevRows !== rows) {
    setPrevRows(rows);
    setLimit(ROW_CHUNK);
  }
  const shownRows = rows.length > limit ? rows.slice(0, limit) : rows;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {hasActions && (
              <th className="th-action">
                <div className="th-label">Actions</div>
              </th>
            )}
            {leadingColumns.map((col) => (
              <th key={`lead-${col.header}`} className="th-lead">
                <div className="th-label">{col.header}</div>
              </th>
            ))}
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
          {shownRows.map((row, ri) => (
            <tr key={ri}>
              {hasActions && (
                <td className="td-action">
                  <div className="row-actions">
                    {rowActions.map((action, ai) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={ai}
                          className={`btn btn-xs ${action.variant === "danger" ? "btn-danger-soft" : "btn-soft"}`}
                          onClick={() => action.onClick(row)}
                          title={action.title || action.label}
                        >
                          {Icon && <Icon size={14} />} {action.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              )}
              {leadingColumns.map((col) => (
                <td key={`lead-${col.header}`} className="td-lead">
                  {col.render(row)}
                </td>
              ))}
              {headers.map((h, ci) =>
                isStatus(h) ? (
                  <td key={ci} className="td-status">
                    <StatusBadge value={row[ci]} />
                  </td>
                ) : (
                  <td key={ci} title={String(row[ci] ?? "")}>
                    {String(row[ci] ?? "")}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shownRows.length && (
        <div className="table-more">
          <span>
            Showing {shownRows.length} of {rows.length} records
          </span>
          <button className="btn btn-soft btn-xs" onClick={() => setLimit((v) => v + ROW_CHUNK * 2)}>
            Show more
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(DataTable);
