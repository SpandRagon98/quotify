import { useRef, useState } from "react";
import { Plus, Trash2, Download, Mail, Link, ArrowLeft } from "lucide-react";
import { useCRM } from "./context";
import { RelationSelect } from "./RecordForm";
import { getRecord, rpc, saveRecord } from "./service";
import { createTrackedQuote } from "../lib/quoteTracking";
import { sendQuotationEmail } from "../services/emailService";
import { downloadElementPdf } from "../utils/pdf";
import { loadCloudState } from "../lib/cloudStore";
import { calculateDocument } from "./documentModel";
import CustomerCreate from "./CustomerCreate";
import JourneyDocument from "./JourneyDocument";
import { PageHeader } from "./JourneyUI";
import { money } from "./schema";
const STEPS = ["Customer", "Items", "Terms", "Review", "Send"];
export default function QuoteStepper({
  user,
  go,
  documentKind = "Quotation",
  context = {},
}) {
  const env = useCRM();
  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState(context?.account_id || "");
  const [dealId, setDealId] = useState(context?.opportunity_id || "");
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([
    { name: "", quantity: 1, price: "", discount: 0 },
  ]);
  const [terms, setTerms] = useState(
    "Payment: 50% advance, balance on completion.",
  );
  const [expiry, setExpiry] = useState("");
  const [tax, setTax] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [doc, setDoc] = useState(null);
  const [saved, setSaved] = useState(null);
  const [share, setShare] = useState(null);
  const [sent, setSent] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recipient, setRecipient] = useState("");
  const preview = useRef(null);
  const next = async () => {
    setError("");
    setBusy(true);
    try {
      if (step === 0) {
        if (!customerId) throw new Error("Choose a customer first.");
        const [account, contacts] = await Promise.all([
          getRecord("accounts", user.orgId, customerId),
          import("./journeyService").then(({ journeyRecords }) =>
            journeyRecords("accounts", user.orgId, { id: customerId }),
          ),
        ]);
        const facts = contacts.rows[0];
        setCustomer({
          ...account,
          customer_name: facts?.customer_name || account.name,
          email: facts?.customer_email || account.email,
          contact_id: facts?.contact_id,
        });
        setRecipient(facts?.customer_email || account.email || "");
      }
      if (step === 1) {
        if (!items.length || items.some((item) => !item.name.trim()))
          throw new Error("Add at least one named product or service.");
        calculateDocument(items, tax);
      }
      if (step === 2) {
        if (expiry && Date.parse(`${expiry}T23:59:59`) < Date.now())
          throw new Error("Choose a future validity or due date.");
        const setup = await loadCloudState("journey_setup");
        setDoc({
          kind: documentKind,
          company: setup?.company || "",
          customer_name: customer.customer_name,
          company_name: customer.name,
          email: recipient,
          items,
          tax_percent: tax,
          totals: calculateDocument(items, tax),
          currency,
          terms,
          valid_until: expiry,
          created_at: new Date().toISOString(),
        });
      }
      if (step === 3) await saveDocument();
      setStep((old) => old + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveDocument = async () => {
    if (saved) return saved;
    const reference = `${documentKind === "Invoice" ? "INV" : documentKind === "Proposal" ? "PRP" : "QY"}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const row = await saveRecord("quote_links", user.orgId, {
      owner_id: user.id,
      account_id: customerId,
      contact_id: customer.contact_id || null,
      opportunity_id: dealId || null,
      preset_id: `native-${documentKind.toLowerCase()}`,
      preset_name: `Qyrova ${documentKind}`,
      quotation_id: reference,
      document_kind: documentKind,
      amount: doc.totals.total,
      currency,
      expires_at: expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null,
      values_snapshot: { __journey: doc },
    });
    setSaved(row);
    return row;
  };
  const link = async () => {
    if (share) return share;
    const row = await saveDocument();
    const value = await createTrackedQuote({
      quotationId: row.quotation_id,
      presetName: row.preset_name,
      recipientEmail: recipient,
      expiresAt: row.expires_at,
      snapshot: {
        preset: {
          id: row.preset_id,
          name: row.preset_name,
          fields: [],
          documentKind,
        },
        values: { __journey: doc },
        quotationId: row.quotation_id,
      },
    });
    setShare(value);
    return value;
  };
  if (!env.access.quotations?.create)
    return (
      <div className="screen">
        <p className="alert alert-error">
          You don't have permission to create documents.
        </p>
      </div>
    );
  return (
    <div className="screen screen-wide quote-stepper-screen">
      <PageHeader
        title={`New ${documentKind.toLowerCase()}`}
        subtitle="A professional document, connected to your customer and deal."
      >
        <button className="btn btn-soft" onClick={() => go("documents")}>
          <ArrowLeft size={15} />
          Documents
        </button>
      </PageHeader>
      <ol className="quote-stepper">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={
              index === step ? "current" : index < step ? "complete" : ""
            }
          >
            <span>{index < step ? "✓" : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="quote-step-content">
        {step === 0 && (
          <>
            <h2>Who is this for?</h2>
            <label className="form-field">
              <span className="form-label">Customer *</span>
              <RelationSelect
                entity="accounts"
                env={env}
                value={customerId}
                onChange={(id) => {
                  setCustomerId(id);
                  setDealId("");
                }}
              />
            </label>
            {env.access.leads?.create && (
              <button
                className="btn btn-soft"
                onClick={() => setNewCustomer(true)}
              >
                <Plus size={15} />
                Add customer
              </button>
            )}
            {customerId && (
              <label className="form-field">
                <span className="form-label">Related deal (optional)</span>
                <RelationSelect
                  entity="opportunities"
                  env={env}
                  accountId={customerId}
                  value={dealId}
                  onChange={setDealId}
                />
              </label>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <h2>What are you providing?</h2>
            <div className="document-line-items">
              <div className="line-item-labels">
                <span>Product / service</span>
                <span>Quantity</span>
                <span>Unit price</span>
                <span>Discount %</span>
                <span />
              </div>
              {items.map((item, index) => (
                <div className="document-line-item" key={index}>
                  {[
                    ["name", "text", "Product or service"],
                    ["quantity", "number", "Quantity"],
                    ["price", "number", "Unit price"],
                    ["discount", "number", "Discount"],
                  ].map(([key, type, label]) => (
                    <input
                      key={key}
                      className="control"
                      aria-label={`${label} ${index + 1}`}
                      placeholder={
                        key === "name" ? "e.g. Analytics consulting" : "0"
                      }
                      type={type}
                      min={key === "quantity" ? 0.01 : 0}
                      max={key === "discount" ? 100 : undefined}
                      step="any"
                      value={item[key]}
                      onChange={(e) =>
                        setItems((old) =>
                          old.map((row, i) =>
                            i === index
                              ? { ...row, [key]: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  ))}
                  <button
                    className="icon-btn"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() =>
                      setItems((old) => old.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn btn-soft"
              onClick={() =>
                setItems((old) => [
                  ...old,
                  { name: "", quantity: 1, price: "", discount: 0 },
                ])
              }
            >
              <Plus size={15} />
              Add item
            </button>
            <div className="crm-form-grid">
              <label className="form-field">
                <span className="form-label">Tax %</span>
                <input
                  className="control"
                  type="number"
                  min="0"
                  max="100"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Currency</span>
                <select
                  className="control"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {["INR", "USD", "EUR", "GBP"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Set clear expectations</h2>
            <label className="form-field">
              <span className="form-label">
                {documentKind === "Invoice" ? "Due date" : "Valid until"}
              </span>
              <input
                className="control"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Payment terms and conditions</span>
              <textarea
                className="control"
                rows={7}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                maxLength={5000}
              />
            </label>
          </>
        )}
        {step === 3 && doc && <JourneyDocument document={doc} />}
        {step === 4 && (
          <>
            <h2>
              {sent
                ? `Sent to ${recipient} ✓`
                : `${documentKind} ready to share`}
            </h2>
            <p>
              {saved?.quotation_id} · {money(doc.totals.total, currency)}
            </p>
            <p className="form-hint">
              Saved to the customer timeline. A quotation email will move the
              deal to Quote Sent and schedule a follow-up.
            </p>
            <label className="form-field">
              <span className="form-label">Recipient email</span>
              <input
                className="control"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={sent}
              />
            </label>
            <div className="quote-send-actions">
              <button
                className="btn btn-primary"
                disabled={busy || sent || !recipient}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setNotice("");
                  try {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
                      throw new Error("Enter a valid recipient email.");
                    const shared = await link();
                    const response = await sendQuotationEmail({
                      to: recipient,
                      subject: `Your ${documentKind.toLowerCase()} ${saved.quotation_id}`,
                      body: `Hi ${customer.customer_name},\n\nPlease find your ${documentKind.toLowerCase()} for ${money(doc.totals.total, currency)} at the link below. Let us know if you have any questions.\n\n${shared.url}`,
                      plainMode: true,
                      quoteUrl: shared.url,
                    });
                    if (response.mocked)
                      throw new Error(
                        "Connect your email integration in Settings before sending.",
                      );
                    setSent(true);
                    try {
                      await rpc("crm_log_quote_email", {
                        p_org: user.orgId,
                        p_quotation: saved.quotation_id,
                        p_preset: saved.preset_id,
                        p_recipient: recipient,
                      });
                    } catch (e) {
                      setError(
                        `Email sent. Timeline could not update: ${e.message}. Don't resend.`,
                      );
                    }
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Mail size={15} />
                {busy ? "Preparing…" : "Send email"}
              </button>
              <button
                className="btn btn-soft"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await downloadElementPdf(
                      preview.current,
                      `${saved.quotation_id}.pdf`,
                    );
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={15} />
                Download PDF
              </button>
              <button
                className="btn btn-soft"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const shared = await link();
                    await navigator.clipboard.writeText(shared.url);
                    setNotice(
                      "Link copied. Copying a link does not mark the quotation as emailed.",
                    );
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Link size={15} />
                Copy link
              </button>
            </div>
            {notice && <p className="alert alert-success">{notice}</p>}
            <button
              className="btn btn-soft"
              onClick={() =>
                go("crm_record", { entity: "accounts", id: customerId })
              }
            >
              Open customer timeline
            </button>
            <div ref={preview}>
              <JourneyDocument document={doc} reference={saved?.quotation_id} />
            </div>
          </>
        )}
        {error && <p className="alert alert-error">{error}</p>}
        {step < 4 && (
          <div className="crm-form-actions">
            <button
              className="btn btn-soft"
              disabled={step === 0 || busy}
              onClick={() => setStep((old) => old - 1)}
            >
              Back
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={next}>
              {busy
                ? "Saving…"
                : step === 3
                  ? "Save & continue to send"
                  : "Continue"}
            </button>
          </div>
        )}
      </div>
      {newCustomer && (
        <CustomerCreate
          env={env}
          onClose={() => setNewCustomer(false)}
          onSaved={(result) => {
            setCustomerId(result.account_id);
            setNewCustomer(false);
          }}
        />
      )}
    </div>
  );
}
