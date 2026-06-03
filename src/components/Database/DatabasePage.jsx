import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Database as DatabaseIcon,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  Link2,
} from "lucide-react";
import DataTable from "./DataTable";
import { fetchPresetData } from "../../services/quotationService";
import { searchRows, filterRows, toCsv, downloadCsv } from "../../utils/tableData";
import { rowToFormValues } from "../../utils/rowMapping";

export default function DatabasePage({ presets, initialPresetId, onEditPreset, onLoadQuotation }) {
  const [presetId, setPresetId] = useState(initialPresetId || presets[0]?.id || "");
  const [data, setData] = useState({ headers: [], rows: [] });
  const [state, setState] = useState("idle"); // idle | loading | loaded | error | empty
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});

  const preset = presets.find((p) => p.id === presetId) || null;
  const isLinked = Boolean(preset?.googleSheetUrl);

  const load = useCallback(async () => {
    if (!preset) return;
    if (!preset.googleSheetUrl) {
      setState("idle");
      return;
    }
    setState("loading");
    setError("");
    try {
      const result = await fetchPresetData(preset);
      setData({ headers: result.headers || [], rows: result.rows || [] });
      setState((result.rows || []).length ? "loaded" : "empty");
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }, [preset]);

  // Auto-load whenever the load function changes (i.e. the preset changes).
  // Fetching the linked sheet is a legitimate effect→external-system sync;
  // load() flips a loading flag internally, which the rule conservatively flags.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Switching preset also clears the active search/filters.
  const handleSelectPreset = (id) => {
    setQuery("");
    setFilters({});
    setPresetId(id);
  };

  const visibleRows = useMemo(() => {
    const byFilter = filterRows(data.rows, data.headers, filters);
    return searchRows(byFilter, query);
  }, [data, filters, query]);

  const handleFilter = (header, value) =>
    setFilters((prev) => ({ ...prev, [header]: value }));

  // Load a saved row back into its preset's form for editing.
  const handleLoadRow = (row) => {
    if (!preset || !onLoadQuotation) return;
    const { values, quotationId, createdAt } = rowToFormValues(preset, data.headers, row);
    onLoadQuotation({ presetId: preset.id, values, quotationId, createdAt });
  };

  const exportCsv = () => {
    const name = `${preset?.name || "data"}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(name, toCsv(data.headers, visibleRows));
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Database</h1>
          <p className="screen-sub">Browse data saved to each preset's linked Google Sheet.</p>
        </div>
        <div className="head-actions">
          <select
            className="control preset-switch"
            value={presetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
          >
            {presets.length === 0 && <option value="">No presets</option>}
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-soft" onClick={load} disabled={!isLinked || state === "loading"}>
            <RefreshCw size={16} className={state === "loading" ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {!isLinked ? (
        <div className="empty-state">
          <Link2 size={26} />
          <p>This preset has no Google Sheet linked yet.</p>
          {preset && (
            <button className="btn btn-primary" onClick={() => onEditPreset(preset.id)}>
              Link a Google Sheet
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="db-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                className="search-input"
                value={query}
                placeholder="Search across all columns…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="btn btn-soft"
              onClick={exportCsv}
              disabled={visibleRows.length === 0}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>

          {state === "loading" && (
            <div className="db-state"><Loader2 size={20} className="spin" /> Loading data…</div>
          )}

          {state === "error" && (
            <div className="alert alert-error">
              <AlertCircle size={18} /> <span>{error}</span>
            </div>
          )}

          {state === "empty" && (
            <div className="empty-state">
              <DatabaseIcon size={26} />
              <p>No records found in this preset's sheet yet.</p>
            </div>
          )}

          {state === "loaded" && visibleRows.length === 0 && (
            <div className="empty-inline">No rows match your search/filters.</div>
          )}

          {state === "loaded" && visibleRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="db-count">
                {visibleRows.length} of {data.rows.length} records
              </div>
              <DataTable
                headers={data.headers}
                rows={visibleRows}
                filters={filters}
                onFilterChange={handleFilter}
                onLoadRow={onLoadQuotation ? handleLoadRow : undefined}
              />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
