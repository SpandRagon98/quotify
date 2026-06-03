import { useRef, useState } from "react";
import {
  Mail,
  Send,
  Save,
  Copy,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Modal from "../common/Modal";
import {
  applyPlaceholders,
  findRowEmail,
  defaultEmailTemplate,
} from "../../utils/emailTemplate";
import { sendQuotationEmail } from "../../services/emailService";
import { presetSheetId } from "../../services/quotationService";

/**
 * Wide two-pane email composer for one Database row.
 * Placeholders ({{Header}}) are replaced with that row's values on send.
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
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const lastFocused = useRef("body");

  const recipient = row ? findRowEmail(preset, headers, row) : "";
  const busy = status.state === "sending";

  const insertToken = (token) => {
    const target = lastFocused.current === "subject" ? "subject" : "body";
    const ref = target === "subject" ? subjectRef : bodyRef;
    const setter = target === "subject" ? setSubject : setBody;
    const el = ref.current;
    if (!el) {
      setter((v) => v + token);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setter((v) => v.slice(0, start) + token + v.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
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
      setStatus({ state: "sending", message: "Sending email…" });
      await sendQuotationEmail({
        to: recipient,
        subject: applyPlaceholders(subject, headers, row),
        body: applyPlaceholders(body, headers, row),
        quotationId:
          headers.indexOf("Quotation ID") !== -1 ? row[headers.indexOf("Quotation ID")] : "",
        presetName: preset.name,
        spreadsheetId: presetSheetId(preset),
        sheetTabName: preset.sheetTabName,
      });
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
              rows={12}
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
        </div>

        {/* Preview pane */}
        <div className="email-preview-pane">
          <span className="form-label">Live preview</span>
          <div className="email-preview-card">
            <div className="email-preview-brand">Quotify</div>
            <div className="email-preview-subject">{previewSubject || "(no subject)"}</div>
            <div className="email-preview-body">{previewBody}</div>
            <div className="email-preview-ctas">
              <span className="email-cta cta-approve">Approve</span>
              <span className="email-cta cta-decline">Decline</span>
              <span className="email-cta cta-negotiate">Negotiate</span>
            </div>
          </div>
          <p className="form-hint">
            Quotify branding and the Approve / Decline / Negotiate buttons are added
            automatically. Clicking them updates this record's status.
          </p>
        </div>
      </div>

      {status.state !== "idle" && (
        <div
          className={`alert alert-${
            status.state === "error"
              ? "error"
              : status.state === "sent" || status.state === "saved"
              ? "success"
              : "info"
          }`}
        >
          {status.state === "sending" && <Loader2 size={16} className="spin" />}
          {(status.state === "sent" || status.state === "saved") && <CheckCircle2 size={16} />}
          {status.state === "error" && <AlertCircle size={16} />}
          <span>{status.message}</span>
        </div>
      )}
    </Modal>
  );
}
