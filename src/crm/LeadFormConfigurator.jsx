import { useMemo, useState } from "react";
import { Calculator, Home, Plus, Trash2 } from "lucide-react";
import Modal from "../components/common/Modal";
import { dispatchSalesAutomation, saveRecord } from "./service";
import {
  FIXED_LEAD_FIELDS,
  OPTIONAL_STANDARD_LEAD_FIELDS,
  leadFormFields,
  leadPayload,
  newCustomLeadField,
  normalizeLeadFormFields,
  validateLeadFormConfig,
} from "./leadForm";
import {
  applyInteriorProjectTemplate,
  DEFAULT_INTERIOR_PRICING,
  interiorEstimate,
  normalizeInteriorPricing,
} from "./interiorProject";

const CUSTOM_TYPES = [
  ["text", "Short text"],
  ["textarea", "Long text"],
  ["email", "Email"],
  ["tel", "Phone"],
  ["number", "Number"],
  ["date", "Date"],
  ["datetime-local", "Date & time"],
  ["select", "Dropdown"],
];

function FieldControl({ field, value, onChange }) {
  const props = {
    className: "control",
    value: value ?? "",
    required: field.required,
    onChange: (event) => onChange(field.key, event.target.value),
  };
  if (field.type === "textarea") return <textarea {...props} rows="3" />;
  if (field.type === "select")
    return (
      <select {...props}>
        <option value="">Select…</option>
        {field.options.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  if (field.type === "multiselect")
    return (
      <div className="lead-multiselect" role="group" aria-label={field.label}>
        {field.options.map((option) => {
          const selected = Array.isArray(value) && value.includes(option);
          return <label key={option}><input type="checkbox" checked={selected} onChange={(event) => {
            const old = Array.isArray(value) ? value : [];
            onChange(field.key, event.target.checked ? [...old, option] : old.filter((item) => item !== option));
          }} />{option}</label>;
        })}
      </div>
    );
  return <input {...props} type={field.type} min={field.type === "number" ? "0" : undefined} />;
}

export function LeadCreateForm({ config, pricing, env, onClose, onSaved }) {
  const fields = useMemo(() => leadFormFields(config), [config]);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const estimate = useMemo(() => interiorEstimate(values, pricing), [values, pricing]);
  const change = (key, value) => setValues((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = leadPayload(values, config);
      if (!payload.name) throw new Error("Name is required.");
      const missingField = fields.find((field) => field.required && (
        field.type === "multiselect"
          ? !Array.isArray(values[field.key]) || values[field.key].length === 0
          : values[field.key] == null || String(values[field.key]).trim() === ""
      ));
      if (missingField) throw new Error(`${missingField.label} is required.`);
      if (estimate) {
        payload.custom_fields = {
          ...payload.custom_fields,
          interior_estimate_low: estimate.low,
          interior_estimate_high: estimate.high,
          interior_rate_low_per_sqft: estimate.rateLow,
          interior_rate_high_per_sqft: estimate.rateHigh,
        };
        payload.estimated_value = estimate.low;
      }
      const lead = await saveRecord("leads", env.user.orgId, {
        owner_id: env.user.id,
        source: "Manual",
        status: "New",
        stage: "Enquiry",
        priority: "Normal",
        ...payload,
      });
      dispatchSalesAutomation(env.user.orgId).catch(() => {});
      onSaved(lead);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open wide title="New lead" onClose={() => !busy && onClose()}>
      <form onSubmit={submit}>
        <p className="form-hint">Fields marked with * are required. A company creates a Company account; leaving it blank creates a Personal account.</p>
        <div className="crm-form-grid">
          {fields.map((field) => (
            <label key={field.id || field.key} className={`form-field ${field.type === "textarea" ? "crm-full" : ""}`}>
              <span className="form-label">{field.label}{field.required && " *"}</span>
              <FieldControl field={field} value={values[field.key]} onChange={change} />
            </label>
          ))}
        </div>
        {estimate && <div className="interior-estimate-preview"><span>Indicative project range</span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(estimate.low)} – {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(estimate.high)}</strong><small>Based on carpet area, selected finish, city, style and scope. This is not a final quotation.</small></div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="crm-form-actions">
          <button type="button" className="btn btn-soft" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Create lead"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function LeadFormConfigurator({ config, pricing, onClose, onSave }) {
  const [fields, setFields] = useState(() => normalizeLeadFormFields(config));
  const [interiorPricing, setInteriorPricing] = useState(() => normalizeInteriorPricing(pricing));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const available = OPTIONAL_STANDARD_LEAD_FIELDS.filter(
    (candidate) => !fields.some((field) => field.kind === "standard" && field.key === candidate.key),
  );
  const patch = (id, update) => setFields((old) => old.map((field) => field.id === id ? { ...field, ...update } : field));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const normalized = validateLeadFormConfig(fields);
      await onSave(normalized, interiorPricing);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      wide
      title="Configure new lead form"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn btn-soft" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save form"}</button>
        </>
      }
    >
      <p>Choose the fields your team sees when creating a lead. Name stays required. A blank company creates a Personal customer account; a company name creates a Company account.</p>
      <div className="interior-template-callout">
        <div><Home size={18} /><span><strong>Interior project questionnaire</strong><small>Adds property, BHK, carpet area, locality, spaces, style, finish, budget and timeline—ready for residential enquiries.</small></span></div>
        <button type="button" className="btn btn-soft" onClick={() => setFields((old) => applyInteriorProjectTemplate(old))}>Use interior template</button>
      </div>
      <div className="lead-fixed-fields">
        {FIXED_LEAD_FIELDS.map((field) => <span key={field.key}>{field.label} {field.required && <strong>Required</strong>}</span>)}
      </div>
      <div className="lead-form-builder">
        {fields.map((field) => (
          <div className="lead-form-builder-row" key={field.id}>
            <label className="form-field"><span className="form-label">Field name</span><input className="control" value={field.label} maxLength="80" onChange={(event) => patch(field.id, { label: event.target.value })} /></label>
            {field.kind === "custom" ? (
              <label className="form-field"><span className="form-label">Answer type</span><select className="control" value={field.type} onChange={(event) => patch(field.id, { type: event.target.value, options: ["select", "multiselect"].includes(event.target.value) ? field.options : [] })}>{[...CUSTOM_TYPES, ["multiselect", "Multiple choice"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            ) : <div className="lead-field-kind">Standard CRM field<br /><small>{field.type}</small></div>}
            <label className="crm-check"><input type="checkbox" checked={field.required} onChange={(event) => patch(field.id, { required: event.target.checked })} />Required</label>
            <button className="icon-btn icon-btn-danger" title={`Remove ${field.label}`} onClick={() => setFields((old) => old.filter((item) => item.id !== field.id))}><Trash2 size={16} /></button>
            {["select", "multiselect"].includes(field.type) && <label className="form-field lead-field-options"><span className="form-label">Options (comma separated)</span><input className="control" value={field.options.join(", ")} onChange={(event) => patch(field.id, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>}
          </div>
        ))}
      </div>
      <div className="crm-tab-actions">
        {available.length > 0 && <select className="control lead-add-standard" defaultValue="" onChange={(event) => { const selected = available.find((item) => item.key === event.target.value); if (selected) setFields((old) => [...old, { ...selected, id: `standard:${selected.key}`, required: false }]); event.target.value = ""; }}><option value="">Add a standard CRM field…</option>{available.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>}
        <button className="btn btn-soft" onClick={() => setFields((old) => [...old, newCustomLeadField()])}><Plus size={15} />Add custom field</button>
      </div>
      <details className="interior-pricing-settings">
        <summary><Calculator size={16} />Interior estimate settings</summary>
        <p>The calculator gives an indicative range only. Adjust these carpet-area rates to match your own quote book; a detailed BOQ remains the final quote.</p>
        <div className="crm-form-grid">
          {Object.entries(interiorPricing.rateBands).map(([level, rates]) => <div key={level} className="interior-rate-row"><strong>{level}</strong><label className="form-field"><span className="form-label">From ₹/sq ft</span><input className="control" type="number" min="1" value={rates.min} onChange={(event) => setInteriorPricing((old) => ({ ...old, rateBands: { ...old.rateBands, [level]: { ...old.rateBands[level], min: Number(event.target.value) } } }))} /></label><label className="form-field"><span className="form-label">To ₹/sq ft</span><input className="control" type="number" min="1" value={rates.max} onChange={(event) => setInteriorPricing((old) => ({ ...old, rateBands: { ...old.rateBands, [level]: { ...old.rateBands[level], max: Number(event.target.value) } } }))} /></label></div>)}
          <label className="form-field"><span className="form-label">Full-home minimum (₹)</span><input className="control" type="number" min="1" value={interiorPricing.minimumProjectValue} onChange={(event) => setInteriorPricing((old) => ({ ...old, minimumProjectValue: Number(event.target.value) }))} /></label>
        </div>
        <button type="button" className="btn btn-soft" onClick={() => setInteriorPricing(DEFAULT_INTERIOR_PRICING)}>Restore suggested rates</button>
      </details>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </Modal>
  );
}
