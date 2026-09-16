import { useEffect, useState } from "react";
import Modal from "../components/common/Modal";
import { getRecord, listRecords } from "./service";
import { RelationSelect } from "./RecordForm";
import { flattenFields } from "../utils/subfields";
import { useCRM } from "./context";
import { customerValues } from "./helpers";
export default function QuotationPrefill({
  context,
  env,
  presets,
  onClose,
  onContinue,
}) {
  const cloudEnv = useCRM();
  env = env || cloudEnv;
  const [presetId, setPresetId] = useState(presets[0]?.id || "");
  const [customer, setCustomer] = useState(null);
  const [mapping, setMapping] = useState({});
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [contactId, setContactId] = useState(context.contact_id || "");
  const [opportunityId, setOpportunityId] = useState(
    context.opportunity_id || "",
  );
  const [resolvedContact, setResolvedContact] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([
      getRecord("accounts", env.user.orgId, context.account_id),
      contactId
        ? getRecord("contacts", env.user.orgId, contactId)
        : listRecords("contacts", env.user.orgId, {
            size: 1,
            related: { account_id: context.account_id, is_primary: true },
          }).then((data) => data.rows[0] || null),
    ])
      .then(([account, contact]) => {
        if (active) {
          setCustomer(customerValues(account, contact));
          setResolvedContact(contact);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [env.user.orgId, context.account_id, contactId]);
  const preset = presets.find((p) => p.id === presetId);
  const leaves = flattenFields(preset?.fields || []).filter(
    (l) => !l.field.calculated,
  );
  return (
    <Modal open wide title="Create customer quotation" onClose={onClose}>
      <p>
        Qyrova presets use custom fields. Review the mapping below; only fields
        you select are prefilled. The original quotation form, validation and
        PDF flow are unchanged.
      </p>
      <label className="form-field">
        <span className="form-label">Preset</span>
        <select
          className="control"
          value={presetId}
          onChange={(e) => {
            setPresetId(e.target.value);
            setMapping({});
          }}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="crm-form-grid">
        <label className="form-field">
          <span className="form-label">
            Contact (defaults to primary contact)
          </span>
          <RelationSelect
            entity="contacts"
            env={env}
            accountId={context.account_id}
            value={contactId || resolvedContact?.id || ""}
            onChange={(value) => {
              setLoading(true);
              setContactId(value);
            }}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Related opportunity (optional)</span>
          <RelationSelect
            entity="opportunities"
            env={env}
            accountId={context.account_id}
            value={opportunityId}
            onChange={setOpportunityId}
          />
        </label>
      </div>
      {customer && (
        <div className="crm-form-grid">
          {leaves.map((leaf) => (
            <label className="form-field" key={leaf.valueId}>
              <span className="form-label">{leaf.columnLabel}</span>
              <select
                className="control"
                aria-label={leaf.columnLabel}
                value={mapping[leaf.valueId] || ""}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [leaf.valueId]: e.target.value }))
                }
              >
                <option value="">
                  Leave original default / enter manually
                </option>
                {Object.entries(customer)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <option key={key} value={key}>
                      {key}: {value}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <label className="form-field">
        <span className="form-label">
          Quotation amount for CRM (optional · {context.currency || "INR"})
        </span>
        <input
          className="control"
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <small className="form-hint">
          A reporting amount only. This does not change any calculated quotation
          field.
        </small>
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      {!presets.length && (
        <p>Create a quotation preset first, then return to this customer.</p>
      )}
      <div className="crm-form-actions">
        <button className="btn btn-soft" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={!preset || !customer || loading || !!error}
          onClick={() =>
            onContinue({
              presetId,
              initialValues: Object.fromEntries(
                Object.entries(mapping)
                  .filter(([, key]) => key)
                  .map(([id, key]) => [id, customer[key]]),
              ),
              crmContext: {
                ...context,
                contact_id: contactId || resolvedContact?.id || null,
                opportunity_id: opportunityId || null,
                amount: amount === "" ? null : Number(amount),
              },
            })
          }
        >
          Review in quotation form
        </button>
      </div>
    </Modal>
  );
}
