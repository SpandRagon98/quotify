import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  FileDown,
  Printer,
  CheckCircle2,
  Loader2,
  Database as DatabaseIcon,
  Pencil,
  AlertTriangle,
  LayoutTemplate,
  Link2,
} from "lucide-react";
import DocumentPreview from "../common/DocumentPreview";
import Modal from "../common/Modal";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
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
  const [docDialog, setDocDialog] = useState(false);
  const [docMode, setDocMode] = useState("native"); // native | googledoc
  const [printId, setPrintId] = useState(editingQuotationId || "");
  const cfg = useCompanyProfile(preset.id);

  const isEditMode = Boolean(editingQuotationId);
  const docId = presetDocId(preset);
  const previewUrl = docId ? `https://docs.google.com/document/d/${docId}/preview` : "";

  const save = async () =>
    isEditMode
      ? updateQuotation(preset, values, editingQuotationId, { generateDoc: false, createdAt: editingCreatedAt })
      : submitQuotation(preset, values, { generateDoc: false });

  /** Native: save the row, then print/export the native document via the browser. */
  const generatePreview = async () => {
    try {
      setStatus({ state: "saving", message: "Saving & preparing preview…" });
      const res = await save();
      setResult(res);
      setPrintId(res.meta.quotationId);
      const mockNote = res.sheetResult?.mocked ? " (offline — see console)" : "";
      setStatus({
        state: "success",
        message: `Saved as ${res.meta.quotationId}. Opening print dialog — choose “Save as PDF”.${mockNote}`,
        flow: "preview",
      });
      requestAnimationFrame(() => setTimeout(() => window.print(), 60));
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  /** Google Doc: save the row + generate from the linked template. */
  const generateGoogleDoc = async () => {
    setDocDialog(false);
    try {
      setStatus({ state: "saving", message: "Saving & generating Google Doc…" });
      const res = isEditMode
        ? await updateQuotation(preset, values, editingQuotationId, { generateDoc: true, createdAt: editingCreatedAt })
        : await submitQuotation(preset, values, { generateDoc: true });
      setResult(res);
      const mockNote = res.sheetResult?.mocked ? " (offline — see console)" : "";
      setStatus({
        state: "success",
        message: `Saved as ${res.meta.quotationId}. Google Doc generated.${mockNote}`,
        flow: "googledoc",
      });
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  const busy = status.state === "saving";
  const docReady = status.state === "success" && status.flow === "googledoc" && result?.docResult?.docUrl;

  return (
    <div className="screen screen-wide">
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
                : `Review the document, then choose how to generate it. ${preset.name}`}
            </p>
          </div>
        </div>
      </header>

      {isEditMode && (
        <div className="edit-banner">
          <span className="edit-banner-text">
            <Pencil size={15} /> Editing quotation: <strong>{editingQuotationId}</strong>{" "}
            — the same Google Sheet row will be updated (no new row created).
          </span>
        </div>
      )}

      {/* Version toggle (same as Doc View) */}
      <div className="doc-toggle">
        <button className={`doc-toggle-btn ${docMode === "native" ? "is-active" : ""}`} onClick={() => setDocMode("native")}>
          <LayoutTemplate size={16} /> Native View
        </button>
        <button className={`doc-toggle-btn ${docMode === "googledoc" ? "is-active" : ""}`} onClick={() => setDocMode("googledoc")}>
          <FileText size={16} /> Google Doc View
        </button>
      </div>

      {docMode === "native" ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <DocumentPreview
            preset={preset}
            values={values}
            quotationId={editingQuotationId}
            mode="data"
            editMeta
            logo={cfg.logo}
            banner={cfg.banner}
            description={cfg.description}
            hiddenFields={cfg.hiddenFields}
            extraContent={cfg.extraContent}
            onLogoChange={cfg.setLogo}
            onLogoClear={cfg.clearLogo}
            onBannerChange={cfg.setBanner}
            onBannerClear={cfg.clearBanner}
            onDescriptionChange={cfg.setDescription}
          />
        </motion.div>
      ) : preset.googleDocUrl ? (
        <motion.div className="doc-stage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="doc-page">
            <iframe title={`${preset.name} Google Doc template`} src={previewUrl} className="doc-frame" />
          </div>
          <p className="doc-hint">Linked Google Doc template — placeholders will be filled on Generate.</p>
        </motion.div>
      ) : (
        <div className="empty-state">
          <Link2 size={26} />
          <p>No Google Doc template linked to this preset yet.</p>
          <p className="form-hint">Generate will guide you to create and link one.</p>
        </div>
      )}

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

      {docReady && (
        <motion.div className="doc-link-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <div className="doc-link-label">Generated Google Doc</div>
            <a href={result.docResult.docUrl} target="_blank" rel="noreferrer" className="doc-link-url">
              {result.docResult.docUrl}
            </a>
          </div>
          <div className="doc-link-actions">
            <a className="btn btn-secondary" href={result.docResult.docUrl} target="_blank" rel="noreferrer">
              <FileText size={16} /> Open / Edit Google Doc
            </a>
            {result.docResult.pdfUrl && (
              <a className="btn btn-primary" href={result.docResult.pdfUrl} target="_blank" rel="noreferrer">
                <FileDown size={16} /> Download Google Doc as PDF
              </a>
            )}
          </div>
        </motion.div>
      )}

      {/* Actions — single Generate button reflecting the selected version */}
      <div className="form-actions form-actions-split">
        <button className="btn btn-soft" onClick={onBack} disabled={busy}>
          Back &amp; edit
        </button>

        {status.state === "success" && status.flow === "googledoc" && isEditMode ? (
          <button className="btn btn-primary" onClick={onUpdated}>
            <DatabaseIcon size={18} /> Back to Database
          </button>
        ) : docMode === "native" ? (
          <button
            className="btn btn-primary"
            onClick={generatePreview}
            disabled={busy}
            title={presetSheetId(preset) ? "Save and download the native Qyrova PDF" : "Link a Google Sheet to this preset first"}
          >
            <Printer size={18} /> Generate &amp; Download PDF
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setDocDialog(true)} disabled={busy}>
            <FileText size={18} /> Generate Google Doc
          </button>
        )}
      </div>

      {/* Google Doc warning dialog */}
      <Modal
        open={docDialog}
        title="Generate Google Doc Version"
        onClose={() => setDocDialog(false)}
        footer={
          <>
            <button className="btn btn-soft" onClick={() => setDocDialog(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={generateGoogleDoc}>
              <FileText size={16} /> Continue Generating Google Doc
            </button>
          </>
        }
      >
        <div className="doc-warn">
          <span className="doc-warn-icon"><AlertTriangle size={20} /></span>
          <div>
            <p>
              To generate a Google Doc correctly, you must manually create the Google
              Doc template and place the required placeholders — like{" "}
              <code>{"{{Customer Name}}"}</code>, <code>{"{{Quotation Number}}"}</code>, etc. —
              in the correct positions, then link it to this preset.
            </p>
            <p className="form-hint">
              Tip: open Doc View → Native Version to copy the exact placeholder names for
              this preset. Qyrova replaces them with the entered values.
            </p>
          </div>
        </div>
      </Modal>

      {/* Hidden print copy of the ACTUAL document preview (portal). */}
      {createPortal(
        <div className="print-area" aria-hidden="true">
          <DocumentPreview
            preset={preset}
            values={values}
            quotationId={printId}
            mode="data"
            logo={cfg.logo}
            banner={cfg.banner}
            description={cfg.description}
            hiddenFields={cfg.hiddenFields}
            extraContent={cfg.extraContent}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
