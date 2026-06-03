/** Premium read-only data table with per-column filter inputs. */
export default function DataTable({ headers, rows, filters, onFilterChange }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
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
