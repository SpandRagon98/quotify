import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { useJourney } from "./useJourney";
import { money } from "./schema";
import { EmptyState, PageHeader, Skeleton } from "./JourneyUI";
import Modal from "../components/common/Modal";
import { RelationSelect } from "./RecordForm";
export default function DocumentsHub({ env, go, presets, onCreateQuote }) {
  const [template, setTemplate] = useState(null);
  const [customer, setCustomer] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const data = useJourney("quote_links", env.user.orgId, {
    page,
    query,
    filters: { document_kind: kind },
  });
  return (
    <div className="screen screen-wide">
      <Modal
        open={!!template}
        title="Connect this quotation to a customer"
        onClose={() => setTemplate(null)}
      >
        <label className="form-field">
          <span className="form-label">Customer</span>
          <RelationSelect
            entity="accounts"
            env={env}
            value={customer}
            onChange={setCustomer}
          />
        </label>
        <button
          className="btn btn-primary"
          disabled={!customer}
          onClick={() => {
            onCreateQuote({ account_id: customer, preset_id: template.id });
            setTemplate(null);
          }}
        >
          Continue with template
        </button>
      </Modal>
      <PageHeader
        title="Documents"
        subtitle="From the first proposal to the final invoice."
      >
        <button className="btn btn-soft" onClick={() => go("database")}>
          Existing quotation records
        </button>
        <button className="btn btn-soft" onClick={() => go("docview")}>
          Template previews
        </button>
        <button className="btn btn-soft" onClick={() => go("email")}>
          Email history & templates
        </button>
      </PageHeader>
      <div className="document-create-options">
        {["Quotation", "Invoice", "Proposal"].map((type) => (
          <button
            key={type}
            disabled={!env.access.quotations?.create}
            onClick={() => go("quote_wizard", { documentKind: type })}
          >
            <FileText size={22} />
            <strong>{type}</strong>
            <span>
              {type === "Quotation"
                ? "Turn the requirement into a clear price."
                : type === "Invoice"
                  ? "Continue naturally after a win."
                  : "Share your approach and scope."}
            </span>
            <Plus size={17} />
          </button>
        ))}
      </div>
      {presets.length > 0 && (
        <details className="custom-template-picker">
          <summary>Use an existing custom template</summary>
          <div>
            {presets.map((preset) => (
              <button
                className="btn btn-soft"
                key={preset.id}
                disabled={!env.access.quotations?.create}
                onClick={() => setTemplate(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <p className="form-hint">
            Custom fields, calculated values, Google Sheets and Google Docs
            remain available in your template workflow.
          </p>
        </details>
      )}
      <div className="crm-toolbar">
        <input
          className="control"
          aria-label="Search documents"
          placeholder="Find a document number or template…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="control"
          aria-label="Document type"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All documents</option>
          {["Quotation", "Invoice", "Proposal"].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </div>
      {data.error && <p className="alert alert-error">{data.error}</p>}
      {data.loading ? (
        <Skeleton />
      ) : data.rows.length ? (
        <div className="journey-table-wrap">
          <table className="journey-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Value</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <button
                      className="crm-record-link"
                      onClick={() =>
                        go("crm_record", { entity: "quote_links", id: doc.id })
                      }
                    >
                      {doc.quotation_id}
                    </button>
                    <small>{doc.preset_name}</small>
                  </td>
                  <td>{doc.document_kind}</td>
                  <td>{money(doc.amount, doc.currency)}</td>
                  <td>{doc.status}</td>
                  <td>
                    {doc.sent_at
                      ? new Date(doc.sent_at).toLocaleDateString()
                      : "Not sent"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Your first document starts a conversation"
          text="Create a quotation, invoice or proposal connected to your customer."
          action={
            env.access.quotations?.create ? "Create quotation" : undefined
          }
          onAction={() => go("quote_wizard")}
        />
      )}
      <div className="crm-pagination">
        <span>{data.count} documents</span>
        <div>
          <button
            className="btn btn-soft"
            disabled={!page}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <button
            className="btn btn-soft"
            disabled={(page + 1) * 25 >= data.count}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
