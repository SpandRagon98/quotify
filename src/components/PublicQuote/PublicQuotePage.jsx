import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Download,
  Clock,
  History,
} from "lucide-react";
import Logo from "../common/Logo";
import DocumentPreview from "../common/DocumentPreview";
import { APP } from "../../config/appConfig";
import { downloadElementPdf } from "../../utils/pdf";
import {
  getTrackedQuote,
  recordQuoteView,
  respondToQuote,
  trackingEnabled,
} from "../../lib/quoteTracking";

const RESPONSES = [
  { key: "approved", label: "Accept", icon: CheckCircle2, cls: "pub-btn-approve" },
  { key: "negotiate", label: "Request changes", icon: MessageSquare, cls: "pub-btn-negotiate" },
  { key: "declined", label: "Decline", icon: XCircle, cls: "pub-btn-decline" },
];

const STATUS_LABEL = {
  approved: "Accepted",
  declined: "Declined",
  negotiate: "Changes requested",
};

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Standalone, no-login page a recipient opens at /q/<token>. Renders the branded
 * quotation, logs a view, and handles the full lifecycle: Download PDF, expiry,
 * and Accept / Request changes / Decline with a typed-name acceptance signature.
 * Rendered directly from main.jsx — it never mounts the authenticated app.
 */
export default function PublicQuotePage({ token }) {
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [signName, setSignName] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [submitting, setSubmitting] = useState("");
  const [finalStatus, setFinalStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const pdfStageRef = useRef(null);

  // Intent from the email CTA (?intent=approved|declined|negotiate). We PRE-SELECT
  // it but always require an explicit confirm, so mail-client link prefetching
  // can never trigger a false response.
  const intent = (() => {
    const v = new URLSearchParams(window.location.search).get("intent");
    return ["approved", "declined", "negotiate"].includes(v) ? v : "";
  })();

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", "indigo");
    if (intent === "negotiate") setShowNote(true);
    if (intent === "approved") setShowSig(true);
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
    if (key === "approved" && !signName.trim()) {
      setError("Please type your full name to accept this quotation.");
      return;
    }
    setSubmitting(key);
    setError("");
    try {
      const res = await respondToQuote(
        token,
        key,
        key === "negotiate" ? note : "",
        key === "approved" ? signName : ""
      );
      setFinalStatus(res?.status || key);
    } catch (err) {
      setError(err.message || "Could not record your response.");
    } finally {
      setSubmitting("");
    }
  };

  const handleClick = (key) => {
    setError("");
    if (key === "approved" && !showSig) return setShowSig(true);
    if (key === "negotiate" && !showNote) return setShowNote(true);
    handleRespond(key);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const name = `${snap.presetName || quote?.preset_name || "quotation"}-${
        snap.quotationId || quote?.quotation_id || "doc"
      }.pdf`;
      await downloadElementPdf(pdfStageRef.current, name);
    } catch (err) {
      setError(err.message || "Could not generate the PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const snap = quote?.snapshot || {};
  const expired = Boolean(quote?.is_expired) || quote?.status === "expired";
  const alreadyResponded =
    finalStatus ||
    (quote && ["approved", "declined", "negotiate"].includes(quote.status) ? quote.status : "");
  const version = quote?.version || 1;

  const docProps = {
    preset: snap.preset || { name: snap.presetName || "Quotation", fields: [] },
    values: snap.values || {},
    quotationId: snap.quotationId || quote?.quotation_id || "",
    mode: "data",
    logo: snap.logo || "",
    banner: snap.banner || "",
    description: snap.description || "",
    hiddenFields: snap.hiddenFields || [],
    extraContent: snap.extraContent || [],
  };

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
            {/* Lifecycle banner: version / validity */}
            <div className="pub-quote-meta">
              {version > 1 && (
                <span className="pub-quote-chip pub-chip-rev">
                  <History size={13} /> Revised · v{version}
                </span>
              )}
              {quote.expires_at && !alreadyResponded && (
                <span className={`pub-quote-chip ${expired ? "pub-chip-expired" : "pub-chip-valid"}`}>
                  <Clock size={13} /> {expired ? "Expired" : "Valid until"} {fmtDate(quote.expires_at)}
                </span>
              )}
              <button className="pub-quote-chip pub-chip-dl" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 size={13} className="spin" /> : <Download size={13} />} Download PDF
              </button>
            </div>

            <div className="pub-quote-doc">
              <DocumentPreview {...docProps} />
            </div>

            <div className="pub-quote-card pub-quote-actions">
              {alreadyResponded ? (
                <div className={`pub-quote-done pub-done-${alreadyResponded}`}>
                  {alreadyResponded === "approved" && <CheckCircle2 size={22} />}
                  {alreadyResponded === "declined" && <XCircle size={22} />}
                  {alreadyResponded === "negotiate" && <MessageSquare size={22} />}
                  <div>
                    <strong>{STATUS_LABEL[alreadyResponded]}</strong>
                    <p>
                      {quote.signed_name
                        ? `Signed by ${quote.signed_name}. `
                        : ""}
                      Thank you — your response has been sent to the sender.
                    </p>
                  </div>
                </div>
              ) : expired ? (
                <div className="pub-quote-done pub-done-declined">
                  <Clock size={22} />
                  <div>
                    <strong>This quotation has expired</strong>
                    <p>It was valid until {fmtDate(quote.expires_at)}. Please contact the sender for an updated quote.</p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="pub-quote-prompt">
                    {intent ? "Please confirm your response" : "How would you like to respond?"}
                  </h3>

                  {showSig && (
                    <label className="pub-quote-field">
                      <span>Type your full name to accept (acts as your signature)</span>
                      <input
                        className="control"
                        value={signName}
                        placeholder="e.g. Jane Smith"
                        onChange={(e) => setSignName(e.target.value)}
                      />
                    </label>
                  )}
                  {showNote && (
                    <textarea
                      className="control pub-quote-note"
                      rows={3}
                      value={note}
                      placeholder="What would you like to change? (optional message for the sender)…"
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}

                  <div className="pub-quote-btns">
                    {RESPONSES.map(({ key, label, icon: Icon, cls }) => (
                      <button
                        key={key}
                        className={`pub-btn ${cls} ${intent === key ? "pub-btn-suggested" : ""}`}
                        disabled={Boolean(submitting)}
                        onClick={() => handleClick(key)}
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

      {/* Off-screen A4 stage used to capture the Download PDF */}
      {state === "ready" && quote && (
        <div className="pdf-stage" ref={pdfStageRef} aria-hidden="true">
          <DocumentPreview {...docProps} />
        </div>
      )}
    </div>
  );
}
