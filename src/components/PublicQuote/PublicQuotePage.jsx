import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import Logo from "../common/Logo";
import DocumentPreview from "../common/DocumentPreview";
import { APP } from "../../config/appConfig";
import {
  getTrackedQuote,
  recordQuoteView,
  respondToQuote,
  trackingEnabled,
} from "../../lib/quoteTracking";

const RESPONSES = [
  { key: "approved", label: "Approve", icon: CheckCircle2, cls: "pub-btn-approve" },
  { key: "negotiate", label: "Negotiate", icon: MessageSquare, cls: "pub-btn-negotiate" },
  { key: "declined", label: "Decline", icon: XCircle, cls: "pub-btn-decline" },
];

const STATUS_LABEL = {
  approved: "Approved",
  declined: "Declined",
  negotiate: "Negotiation requested",
};

/**
 * Standalone, no-login page a recipient opens at /q/<token>. It renders the
 * branded quotation document, logs a view, and lets the recipient respond.
 * Rendered directly from main.jsx — it never mounts the authenticated app.
 */
export default function PublicQuotePage({ token }) {
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState("");
  const [finalStatus, setFinalStatus] = useState(""); // set after responding

  // Intent passed from the email CTA buttons (?intent=approved|declined|negotiate).
  // We PRE-SELECT it but still require an explicit confirm click, so mail-client
  // link prefetching can never trigger a false response.
  const intent = (() => {
    const v = new URLSearchParams(window.location.search).get("intent");
    return ["approved", "declined", "negotiate"].includes(v) ? v : "";
  })();

  // A clean, branded default look for external recipients.
  useEffect(() => {
    document.documentElement.setAttribute("data-accent", "indigo");
    if (intent === "negotiate") setShowNote(true);
  }, [intent]);

  useEffect(() => {
    let cancelled = false;
    if (!trackingEnabled()) {
      setState("missing");
      return undefined;
    }
    (async () => {
      try {
        const data = await getTrackedQuote(token);
        if (cancelled) return;
        if (!data) {
          setState("missing");
          return;
        }
        setQuote(data);
        setState("ready");
        recordQuoteView(token); // fire-and-forget
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not load this quotation.");
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRespond = async (key) => {
    setSubmitting(key);
    setError("");
    try {
      const res = await respondToQuote(token, key, key === "negotiate" ? note : "");
      setFinalStatus(res?.status || key);
    } catch (err) {
      setError(err.message || "Could not record your response.");
    } finally {
      setSubmitting("");
    }
  };

  const alreadyResponded =
    finalStatus ||
    (quote && ["approved", "declined", "negotiate"].includes(quote.status) ? quote.status : "");

  const snap = quote?.snapshot || {};

  return (
    <div className="pub-quote">
      <header className="pub-quote-bar">
        <div className="pub-quote-brand">
          <span className="pub-quote-mark"><Logo size={22} /></span>
          <span className="pub-quote-name">{APP.name}</span>
        </div>
        <span className="pub-quote-secure">
          <ShieldCheck size={14} /> Secure quotation
        </span>
      </header>

      <main className="pub-quote-body">
        {state === "loading" && (
          <div className="pub-quote-status">
            <Loader2 size={22} className="spin" /> Loading your quotation…
          </div>
        )}

        {state === "missing" && (
          <div className="pub-quote-card pub-quote-message">
            <AlertCircle size={28} />
            <h2>Quotation not found</h2>
            <p>This link may have expired or been revoked. Please contact the sender for an updated link.</p>
          </div>
        )}

        {state === "error" && (
          <div className="pub-quote-card pub-quote-message">
            <AlertCircle size={28} />
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        )}

        {state === "ready" && quote && (
          <>
            <div className="pub-quote-doc">
              <DocumentPreview
                preset={snap.preset || { name: snap.presetName || "Quotation", fields: [] }}
                values={snap.values || {}}
                quotationId={snap.quotationId || quote.quotation_id || ""}
                mode="data"
                logo={snap.logo || ""}
                banner={snap.banner || ""}
                description={snap.description || ""}
                hiddenFields={snap.hiddenFields || []}
                extraContent={snap.extraContent || []}
              />
            </div>

            <div className="pub-quote-card pub-quote-actions">
              {alreadyResponded ? (
                <div className={`pub-quote-done pub-done-${alreadyResponded}`}>
                  {alreadyResponded === "approved" && <CheckCircle2 size={22} />}
                  {alreadyResponded === "declined" && <XCircle size={22} />}
                  {alreadyResponded === "negotiate" && <MessageSquare size={22} />}
                  <div>
                    <strong>{STATUS_LABEL[alreadyResponded]}</strong>
                    <p>Thank you — your response has been sent to the sender.</p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="pub-quote-prompt">
                    {intent ? "Please confirm your response" : "How would you like to respond?"}
                  </h3>
                  {showNote && (
                    <textarea
                      className="control pub-quote-note"
                      rows={3}
                      value={note}
                      placeholder="Optional message for the sender (e.g. what you'd like to negotiate)…"
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}
                  <div className="pub-quote-btns">
                    {RESPONSES.map(({ key, label, icon: Icon, cls }) => (
                      <button
                        key={key}
                        className={`pub-btn ${cls} ${intent === key ? "pub-btn-suggested" : ""}`}
                        disabled={Boolean(submitting)}
                        onClick={() => {
                          if (key === "negotiate" && !showNote) {
                            setShowNote(true);
                            return;
                          }
                          handleRespond(key);
                        }}
                      >
                        {submitting === key ? <Loader2 size={17} className="spin" /> : <Icon size={17} />}
                        {label}
                      </button>
                    ))}
                  </div>
                  {error && (
                    <div className="alert alert-error pub-quote-err">
                      <AlertCircle size={16} /> <span>{error}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="pub-quote-foot">
        Powered by <strong>{APP.name}</strong>
      </footer>
    </div>
  );
}
