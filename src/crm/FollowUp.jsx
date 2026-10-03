import { useState } from "react";
import Modal from "../components/common/Modal";
import { followUpText } from "./brain";
import { sendQuotationEmail } from "../services/emailService";
import { rpc } from "./service";
export default function FollowUp({ env, facts, onClose, onSent }) {
  const [to, setTo] = useState(facts.customer_email || facts.email || "");
  const [subject, setSubject] = useState(
    `Following up${facts.quotation_id ? ` on ${facts.quotation_id}` : " on our conversation"}`,
  );
  const [body, setBody] = useState(() =>
    followUpText(facts.customer_name || facts.name),
  );
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal open title="Follow up" onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (sent) return;
          setBusy(true);
          setError("");
          try {
            const response = await sendQuotationEmail({
              to,
              subject,
              body,
              plainMode: true,
            });
            if (response.mocked)
              throw new Error(
                "Connect your email integration in Settings before sending.",
              );
            setSent(true);
            try {
              await rpc("crm_record_followup", {
                p_org: env.user.orgId,
                p_account: facts.account_id || facts.id,
                p_opportunity: facts.opportunity_id || null,
                p_subject: subject,
                p_body: body,
                p_recipient: to,
              });
              onSent?.();
            } catch (historyError) {
              setError(
                `Email sent. History could not be saved: ${historyError.message}. Do not resend this email.`,
              );
            }
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="form-field">
          <span className="form-label">To</span>
          <input
            className="control"
            type="email"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={sent}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Subject</span>
          <input
            className="control"
            maxLength={300}
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sent}
          />
        </label>
        <div className="followup-tones">
          {[
            ["shorter", "Shorter"],
            ["warmer", "Warmer"],
            ["formal", "More formal"],
            ["default", "Regenerate"],
          ].map(([tone, label]) => (
            <button
              type="button"
              className="btn btn-soft btn-xs"
              key={tone}
              disabled={sent}
              onClick={() =>
                setBody(followUpText(facts.customer_name || facts.name, tone))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          className="control"
          rows={8}
          maxLength={10000}
          required
          aria-label="Follow-up message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sent}
        />
        {sent && <p className="alert alert-success">Email sent to {to}.</p>}
        {error && <p className="alert alert-error">{error}</p>}
        <div className="crm-form-actions">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy}
            onClick={onClose}
          >
            {sent ? "Done" : "Cancel"}
          </button>
          {!sent && (
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Send email"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
