import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FileText,
} from "lucide-react";
import DataTable from "./DataTable";
import DocumentPreview from "../common/DocumentPreview";
import { useSheetData } from "../../hooks/useSheetData";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { searchRows, filterRows, toCsv, downloadCsv } from "../../utils/tableData";
import { rowToFormValues } from "../../utils/rowMapping";
import { elementToPdfBlobUrl } from "../../utils/pdf";
import { deleteQuotation } from "../../services/quotationService";
import { METADATA_COLUMNS } from "../../config/appConfig";
import { loadDocRegistry, getDocRecord } from "../../lib/docRegistry";
import { listTrackedQuotes, trackingEnabled } from "../../lib/quoteTracking";

const TRACK_LABEL = {
  sent: "Sent",
  viewed: "Viewed",
  approved: "Accepted",
  declined: "Declined",
  negotiate: "Changes",
  expired: "Expired",
};

/** "Document" cell: generated type + live tracked status for one row. */
function DocStatusCell({ record, tracked }) {
  return (
    <div className="doc-status-cell">
      {record ? (
        <span className={`doc-badge ${record.docType === "googledoc" ? "doc-badge-gdoc" : "doc-badge-native"}`}>
          {record.docType === "googledoc" ? "Google Doc" : "Native PDF"}
        </span>
      ) : (
        <span className="doc-badge doc-badge-none">Not generated</span>
      )}
      {tracked && TRACK_LABEL[tracked.status] && (
        <span className={`mini-pill mini-pill-${tracked.status}`} title={
          tracked.view_count ? `${tracked.view_count} view${tracked.view_count === 1 ? "" : "s"}` : undefined
        }>
          {TRACK_LABEL[tracked.status]}
        </span>
      )}
    </div>
  );
}

export default function DatabasePage({
  presets,
  initialPresetId,
  canDelete = false,
  onEditPreset,
  onLoadQuotation,
}) {
  const { presetId, setPresetId, preset, isLinked, data, state, error, reload } =
    useSheetData(presets, initialPresetId);
  const cfg = useCompanyProfile(presetId);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [notice, setNotice] = useState({ state: "idle", message: "" });
  const [viewRow, setViewRow] = useState(null);
  const [trackedMap, setTrackedMap] = useState({});
  const pdfStageRef = useRef(null);

  const viewDoc = viewRow && preset ? rowToFormValues(preset, data.headers, viewRow) : null;

  // Document registry (generated type + Google Doc URL per quotation) and the
  // live tracked-quote statuses, refreshed whenever the sheet data reloads.
  const registry = useMemo(() => loadDocRegistry(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const qidIdx = data.headers.indexOf(METADATA_COLUMNS[0]); // "Quotation ID"

  useEffect(() => {
    if (!trackingEnabled() || state !== "loaded") return undefined;
    let cancelled = false;
    listTrackedQuotes().then((quotes) => {
      if (cancelled) return;
      const map = {};
      // Listed newest-first; keep the first (latest) entry per quotation.
      quotes.forEach((q) => {
        if (q.quotation_id && !map[q.quotation_id]) map[q.quotation_id] = q;
      });
      setTrackedMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [state, data]);

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

  // Stable so the (potentially large) DataTable doesn't re-render when unrelated
  // state (notice banners, etc.) changes.
  const handleFilter = useCallback(
    (header, value) => setFilters((prev) => ({ ...prev, [header]: value })),
    []
  );

  // Load a saved row back into its preset's form for editing.
  const handleLoadRow = useCallback(
    (row) => {
      if (!preset || !onLoadQuotation) return;
      const { values, quotationId, createdAt } = rowToFormValues(preset, data.headers, row);
      onLoadQuotation({ presetId: preset.id, values, quotationId, createdAt });
    },
    [preset, onLoadQuotation, data.headers]
  );

  // Delete a row from the linked Google Sheet (Owner/Admin only).
  const handleDeleteRow = useCallback(async (row) => {
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
  }, [preset, data.headers, reload]);

  // View — open the saved document for this row based on its generated type:
  // Google Doc rows open the generated Doc; native (or untyped) rows render the
  // native PDF on demand. The window is opened SYNCHRONOUSLY inside the click
  // so pop-up blockers don't eat it, then pointed at the result.
  const handleViewQuote = useCallback((row) => {
    if (!preset) return;
    const quotationId = qidIdx === -1 ? "" : String(row[qidIdx] ?? "");
    const rec = getDocRecord(quotationId);

    if (rec?.docType === "googledoc") {
      if (rec.docUrl) {
        window.open(rec.docUrl, "_blank", "noopener");
        return;
      }
      setNotice({
        state: "info",
        message:
          "No document generated yet — load this row and generate the Google Doc first.",
      });
      return;
    }

    // Native PDF: claim the tab now (user gesture), fill it once captured.
    const win = window.open("", "_blank");
    setViewRow(row);
    setNotice({ state: "working", message: "Preparing the quotation document…" });
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          if (!pdfStageRef.current) throw new Error("Could not prepare the document.");
          const url = await elementToPdfBlobUrl(pdfStageRef.current);
          if (win) {
            win.location.href = url;
            setNotice({ state: "idle", message: "" });
          } else {
            setNotice({ state: "info", message: "Pop-up blocked — allow pop-ups to view the document." });
          }
        } catch (err) {
          if (win) win.close();
          setNotice({ state: "error", message: err.message });
        } finally {
          setViewRow(null);
        }
      }, 80);
    });
  }, [preset, qidIdx]);

  const rowActions = useMemo(
    () =>
      [
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
        {
          label: "View",
          icon: FileText,
          title: "Open this row's document (Google Doc or native PDF, per how it was generated)",
          onClick: handleViewQuote,
        },
      ].filter(Boolean),
    [onLoadQuotation, canDelete, handleLoadRow, handleDeleteRow, handleViewQuote]
  );

  // "Document" status column: generated type + live tracked status per row.
  const leadingColumns = useMemo(
    () => [
      {
        header: "Document",
        render: (row) => {
          const qid = qidIdx === -1 ? "" : String(row[qidIdx] ?? "");
          return <DocStatusCell record={registry[qid]} tracked={trackedMap[qid]} />;
        },
      },
    ],
    [qidIdx, registry, trackedMap]
  );

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
                leadingColumns={leadingColumns}
              />
            </motion.div>
          )}
        </>
      )}

      {/* Off-screen A4 stage used to render the selected row's native PDF. */}
      {viewDoc && (
        <div className="pdf-stage" ref={pdfStageRef} aria-hidden="true">
          <DocumentPreview
            preset={preset}
            values={viewDoc.values}
            quotationId={viewDoc.quotationId}
            mode="data"
            logo={cfg.logo}
            banner={cfg.banner}
            description={cfg.description}
            hiddenFields={cfg.hiddenFields}
            extraContent={cfg.extraContent}
          />
        </div>
      )}
    </div>
  );
}
