import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, Trash2, GripVertical, Calculator, Plus } from "lucide-react";
import { FIELD_TYPES, TEXT_MODES, fieldTypeHasOptions } from "../../utils/fieldFormatters";
import { validateFormula } from "../../utils/formula";

const FORMATS = [
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
];

export default function FieldEditorRow({
  field,
  allFields = [],
  index,
  total,
  onChange,
  onRemove,
  onMove,
}) {
  const update = (patch) => onChange({ ...field, ...patch });

  // Fields usable inside a formula: number + boolean + other calculated fields.
  const usableFields = allFields.filter(
    (f) =>
      f.id !== field.id &&
      f.label.trim() &&
      (f.type === "number" || f.type === "boolean" || f.calculated)
  );
  // Boolean fields that can gate a number field.
  const toggleFields = allFields.filter((f) => f.type === "boolean" && f.label.trim());

  const formulaCheck = field.calculated
    ? validateFormula(field.formula || "", usableFields.map((f) => f.label))
    : { ok: true, error: "" };

  const insertIntoFormula = (label) =>
    update({ formula: `${field.formula || ""}${field.formula ? " " : ""}${label}` });

  return (
    <motion.div
      className="field-editor"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="field-editor-head">
        <span className="field-grip"><GripVertical size={16} /></span>
        <span className="field-index">Field {index + 1}</span>
        {field.calculated && (
          <span className="calc-badge"><Calculator size={12} /> Calculated</span>
        )}
        <div className="field-editor-tools">
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(index, index - 1)} title="Move up">
            <ChevronUp size={16} />
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} title="Move down">
            <ChevronDown size={16} />
          </button>
          <button className="icon-btn icon-btn-danger" onClick={() => onRemove(field.id)} title="Delete field">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="field-editor-grid">
        <label className="form-field">
          <span className="form-label">Label / Name</span>
          <input
            className="control"
            value={field.label}
            placeholder="e.g. Revenue"
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>

        {!field.calculated && (
          <label className="form-field">
            <span className="form-label">Type</span>
            <select className="control" value={field.type} onChange={(e) => update({ type: e.target.value })}>
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        )}

        {!field.calculated && field.type === "text" && (
          <label className="form-field">
            <span className="form-label">Allowed characters</span>
            <select className="control" value={field.textMode || "any"} onChange={(e) => update({ textMode: e.target.value })}>
              {TEXT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        )}

        {!field.calculated && (
          <label className="form-field">
            <span className="form-label">Placeholder / Help text</span>
            <input
              className="control"
              value={field.placeholder}
              placeholder="Optional hint shown in the input"
              onChange={(e) => update({ placeholder: e.target.value })}
            />
          </label>
        )}

        {!field.calculated && field.type !== "boolean" && (
          <label className="form-field">
            <span className="form-label">Default value</span>
            <input
              className="control"
              value={field.defaultValue}
              placeholder="Optional"
              onChange={(e) => update({ defaultValue: e.target.value })}
            />
          </label>
        )}

        {!field.calculated && fieldTypeHasOptions(field.type) && (
          <label className="form-field form-field-wide">
            <span className="form-label">Dropdown options (comma separated)</span>
            <input
              className="control"
              value={(field.options || []).join(", ")}
              placeholder="Option A, Option B, Option C"
              onChange={(e) =>
                update({ options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })
              }
            />
          </label>
        )}

        {/* Gate a number field to 0 when a chosen toggle is off. */}
        {!field.calculated && field.type === "number" && toggleFields.length > 0 && (
          <label className="form-field">
            <span className="form-label">Enabled by toggle (optional)</span>
            <select className="control" value={field.gateFieldId || ""} onChange={(e) => update({ gateFieldId: e.target.value })}>
              <option value="">Always counted</option>
              {toggleFields.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Calculated-field configuration */}
      {field.calculated && (
        <div className="calc-config">
          <label className="form-field form-field-wide">
            <span className="form-label">Formula</span>
            <input
              className={`control ${!formulaCheck.ok ? "control-error" : ""}`}
              value={field.formula || ""}
              placeholder="e.g. Quantity * Price"
              onChange={(e) => update({ formula: e.target.value })}
            />
            {!formulaCheck.ok ? (
              <span className="form-error">{formulaCheck.error}</span>
            ) : (
              <span className="form-hint">Use + - * / and ( ). Reference number fields by name.</span>
            )}
          </label>

          {usableFields.length > 0 && (
            <div className="form-field form-field-wide">
              <span className="form-label">Insert field</span>
              <div className="calc-field-chips">
                {usableFields.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="calc-chip"
                    onClick={() => insertIntoFormula(f.label)}
                    title={`Insert ${f.label}`}
                  >
                    <Plus size={12} /> {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field-editor-grid">
            <label className="form-field">
              <span className="form-label">Format</span>
              <select className="control" value={field.format || "number"} onChange={(e) => update({ format: e.target.value })}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Decimal places</span>
              <input
                className="control"
                type="number"
                min="0"
                max="6"
                value={field.decimals}
                placeholder="auto"
                onChange={(e) => update({ decimals: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Prefix</span>
              <input className="control" value={field.prefix} placeholder="e.g. ₹" onChange={(e) => update({ prefix: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Suffix</span>
              <input className="control" value={field.suffix} placeholder="e.g. /unit" onChange={(e) => update({ suffix: e.target.value })} />
            </label>
          </div>
        </div>
      )}

      <div className="field-editor-foot">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(field.calculated)}
            onChange={(e) => update({ calculated: e.target.checked })}
          />
          <span><Calculator size={14} /> Calculated field</span>
        </label>

        {!field.calculated && (
          <label className="toggle-row">
            <input type="checkbox" checked={field.required} onChange={(e) => update({ required: e.target.checked })} />
            <span>Required field</span>
          </label>
        )}
      </div>
    </motion.div>
  );
}
