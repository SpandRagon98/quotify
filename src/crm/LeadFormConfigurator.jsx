import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "../components/common/Modal";
import { saveRecord } from "./service";
import {
  FIXED_LEAD_FIELDS,
  OPTIONAL_STANDARD_LEAD_FIELDS,
  leadFormFields,
  leadPayload,
  newCustomLeadField,
  normalizeLeadFormFields,
  validateLeadFormConfig,
} from "./leadForm";

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
  return <input {...props} type={field.type} min={field.type === "number" ? "0" : undefined} />;
}

export function LeadCreateForm({ config, env, onClose, onSaved }) {
  const fields = useMemo(() => leadFormFields(config), [config]);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key, value) => setValues((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = leadPayload(values, config);
      if (!payload.name || !payload.company_name)
        throw new Error("Name and company are required.");
      const lead = await saveRecord("leads", env.user.orgId, {
        owner_id: env.user.id,
        source: "Manual",
        status: "New",
        stage: "Enquiry",
        priority: "Normal",
        ...payload,
      });
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
        <p className="form-hint">Fields marked with * are required for every lead.</p>
        <div className="crm-form-grid">
          {fields.map((field) => (
            <label key={field.id || field.key} className={`form-field ${field.type === "textarea" ? "crm-full" : ""}`}>
              <span className="form-label">{field.label}{field.required && " *"}</span>
              <FieldControl field={field} value={values[field.key]} onChange={change} />
            </label>
          ))}
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="crm-form-actions">
          <button type="button" className="btn btn-soft" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Create lead"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function LeadFormConfigurator({ config, onClose, onSave }) {
  const [fields, setFields] = useState(() => normalizeLeadFormFields(config));
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
      await onSave(normalized);
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
      <p>Choose the fields your team sees when creating a lead. Name and Company stay required; all other fields can be changed or removed.</p>
      <div className="lead-fixed-fields">
        {FIXED_LEAD_FIELDS.map((field) => <span key={field.key}>{field.label} <strong>Required</strong></span>)}
      </div>
      <div className="lead-form-builder">
        {fields.map((field) => (
          <div className="lead-form-builder-row" key={field.id}>
            <label className="form-field"><span className="form-label">Field name</span><input className="control" value={field.label} maxLength="80" onChange={(event) => patch(field.id, { label: event.target.value })} /></label>
            {field.kind === "custom" ? (
              <label className="form-field"><span className="form-label">Answer type</span><select className="control" value={field.type} onChange={(event) => patch(field.id, { type: event.target.value, options: event.target.value === "select" ? field.options : [] })}>{CUSTOM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            ) : <div className="lead-field-kind">Standard CRM field<br /><small>{field.type}</small></div>}
            <label className="crm-check"><input type="checkbox" checked={field.required} onChange={(event) => patch(field.id, { required: event.target.checked })} />Required</label>
            <button className="icon-btn icon-btn-danger" title={`Remove ${field.label}`} onClick={() => setFields((old) => old.filter((item) => item.id !== field.id))}><Trash2 size={16} /></button>
            {field.type === "select" && <label className="form-field lead-field-options"><span className="form-label">Options (comma separated)</span><input className="control" value={field.options.join(", ")} onChange={(event) => patch(field.id, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>}
          </div>
        ))}
      </div>
      <div className="crm-tab-actions">
        {available.length > 0 && <select className="control lead-add-standard" defaultValue="" onChange={(event) => { const selected = available.find((item) => item.key === event.target.value); if (selected) setFields((old) => [...old, { ...selected, id: `standard:${selected.key}`, required: false }]); event.target.value = ""; }}><option value="">Add a standard CRM field…</option>{available.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>}
        <button className="btn btn-soft" onClick={() => setFields((old) => [...old, newCustomLeadField()])}><Plus size={15} />Add custom field</button>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </Modal>
  );
}
