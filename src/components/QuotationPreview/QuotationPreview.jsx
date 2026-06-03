import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  FileText,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Database as DatabaseIcon,
  Pencil,
} from "lucide-react";
import { formatFieldValue } from "../../utils/fieldFormatters";
import {
  submitQuotation,
  updateQuotation,
  presetSheetId,
  presetDocId,
} from "../../services/quotationService";

export default function QuotationPreview({
  preset,
  values,
  editingQuotationId,
  editingCreatedAt,
  onBack,
  onUpdated,
}) {
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [result, setResult] = useState(null);

  const isEditMode = Boolean(editingQuotationId);

  const run = async (generateDoc) => {
    try {
      setStatus({
        state: "saving",
        message: isEditMode
          ? "Updating quotation…"
          : generateDoc
          ? "Saving & generating document…"
          : "Saving to Google Sheet…",
      });

      const res = isEditMode
        ? await updateQuotation(preset, values, editingQuotationId, {
            generateDoc,
            createdAt: editingCreatedAt,
          })
        : await submitQuotation(preset, values, { generateDoc });

      setResult(res);
      const docNote = res.docResult?.docUrl ? " Document generated." : "";
      const mockNote = res.sheetResult?.mocked ? " (offline preview — see console)" : "";
      setStatus({
        state: "success",
        message: isEditMode
          ? `Updated ${res.meta.quotationId}.${docNote}${mockNote}`
          : `Saved as ${res.meta.quotationId}.${docNote}${mockNote}`,
      });
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  const busy = status.state === "saving";
  const updated = status.state === "success" && isEditMode;

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="head-with-back">
          <button className="icon-btn" onClick={onBack} title="Back to form" disabled={busy}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="screen-title">{isEditMode ? "Review changes" : "Review quotation"}</h1>
            <p className="screen-sub">
              {isEditMode
                ? `Editing quotation ${editingQuotationId} · ${preset.name}`
                : `Check the details before saving. ${preset.name}`}
            </p>
          </div>
        </div>
      </header>

      {isEditMode && (
        <div className="edit-banner">
          <span className="edit-banner-text">
            <Pencil size={15} /> Editing quotation: <strong>{editingQuotationId}</strong>
            {" "}— the same Google Sheet row will be updated (no new row created).
          </span>
        </div>
      )}

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="review-grid">
          {preset.fields.map((field) => (
            <div className="review-item" key={field.id}>
              <span className="review-label">{field.label}</span>
              <span className="review-value">
                {formatFieldValue(field, values[field.id])}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {status.state !== "idle" && (
        <motion.div
          className={`alert alert-${status.state === "error" ? "error" : status.state === "success" ? "success" : "info"}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {status.state === "saving" && <Loader2 size={18} className="spin" />}
          {status.state === "success" && <CheckCircle2 size={18} />}
          <span>{status.message}</span>
        </motion.div>
      )}

      {status.state === "success" && result?.docResult?.docUrl && (
        <motion.div
          className="doc-link-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <div className="doc-link-label">Generated Google Doc</div>
            <a href={result.docResult.docUrl} target="_blank" rel="noreferrer" className="doc-link-url">
              {result.docResult.docUrl}
            </a>
          </div>
          <a className="btn btn-primary" href={result.docResult.docUrl} target="_blank" rel="noreferrer">
            <FileText size={16} /> Open document
          </a>
        </motion.div>
      )}

      <div className="form-actions form-actions-split">
        <button className="btn btn-soft" onClick={onBack} disabled={busy}>
          Back &amp; edit
        </button>

        {updated ? (
          <button className="btn btn-primary" onClick={onUpdated}>
            <DatabaseIcon size={18} /> Back to Database
          </button>
        ) : isEditMode ? (
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => run(false)} disabled={busy}>
              <RefreshCw size={18} /> Update Quotation
            </button>
            <button
              className="btn btn-primary"
              onClick={() => run(true)}
              disabled={busy}
              title={presetDocId(preset) ? "" : "Link a Google Doc template to this preset first"}
            >
              <FileText size={18} /> Update &amp; Generate Doc
            </button>
          </div>
        ) : (
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => run(false)}
              disabled={busy}
              title={presetSheetId(preset) ? "" : "Link a Google Sheet to this preset first"}
            >
              <Save size={18} /> Save to Sheet
            </button>
            <button
              className="btn btn-primary"
              onClick={() => run(true)}
              disabled={busy}
              title={presetDocId(preset) ? "" : "Link a Google Doc template to this preset first"}
            >
              <FileText size={18} /> Save &amp; Generate Doc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
