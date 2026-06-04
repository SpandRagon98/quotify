import StatusBadge from "./StatusBadge";

/**
 * Premium read-only data table with per-column filter inputs.
 *
 * `rowActions` = array of { label, icon, title, variant?, onClick(row) } rendered
 * in an Actions column. `statusColumns` headers render as coloured status badges.
 */
export default function DataTable({
  headers,
  rows,
  filters,
  onFilterChange,
  rowActions = [],
  statusColumns = [],
}) {
  const hasActions = rowActions.length > 0;
  const isStatus = (h) => statusColumns.includes(h);

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
    </div>
  );
}
