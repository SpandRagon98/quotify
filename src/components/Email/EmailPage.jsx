import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  Link2,
  Inbox,
} from "lucide-react";
import DataTable from "../Database/DataTable";
import EmailModal from "./EmailModal";
import { useSheetData } from "../../hooks/useSheetData";
import { useEmailTemplates } from "../../hooks/useEmailTemplates";
import { searchRows, filterRows } from "../../utils/tableData";
import { STATUS_COLUMNS } from "../../config/appConfig";

export default function EmailPage({ presets, initialPresetId, onEditPreset }) {
  const { presetId, setPresetId, preset, isLinked, data, state, error, reload } =
    useSheetData(presets, initialPresetId);
  const { getTemplate, saveTemplate } = useEmailTemplates();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [activeRow, setActiveRow] = useState(null);

  const handleSelectPreset = (id) => {
    setQuery("");
    setFilters({});
    setActiveRow(null);
    setPresetId(id);
  };

  const visibleRows = useMemo(() => {
    const byFilter = filterRows(data.rows, data.headers, filters);
    return searchRows(byFilter, query);
  }, [data, filters, query]);

  const handleFilter = (header, value) =>
    setFilters((prev) => ({ ...prev, [header]: value }));

  // Always show the Approval / Decline / Negotiate status columns, even when the
  // sheet doesn't have them yet (no customer has responded).
  const missingStatus = STATUS_COLUMNS.filter((c) => !data.headers.includes(c));
  const tableHeaders = [...data.headers, ...missingStatus];
  const tableRows = visibleRows.map((r) => [...r, ...missingStatus.map(() => "")]);

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Email</h1>
          <p className="screen-sub">Send a branded quotation email for any saved record.</p>
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
              <Inbox size={26} />
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
                headers={tableHeaders}
                rows={tableRows}
                filters={filters}
                onFilterChange={handleFilter}
                statusColumns={STATUS_COLUMNS}
                rowActions={[
                  {
                    label: "Email",
                    icon: Mail,
                    title: "Compose an email for this record",
                    onClick: (row) => setActiveRow(row),
                  },
                ]}
              />
            </motion.div>
          )}
        </>
      )}

      <EmailModal
        open={Boolean(activeRow)}
        preset={preset}
        headers={data.headers}
        row={activeRow}
        savedTemplate={preset ? getTemplate(preset.id) : null}
        onClose={() => setActiveRow(null)}
        onSaveTemplate={(tpl) => preset && saveTemplate(preset.id, tpl)}
      />
    </div>
  );
}
