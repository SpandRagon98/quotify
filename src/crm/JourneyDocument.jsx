const money = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
import Logo from "../components/common/Logo";
export default function JourneyDocument({ document, reference, logo }) {
  const doc = document;
  return (
    <div className="doc-preview journey-document">
      <header>
        {logo ? <img src={logo} alt="Company logo" /> : <Logo size={29} />}
        <div>
          <strong>{doc.company || "Qyrova"}</strong>
          <span>{doc.kind}</span>
        </div>
        <div>
          <strong>{reference || "Draft"}</strong>
          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
        </div>
      </header>
      <section>
        <small>Prepared for</small>
        <h2>{doc.customer_name}</h2>
        <p>{doc.company_name}</p>
        <p>{doc.email}</p>
        {doc.valid_until && (
          <p>
            {doc.kind === "Invoice" ? "Due" : "Valid until"}:{" "}
            {new Date(`${doc.valid_until}T12:00:00`).toLocaleDateString()}
          </p>
        )}
      </section>
      <table>
        <thead>
          <tr>
            <th>Product / service</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Discount</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{money(item.price, doc.currency)}</td>
              <td>{item.discount || 0}%</td>
              <td>
                {money(
                  Number(item.quantity) *
                    Number(item.price) *
                    (1 - Number(item.discount || 0) / 100),
                  doc.currency,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="document-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(doc.totals.subtotal, doc.currency)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>{money(doc.totals.discount, doc.currency)}</dd>
        </div>
        <div>
          <dt>Tax ({doc.tax_percent}%)</dt>
          <dd>{money(doc.totals.tax, doc.currency)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{money(doc.totals.total, doc.currency)}</dd>
        </div>
      </dl>
      <section>
        <h3>Terms</h3>
        <p className="crm-preserve-lines">
          {doc.terms || "Please contact us with any questions."}
        </p>
      </section>
      <footer>Prepared with Qyrova</footer>
    </div>
  );
}
