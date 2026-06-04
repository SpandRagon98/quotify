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
} from "lucide-react";
import DocumentPreview from "../common/DocumentPreview";
import Modal from "../common/Modal";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import {
  submitQuotation,
  updateQuotation,
  presetSheetId,
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
  const [printId, setPrintId] = useState(editingQuotationId || "");
  const { logo, description, setLogo, setDescription, clearLogo } = useCompanyProfile(preset.id);

  const isEditMode = Boolean(editingQuotationId);

  /** Save the quotation row (no document). */
  const save = async () => {
    return isEditMode
      ? updateQuotation(preset, values, editingQuotationId, {
          generateDoc: false,
          createdAt: editingCreatedAt,
        })
      : submitQuotation(preset, values, { generateDoc: false });
  };

  /** Flow 1 — Native preview: save the row, then print/export via the browser. */
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
      // Let the portal re-render with the saved id, then print.
      requestAnimationFrame(() => setTimeout(() => window.print(), 60));
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  /** Flow 2 — Google Doc: save the row + generate from the linked template. */
  const generateGoogleDoc = async () => {
    setDocDialog(false);
    try {
      setStatus({ state: "saving", message: "Saving & generating Google Doc…" });
      const res = isEditMode
        ? await updateQuotation(preset, values, editingQuotationId, {
            generateDoc: true,
            createdAt: editingCreatedAt,
          })
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
                : `Review the document, then choose how to generate it. ${preset.name}`}
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

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <DocumentPreview
          preset={preset}
          values={values}
          quotationId={editingQuotationId}
          mode="data"
          logo={logo}
          description={description}
          onLogoChange={setLogo}
          onLogoClear={clearLogo}
          onDescriptionChange={setDescription}
        />
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

      {/* Google Doc result — Open/Edit + Download PDF (Google Doc flow only) */}
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

      {/* Actions */}
      <div className="form-actions form-actions-split">
        <button className="btn btn-soft" onClick={onBack} disabled={busy}>
          Back &amp; edit
        </button>

        {status.state === "success" && status.flow === "googledoc" && isEditMode ? (
          <button className="btn btn-primary" onClick={onUpdated}>
            <DatabaseIcon size={18} /> Back to Database
          </button>
        ) : (
          <div className="gen-options">
            <button
              className="btn btn-secondary"
              onClick={generatePreview}
              disabled={busy}
              title={presetSheetId(preset) ? "Save and download the native Qyrova preview as PDF" : "Link a Google Sheet to this preset first"}
            >
              <Printer size={18} /> Generate Preview Version
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setDocDialog(true)}
              disabled={busy}
              title="Generate a Google Doc from the linked template"
            >
              <FileText size={18} /> Generate Google Doc Version
            </button>
          </div>
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
              To generate a Google Doc correctly, you must <strong>manually create the Google
              Doc template</strong> and place the required placeholders — like{" "}
              <code>{"{{Customer Name}}"}</code>, <code>{"{{Quotation Number}}"}</code>, etc. —
              in the correct positions, then link it to this preset.
            </p>
            <p className="form-hint">
              Tip: open <strong>Doc View → Native Version</strong> to copy the exact placeholder
              names for this preset. Qyrova replaces them with the entered values.
            </p>
          </div>
        </div>
      </Modal>

      {/* Hidden print copy of the ACTUAL document preview (portal) — only visible
          when printing, so the saved PDF matches the on-screen native preview. */}
      {createPortal(
        <div className="print-area" aria-hidden="true">
          <DocumentPreview
            preset={preset}
            values={values}
            quotationId={printId}
            mode="data"
            logo={logo}
            description={description}
            onLogoChange={setLogo}
            onLogoClear={clearLogo}
            onDescriptionChange={setDescription}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
