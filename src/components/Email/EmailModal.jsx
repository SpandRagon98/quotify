import { useRef, useState } from "react";
import {
  Mail,
  Send,
  Save,
  Copy,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import Modal from "../common/Modal";
import Logo from "../common/Logo";
import DocumentPreview from "../common/DocumentPreview";
import { applyPlaceholders, findRowEmail, defaultEmailTemplate } from "../../utils/emailTemplate";
import { rowToFormValues } from "../../utils/rowMapping";
import { elementToPdfBase64 } from "../../utils/pdf";
import { sendQuotationEmail } from "../../services/emailService";
import { presetSheetId, presetDocId } from "../../services/quotationService";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";

/**
 * Email composer for one Database row. Placeholders ({{Header}}) are replaced
 * with the row's values on send. Optionally attaches the quotation PDF (native,
 * captured from the document; or the linked Google Doc exported server-side).
 */
export default function EmailModal({
  open,
  preset,
  headers,
  row,
  savedTemplate,
  onClose,
  onSaveTemplate,
}) {
  const seed = savedTemplate || defaultEmailTemplate(preset);
  const [subject, setSubject] = useState(seed.subject);
  const [body, setBody] = useState(seed.body);
  const [attachMode, setAttachMode] = useState("native"); // native | googledoc | none
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const lastFocused = useRef("body");
  const pdfStageRef = useRef(null);

  const cfg = useCompanyProfile(preset.id);
  const logo = cfg.logo;
  const recipient = row ? findRowEmail(preset, headers, row) : "";
  const hasTemplate = Boolean(presetDocId(preset));
  const busy = status.state === "sending";

  const quotationId =
    row && headers.indexOf("Quotation ID") !== -1 ? String(row[headers.indexOf("Quotation ID")] ?? "") : "";
  const rowDoc = row ? rowToFormValues(preset, headers, row) : { values: {}, quotationId: "" };

  const insertToken = (token) => {
    const target = lastFocused.current === "subject" ? "subject" : "body";
    const ref = target === "subject" ? subjectRef : bodyRef;
    const setter = target === "subject" ? setSubject : setBody;
    const el = ref.current;
    if (!el) return setter((v) => v + token);
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setter((v) => v.slice(0, start) + token + v.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSaveTemplate = () => {
    onSaveTemplate({ subject, body });
    setStatus({ state: "saved", message: "Template saved for this preset." });
  };

  const handleSend = async () => {
    if (!recipient) {
      setStatus({ state: "error", message: "No email address found in this row." });
      return;
    }
    try {
      const payload = {
        to: recipient,
        subject: applyPlaceholders(subject, headers, row),
        body: applyPlaceholders(body, headers, row),
        quotationId,
        presetName: preset.name,
        spreadsheetId: presetSheetId(preset),
        sheetTabName: preset.sheetTabName,
        companyLogo: logo || "",
      };
      const fileName = `${preset.name}-${quotationId || "quotation"}.pdf`;

      if (attachMode === "native") {
        setStatus({ state: "sending", message: "Generating PDF attachment…" });
        payload.attachmentPdfBase64 = await elementToPdfBase64(pdfStageRef.current);
        payload.attachmentName = fileName;
      } else if (attachMode === "googledoc") {
        if (!hasTemplate) {
          setStatus({ state: "error", message: "No Google Doc template linked — pick Native PDF or link a template." });
          return;
        }
        const placeholders = {};
        headers.forEach((h, i) => (placeholders[h] = String(row[i] ?? "")));
        placeholders["Quotation Number"] = quotationId;
        payload.attachTemplate = { templateId: presetDocId(preset), placeholders, name: fileName };
      }

      setStatus({ state: "sending", message: "Sending email…" });
      await sendQuotationEmail(payload);
      setStatus({ state: "sent", message: `Email sent to ${recipient}.` });
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  const previewSubject = row ? applyPlaceholders(subject, headers, row) : subject;
  const previewBody = row ? applyPlaceholders(body, headers, row) : body;

  return (
    <Modal
      open={open}
      wide
      title="Compose email"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-soft" onClick={handleSaveTemplate} disabled={busy}>
            <Save size={16} /> Save Template
          </button>
          <button className="btn btn-primary" onClick={handleSend} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Send Email
          </button>
        </>
      }
    >
      <div className="email-recipient">
        <Mail size={15} />
        {recipient ? (
          <span>To: <strong>{recipient}</strong></span>
        ) : (
          <span className="email-recipient-missing">
            No email address found in this row — add/fill an email field.
          </span>
        )}
      </div>

      <div className="email-grid">
        {/* Compose pane */}
        <div className="email-compose">
          <label className="form-field">
            <span className="form-label">Subject</span>
            <input
              ref={subjectRef}
              className="control"
              value={subject}
              onFocus={() => (lastFocused.current = "subject")}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>

          <label className="form-field">
            <span className="form-label">Body</span>
            <textarea
              ref={bodyRef}
              className="control email-body-input"
              rows={11}
              value={body}
              onFocus={() => (lastFocused.current = "body")}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <div className="placeholder-insert">
            <span className="form-label">Insert placeholder</span>
            <div className="placeholder-list">
              {headers.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="placeholder-chip placeholder-chip-btn"
                  onClick={() => insertToken(`{{${h}}}`)}
                  title={`Insert {{${h}}}`}
                >
                  <code>{`{{${h}}}`}</code>
                  <Copy size={13} />
                </button>
              ))}
            </div>
          </div>

          {/* PDF attachment selector */}
          <div className="form-field">
            <span className="form-label"><Paperclip size={13} /> Attach quotation PDF</span>
            <div className="attach-toggle">
              <button className={`attach-btn ${attachMode === "native" ? "is-active" : ""}`} onClick={() => setAttachMode("native")}>
                Native PDF
              </button>
              <button
                className={`attach-btn ${attachMode === "googledoc" ? "is-active" : ""}`}
                onClick={() => setAttachMode("googledoc")}
                disabled={!hasTemplate}
                title={hasTemplate ? "" : "Link a Google Doc template to use this"}
              >
                Google Doc PDF
              </button>
              <button className={`attach-btn ${attachMode === "none" ? "is-active" : ""}`} onClick={() => setAttachMode("none")}>
                No attachment
              </button>
            </div>
          </div>
        </div>

        {/* Preview pane — mirrors the actual sent email */}
        <div className="email-preview-pane">
          <span className="form-label">Live preview</span>
          <div className="email-preview-card">
            <div className="email-preview-header">
              <div className="email-ph-brand"><Logo size={20} /><span>Qyrova</span></div>
              {logo ? <img className="email-ph-logo" src={logo} alt="" /> : null}
            </div>
            <div className="email-preview-content">
              <div className="email-preview-subject">{previewSubject || "(no subject)"}</div>
              <div className="email-preview-body">{previewBody}</div>
              <div className="email-preview-ctas">
                <span className="email-cta cta-approve">Approve</span>
                <span className="email-cta cta-decline">Decline</span>
                <span className="email-cta cta-negotiate">Negotiate</span>
              </div>
              <div className="email-preview-foot">Sent via Qyrova</div>
            </div>
          </div>
          <p className="form-hint">
            The Approve / Decline / Negotiate buttons update this record's status when clicked.
            {attachMode !== "none" && " The quotation PDF is attached automatically."}
          </p>
        </div>
      </div>

      {status.state !== "idle" && (
        <div
          className={`alert alert-${
            status.state === "error" ? "error" : status.state === "sent" || status.state === "saved" ? "success" : "info"
          }`}
        >
          {status.state === "sending" && <Loader2 size={16} className="spin" />}
          {(status.state === "sent" || status.state === "saved") && <CheckCircle2 size={16} />}
          {status.state === "error" && <AlertCircle size={16} />}
          <span>{status.message}</span>
        </div>
      )}

      {/* Off-screen A4 document used to capture the native PDF attachment */}
      <div className="pdf-stage" ref={pdfStageRef} aria-hidden="true">
        <DocumentPreview
          preset={preset}
          values={rowDoc.values}
          quotationId={quotationId || rowDoc.quotationId}
          mode="data"
          logo={cfg.logo}
          banner={cfg.banner}
          description={cfg.description}
          hiddenFields={cfg.hiddenFields}
          extraContent={cfg.extraContent}
        />
      </div>
    </Modal>
  );
}
