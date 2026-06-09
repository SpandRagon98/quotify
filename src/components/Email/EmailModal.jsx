import { useEffect, useRef, useState } from "react";
import {
  Mail,
  Send,
  Save,
  Copy,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Paperclip,
  Link2,
  Eye,
  ExternalLink,
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
import {
  trackingEnabled,
  createTrackedQuote,
  latestTrackedQuote,
} from "../../lib/quoteTracking";

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

  // Tracked quotes (Phase 1): create a shareable /q/<token> link on send and
  // show the recipient's view/response status. Available only in cloud mode.
  const canTrack = trackingEnabled();
  const [trackOn, setTrackOn] = useState(canTrack);
  const [trackLink, setTrackLink] = useState("");
  const [tracking, setTracking] = useState(null); // latest tracked quote status

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

  // Load any existing tracking status for this record when the modal opens.
  useEffect(() => {
    if (!open || !canTrack) return undefined;
    let cancelled = false;
    latestTrackedQuote(quotationId).then((t) => {
      if (!cancelled) {
        setTrackLink("");
        setTracking(t);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, canTrack, quotationId]);

  const buildSnapshot = () => ({
    preset: { id: preset.id, name: preset.name, fields: preset.fields },
    values: rowDoc.values,
    quotationId: quotationId || rowDoc.quotationId,
    logo: cfg.logo || "",
    banner: cfg.banner || "",
    description: cfg.description || "",
    hiddenFields: cfg.hiddenFields || [],
    extraContent: cfg.extraContent || [],
  });

  const trackStatusLabel = (s) =>
    ({ sent: "Sent", viewed: "Viewed", approved: "Approved", declined: "Declined", negotiate: "Negotiating" }[s] || s);

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
      // Tracked quote: create the shareable link first so it can be embedded.
      let trackUrl = "";
      if (trackOn && canTrack) {
        setStatus({ state: "sending", message: "Creating tracking link…" });
        const created = await createTrackedQuote({
          quotationId: quotationId || rowDoc.quotationId,
          presetName: preset.name,
          recipientEmail: recipient,
          snapshot: buildSnapshot(),
        });
        trackUrl = created.url;
        setTrackLink(trackUrl);
      }

      // Substitute placeholders, then weave in the tracking link.
      let finalBody = applyPlaceholders(body, headers, row);
      if (trackUrl) {
        finalBody = finalBody.includes("{{Quote Link}}")
          ? finalBody.split("{{Quote Link}}").join(trackUrl)
          : `${finalBody}\n\n— — —\nView your quotation online and respond:\n${trackUrl}`;
      } else {
        finalBody = finalBody.split("{{Quote Link}}").join("");
      }

      const payload = {
        to: recipient,
        subject: applyPlaceholders(subject, headers, row),
        body: finalBody,
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
      setStatus({
        state: "sent",
        message: trackUrl
          ? `Email sent to ${recipient}. A tracked link was included.`
          : `Email sent to ${recipient}.`,
      });
      if (canTrack) latestTrackedQuote(quotationId).then(setTracking);
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  const previewSubject = row ? applyPlaceholders(subject, headers, row) : subject;
  const rawPreviewBody = row ? applyPlaceholders(body, headers, row) : body;
  const previewBody =
    trackOn && canTrack
      ? rawPreviewBody.includes("{{Quote Link}}")
        ? rawPreviewBody.split("{{Quote Link}}").join("🔗 [your tracked quotation link]")
        : `${rawPreviewBody}\n\n— — —\nView your quotation online and respond:\n🔗 [your tracked quotation link]`
      : rawPreviewBody.split("{{Quote Link}}").join("");

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
              {canTrack && (
                <button
                  type="button"
                  className="placeholder-chip placeholder-chip-btn placeholder-chip-accent"
                  onClick={() => insertToken("{{Quote Link}}")}
                  title="Insert the tracked quotation link"
                >
                  <code>{`{{Quote Link}}`}</code>
                  <Link2 size={13} />
                </button>
              )}
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

          {/* Tracked quote (Phase 1) — shareable link + view/response status */}
          {canTrack && (
            <div className="form-field track-field">
              <label className="track-toggle">
                <input
                  type="checkbox"
                  checked={trackOn}
                  onChange={(e) => setTrackOn(e.target.checked)}
                />
                <span className="form-label track-toggle-label">
                  <Link2 size={13} /> Send as a tracked quote
                </span>
              </label>
              <p className="form-hint track-hint">
                Adds a secure link the recipient opens to view this quotation and
                Approve / Decline / Negotiate. You'll see views and their response here.
              </p>

              {trackLink && (
                <div className="track-link-row">
                  <ExternalLink size={14} />
                  <a href={trackLink} target="_blank" rel="noreferrer" className="track-link">
                    {trackLink}
                  </a>
                  <button
                    type="button"
                    className="btn btn-soft btn-xs"
                    onClick={() => navigator.clipboard?.writeText(trackLink)}
                  >
                    <Copy size={13} /> Copy
                  </button>
                </div>
              )}

              {tracking && (
                <div className={`track-status track-status-${tracking.status}`}>
                  <Eye size={14} />
                  <span>
                    <strong>{trackStatusLabel(tracking.status)}</strong>
                    {tracking.view_count > 0 && ` · ${tracking.view_count} view${tracking.view_count === 1 ? "" : "s"}`}
                    {tracking.response_note && ` · "${tracking.response_note}"`}
                  </span>
                </div>
              )}
            </div>
          )}
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
