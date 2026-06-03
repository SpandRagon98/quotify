import StatusBadge from "./StatusBadge";

/**
 * Premium read-only data table with per-column filter inputs.
 *
 * When `rowAction` is provided, an Actions column with a button is shown per row.
 * rowAction = { label, icon: IconComponent, title, onClick(row) }
 * `statusColumns` headers render as coloured status badges.
 */
export default function DataTable({
  headers,
  rows,
  filters,
  onFilterChange,
  rowAction,
  statusColumns = [],
}) {
  const ActionIcon = rowAction?.icon;
  const isStatus = (h) => statusColumns.includes(h);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {rowAction && (
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
              {rowAction && (
                <td className="td-action">
                  <button
                    className="btn btn-soft btn-xs"
                    onClick={() => rowAction.onClick(row)}
                    title={rowAction.title || rowAction.label}
                  >
                    {ActionIcon && <ActionIcon size={14} />} {rowAction.label}
                  </button>
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
