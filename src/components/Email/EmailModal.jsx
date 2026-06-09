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
import { buildQuoteEmailHtml } from "../../utils/emailHtml";
import { sendQuotationEmail } from "../../services/emailService";
import { sendViaResend } from "../../services/resendClient";
import { presetSheetId, presetDocId } from "../../services/quotationService";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { APP, EMAIL } from "../../config/appConfig";
import { getDocRecord } from "../../lib/docRegistry";
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
  // Default is link-only ("none"): clean professional email with just the
  // message + secure document link. Attachments remain available if wanted.
  const [attachMode, setAttachMode] = useState("none"); // none | native | googledoc
  const [status, setStatus] = useState({ state: "idle", message: "" });

  // Tracked quotes (Phase 1): create a shareable /q/<token> link on send and
  // show the recipient's view/response status. Available only in cloud mode.
  const canTrack = trackingEnabled();
  const [trackOn, setTrackOn] = useState(canTrack);
  const [trackLink, setTrackLink] = useState("");
  const [tracking, setTracking] = useState(null); // latest tracked quote status
  const [validDays, setValidDays] = useState(30); // "valid until" expiry (0 = none)

  // Email delivery path (Phase 2). Resend is selectable only in cloud mode.
  const [provider, setProvider] = useState(
    canTrack && EMAIL.PROVIDER === "resend" ? "resend" : "appsscript"
  );

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

  const buildSnapshot = () => {
    const qid = quotationId || rowDoc.quotationId;
    const docRec = getDocRecord(qid);
    return {
      preset: { id: preset.id, name: preset.name, fields: preset.fields },
      values: rowDoc.values,
      quotationId: qid,
      logo: cfg.logo || "",
      banner: cfg.banner || "",
      description: cfg.description || "",
      hiddenFields: cfg.hiddenFields || [],
      extraContent: cfg.extraContent || [],
      // Saved document type — the public page opens the right artifact.
      docType: docRec?.docType || "native",
      docUrl: docRec?.docUrl || "",
      presetName: preset.name,
    };
  };

  const trackStatusLabel = (s) =>
    ({ sent: "Sent", viewed: "Viewed", approved: "Accepted", declined: "Declined", negotiate: "Changes requested", expired: "Expired" }[s] || s);

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

  const accentColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#635bff";

  const handleSend = async () => {
    if (!recipient) {
      setStatus({ state: "error", message: "No email address found in this row." });
      return;
    }
    // Resend's tokenized CTA buttons require a tracked link — force tracking on.
    const useResend = provider === "resend" && canTrack;
    const wantTrack = trackOn || useResend;
    try {
      // Tracked quote: create the shareable link first so it can be embedded.
      let trackUrl = "";
      if (wantTrack && canTrack) {
        setStatus({ state: "sending", message: "Creating tracking link…" });
        const days = Number(validDays) || 0;
        const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
        const created = await createTrackedQuote({
          quotationId: quotationId || rowDoc.quotationId,
          presetName: preset.name,
          recipientEmail: recipient,
          snapshot: buildSnapshot(),
          expiresAt,
        });
        trackUrl = created.url;
        setTrackLink(trackUrl);
      }

      const finalSubject = applyPlaceholders(subject, headers, row);
      const renderedBody = applyPlaceholders(body, headers, row);
      const hadLinkToken = renderedBody.includes("{{Quote Link}}");
      const messageText = renderedBody.split("{{Quote Link}}").join(trackUrl || "");
      const fileName = `${preset.name}-${quotationId || "quotation"}.pdf`;

      // ---- Resend: branded HTML + tokenized CTAs to our own backend ----
      if (useResend) {
        if (attachMode === "googledoc") {
          setStatus({
            state: "error",
            message:
              "Google Doc PDF export is only available on the Gmail path. Choose Native PDF or No attachment for Resend.",
          });
          return;
        }
        const html = buildQuoteEmailHtml({
          brandName: APP.name,
          companyLogo: logo || "",
          bodyText: messageText,
          quotationId,
          presetName: preset.name,
          quoteUrl: trackUrl,
          accent: accentColor(),
        });
        const attachments = [];
        if (attachMode === "native") {
          setStatus({ state: "sending", message: "Generating PDF attachment…" });
          attachments.push({ filename: fileName, content: await elementToPdfBase64(pdfStageRef.current) });
        }
        setStatus({ state: "sending", message: "Sending branded email via Resend…" });
        await sendViaResend({ to: recipient, subject: finalSubject, html, text: messageText, attachments });
        setStatus({ state: "sent", message: `Branded email sent to ${recipient} via Resend.` });
        if (canTrack) latestTrackedQuote(quotationId).then(setTracking);
        return;
      }

      // ---- Gmail / Apps Script (existing path, unchanged) ----
      const appsBody =
        trackUrl && !hadLinkToken
          ? `${messageText}\n\n— — —\nView your quotation online and respond:\n${trackUrl}`
          : messageText;
      const payload = {
        to: recipient,
        subject: finalSubject,
        body: appsBody,
        quotationId,
        presetName: preset.name,
        spreadsheetId: presetSheetId(preset),
        sheetTabName: preset.sheetTabName,
        companyLogo: logo || "",
        // Clean email: no Approve/Decline/Negotiate boxes — a single secure
        // document link instead (needs the updated Apps Script; see setup doc).
        plainMode: true,
        quoteUrl: trackUrl || "",
      };

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
          ? `Email sent to ${recipient} with the secure document link.`
          : `Email sent to ${recipient}.`,
      });
      if (canTrack) latestTrackedQuote(quotationId).then(setTracking);
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  const previewSubject = row ? applyPlaceholders(subject, headers, row) : subject;
  const rawPreviewBody = row ? applyPlaceholders(body, headers, row) : body;
  // On the Resend path the CTAs are real buttons (shown below), so the body just
  // drops the {{Quote Link}} token; on the Gmail path we show the inline link.
  const previewBody =
    provider === "resend" && canTrack
      ? rawPreviewBody.split("{{Quote Link}}").join("")
      : trackOn && canTrack
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

          {/* Delivery path (Phase 2): branded Resend vs Gmail/Apps Script */}
          {canTrack && (
            <div className="form-field">
              <span className="form-label"><Send size={13} /> Send with</span>
              <div className="attach-toggle">
                <button
                  className={`attach-btn ${provider === "resend" ? "is-active" : ""}`}
                  onClick={() => setProvider("resend")}
                  title="Branded email from your domain, with secure tokenized response buttons"
                >
                  Resend (branded)
                </button>
                <button
                  className={`attach-btn ${provider === "appsscript" ? "is-active" : ""}`}
                  onClick={() => setProvider("appsscript")}
                  title="Send through the existing Google Apps Script / Gmail path"
                >
                  Gmail
                </button>
              </div>
              {provider === "resend" && (
                <p className="form-hint track-hint">
                  Branded HTML from your verified domain. Approve / Decline / Negotiate
                  are secure tokenized links to your backend — a tracked quote is always created.
                </p>
              )}
            </div>
          )}

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
                Accept / Decline / Request changes. You'll see views and their response here.
              </p>

              {(trackOn || provider === "resend") && (
                <div className="track-validity">
                  <span className="form-label">Valid for</span>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    className="control track-days"
                    value={validDays}
                    onChange={(e) => setValidDays(e.target.value)}
                  />
                  <span className="form-hint">days {Number(validDays) > 0 ? "" : "(no expiry)"}</span>
                </div>
              )}

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
                    {tracking.version > 1 && ` · v${tracking.version}`}
                    {tracking.view_count > 0 && ` · ${tracking.view_count} view${tracking.view_count === 1 ? "" : "s"}`}
                    {tracking.signed_name && ` · signed: ${tracking.signed_name}`}
                    {tracking.response_note && ` · "${tracking.response_note}"`}
                    {tracking.created_at &&
                      ` · last sent ${new Date(tracking.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
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
              {(trackOn || provider === "resend") && canTrack && (
                <div className="email-preview-ctas">
                  <span className="email-cta cta-viewdoc">View Quotation</span>
                </div>
              )}
              <div className="email-preview-foot">Sent via Qyrova</div>
            </div>
          </div>
          <p className="form-hint">
            The email contains only your message and the secure document link — the
            recipient views, downloads, and approves/signs from that page.
            {attachMode !== "none" && " The quotation PDF is also attached."}
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
