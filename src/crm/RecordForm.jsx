import { useEffect, useState } from "react";
import Modal from "../components/common/Modal";
import { ENTITIES, displayName, formPayload } from "./schema";
import { getRecord, saveRecord } from "./service";
import { useRecords } from "./useRecords";
import { eligibleOwners } from "./helpers";
export function RelationSelect({
  entity,
  value,
  onChange,
  env,
  accountId,
  required = false,
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const { rows, error } = useRecords(entity, env.user.orgId, {
    size: 20,
    query,
    related: accountId ? { account_id: accountId } : {},
  });
  useEffect(() => {
    let active = true;
    if (value)
      getRecord(entity, env.user.orgId, value)
        .then((row) => {
          if (active) setSelected(row);
        })
        .catch(() => {
          if (active) setSelected(null);
        });
    return () => {
      active = false;
    };
  }, [entity, env.user.orgId, value]);
  const options =
    selected?.id === value && !rows.some((r) => r.id === value)
      ? [selected, ...rows]
      : rows;
  return (
    <div className="crm-relation">
      <input
        className="control"
        placeholder={`Find ${ENTITIES[entity].title.toLowerCase()}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Search ${entity}`}
      />
      <select
        className="control"
        required={required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Select ${entity}`}
      >
        <option value="">
          Select {ENTITIES[entity].singular.toLowerCase()}…
        </option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {displayName(entity, row)}
          </option>
        ))}
      </select>
      <small className="form-hint">
        Showing up to 20 matches. Search to find another record.
      </small>
      {error && <small className="form-error">{error}</small>}
    </div>
  );
}
function datetimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function RecordForm({
  entity,
  record = {},
  env,
  onClose,
  onSaved,
}) {
  const definition = ENTITIES[entity];
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      definition.fields.map((f) => [
        f.key,
        f.type === "datetime-local"
          ? datetimeValue(record[f.key])
          : (record[f.key] ??
            (f.key === "owner_id"
              ? env.user.id
              : (f.default ?? (f.type === "checkbox" ? false : "")))),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (key, value) =>
    setValues((old) => ({
      ...old,
      [key]: value,
      ...(key === "account_id" ? { contact_id: "", opportunity_id: "" } : {}),
    }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (
        entity === "activities" &&
        !["Note", "Email"].includes(values.activity_type) &&
        !["Completed", "Cancelled"].includes(values.status) &&
        !values.due_at
      )
        throw new Error("Choose a due date and time for this activity.");
      if (
        entity === "opportunities" &&
        values.stage === "Lost" &&
        !values.lost_reason?.trim()
      )
        throw new Error("Enter a lost reason.");
      const payload = formPayload(entity, values);
      if (entity === "inbox" && !record.id) {
        payload.raw_payload = { ...payload };
        payload.mapped_fields = { ...payload };
      }
      const row = await saveRecord(entity, env.user.orgId, payload, record.id);
      onSaved(row);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={`${record.id ? "Edit" : "Create"} ${definition.singular.toLowerCase()}`}
      wide
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="crm-form-grid">
          {definition.fields.map((f) => {
            const value = values[f.key];
            let input;
            const props = {
              className: "control",
              "aria-label": f.label,
              required: f.required,
              value: value ?? "",
              onChange: (e) => change(f.key, e.target.value),
              maxLength: f.type === "textarea" ? 10000 : 500,
            };
            if (f.type === "owner")
              input = (
                <select {...props}>
                  {eligibleOwners(env).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              );
            else if (f.type === "relation")
              input = (
                <RelationSelect
                  entity={f.entity}
                  env={env}
                  value={value}
                  onChange={(v) => change(f.key, v)}
                  accountId={f.dependsOn ? values[f.dependsOn] : null}
                  required={f.required}
                />
              );
            else if (f.type === "select")
              input = (
                <select
                  {...props}
                  disabled={
                    entity === "leads" &&
                    f.key === "status" &&
                    record.converted_at
                  }
                >
                  {(f.options || [])
                    .filter((v) => v !== "Converted" || record.converted_at)
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              );
            else if (f.type === "textarea")
              input = <textarea {...props} rows={3} />;
            else if (f.type === "checkbox")
              input = (
                <input
                  type="checkbox"
                  checked={!!value}
                  onChange={(e) => change(f.key, e.target.checked)}
                />
              );
            else if (f.type === "tags")
              input = (
                <input
                  {...props}
                  value={Array.isArray(value) ? value.join(", ") : value}
                />
              );
            else
              input = (
                <input
                  {...props}
                  type={f.type}
                  min={f.type === "number" ? 0 : undefined}
                  max={f.key === "probability" ? 100 : undefined}
                  step={f.type === "number" ? "any" : undefined}
                />
              );
            return (
              <label
                key={f.key}
                className={`form-field ${f.type === "textarea" ? "crm-full" : ""}`}
              >
                <span className="form-label">
                  {f.label}
                  {f.required && <span aria-hidden="true"> *</span>}
                </span>
                {input}
              </label>
            );
          })}
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="crm-form-actions">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
