import { useRef, useState } from "react";
import { Download, Link, Mail } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { createTrackedQuote, trackedQuoteUrl } from "../lib/quoteTracking";
import { sendQuotationEmail } from "../services/emailService";
import { downloadElementPdf } from "../utils/pdf";
import { rpc } from "./service";
import JourneyDocument from "./JourneyDocument";
export default function NativeDocumentActions({ record, env, onChanged }) {
  const doc = record.values_snapshot.__journey;
  const [recipient, setRecipient] = useState(doc.email || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const preview = useRef(null),
    share = useRef(null);
  const link = async () => {
    if (share.current) return share.current;
    const { data, error: requestError } = await supabase
      .from("tracked_quotes")
      .select("token,version")
      .eq("org_id", env.user.orgId)
      .eq("quotation_id", record.quotation_id)
      .eq("superseded", false)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (requestError) throw new Error(requestError.message);
    share.current = data
      ? { url: trackedQuoteUrl(data.token) }
      : await createTrackedQuote({
          quotationId: record.quotation_id,
          presetName: record.preset_name,
          recipientEmail: recipient,
          expiresAt: record.expires_at,
          snapshot: {
            preset: {
              id: record.preset_id,
              name: record.preset_name,
              fields: [],
            },
            values: record.values_snapshot,
            quotationId: record.quotation_id,
          },
        });
    return share.current;
  };
  const perform = async (action) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="crm-toolbar">
        <button
          className="btn btn-soft"
          disabled={busy}
          onClick={() =>
            perform(() =>
              downloadElementPdf(preview.current, record.quotation_id + ".pdf"),
            )
          }
        >
          <Download size={15} />
          Download PDF
        </button>
        {env.access.quotations?.edit && (
          <>
            <button
              className="btn btn-soft"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await navigator.clipboard.writeText((await link()).url);
                  setNotice(
                    "Link copied. It does not mark this document as emailed.",
                  );
                })
              }
            >
              <Link size={15} />
              Copy link
            </button>
            <input
              className="control"
              aria-label="Recipient email"
              type="email"
              value={recipient}
              disabled={sent}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={busy || sent || !recipient}
              onClick={() =>
                perform(async () => {
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
                    throw new Error("Enter a valid recipient email.");
                  const shared = await link();
                  const result = await sendQuotationEmail({
                    to: recipient,
                    subject: `Your ${doc.kind.toLowerCase()} ${record.quotation_id}`,
                    body: `Hi ${doc.customer_name},\n\nPlease review your ${doc.kind.toLowerCase()} here:\n${shared.url}`,
                    plainMode: true,
                    quoteUrl: shared.url,
                  });
                  if (result.mocked)
                    throw new Error(
                      "Connect your email integration in Settings before sending.",
                    );
                  setSent(true);
                  setNotice("Email sent.");
                  try {
                    await rpc("crm_log_quote_email", {
                      p_org: env.user.orgId,
                      p_quotation: record.quotation_id,
                      p_preset: record.preset_id,
                      p_recipient: recipient,
                    });
                    onChanged?.();
                  } catch (e) {
                    throw new Error(
                      "Email sent but timeline update failed: " +
                        e.message +
                        ". Do not resend.",
                    );
                  }
                })
              }
            >
              <Mail size={15} />
              {sent ? "Sent ✓" : "Send email"}
            </button>
          </>
        )}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {notice && <p className="alert alert-success">{notice}</p>}
      <div ref={preview}>
        <JourneyDocument document={doc} reference={record.quotation_id} />
      </div>
    </>
  );
}
