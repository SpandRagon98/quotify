import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Database as DatabaseIcon,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  Link2,
  SquarePen,
  Trash2,
} from "lucide-react";
import DataTable from "./DataTable";
import { useSheetData } from "../../hooks/useSheetData";
import { searchRows, filterRows, toCsv, downloadCsv } from "../../utils/tableData";
import { rowToFormValues } from "../../utils/rowMapping";
import { deleteQuotation } from "../../services/quotationService";
import { METADATA_COLUMNS } from "../../config/appConfig";

export default function DatabasePage({
  presets,
  initialPresetId,
  canDelete = false,
  onEditPreset,
  onLoadQuotation,
}) {
  const { presetId, setPresetId, preset, isLinked, data, state, error, reload } =
    useSheetData(presets, initialPresetId);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [notice, setNotice] = useState({ state: "idle", message: "" });

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

  // Delete a row from the linked Google Sheet (Owner/Admin only).
  const handleDeleteRow = async (row) => {
    const idIdx = data.headers.indexOf(METADATA_COLUMNS[0]); // "Quotation ID"
    const quotationId = idIdx === -1 ? "" : String(row[idIdx] ?? "");
    if (!quotationId) {
      setNotice({ state: "error", message: "This row has no Quotation ID — cannot delete." });
      return;
    }
    if (!window.confirm(`Delete quotation ${quotationId}? This removes it from the Google Sheet.`)) {
      return;
    }
    try {
      setNotice({ state: "working", message: `Deleting ${quotationId}…` });
      await deleteQuotation(preset, quotationId);
      setNotice({ state: "success", message: `Deleted ${quotationId}.` });
      await reload();
    } catch (err) {
      setNotice({ state: "error", message: err.message });
    }
  };

  const rowActions = [
    onLoadQuotation && {
      label: "Load",
      icon: SquarePen,
      title: "Load this quotation into the form for editing",
      onClick: handleLoadRow,
    },
    canDelete && {
      label: "Delete",
      icon: Trash2,
      variant: "danger",
      title: "Delete this quotation from the Google Sheet",
      onClick: handleDeleteRow,
    },
  ].filter(Boolean);

  const exportCsv = () => {
    const name = `${preset?.name || "data"}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(name, toCsv(data.headers, visibleRows));
  };

  return (
    <div className="screen screen-wide">
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
          <button className="btn btn-soft" onClick={reload} disabled={!isLinked || state === "loading"}>
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

          {notice.state !== "idle" && (
            <div
              className={`alert alert-${
                notice.state === "error" ? "error" : notice.state === "success" ? "success" : "info"
              }`}
            >
              {notice.state === "working" && <Loader2 size={16} className="spin" />}
              <span>{notice.message}</span>
            </div>
          )}

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
                rowActions={rowActions}
              />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
