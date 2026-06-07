import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, Trash2, Calculator, Plus } from "lucide-react";
import { FIELD_TYPES, TEXT_MODES, fieldTypeHasOptions } from "../../utils/fieldFormatters";
import { validateFormula } from "../../utils/formula";

const FORMATS = [
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
];

/**
 * Compact editor for a single subfield. Supports the same field types and the
 * calculated-field option, but cannot itself hold further subfields.
 */
export default function SubfieldEditor({
  subfield,
  parentLabel,
  index,
  total,
  usableFields = [],
  onChange,
  onRemove,
  onMove,
}) {
  const update = (patch) => onChange({ ...subfield, ...patch });

  const formulaCheck = subfield.calculated
    ? validateFormula(subfield.formula || "", usableFields.map((f) => f.label))
    : { ok: true, error: "" };

  const insertIntoFormula = (label) =>
    update({ formula: `${subfield.formula || ""}${subfield.formula ? " " : ""}${label}` });

  return (
    <motion.div
      className="subfield-editor"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="subfield-editor-head">
        <span className="subfield-tag">
          ↳ {parentLabel ? `${parentLabel} ·` : ""} Subfield {index + 1}
        </span>
        {subfield.calculated && (
          <span className="calc-badge"><Calculator size={11} /> Calculated</span>
        )}
        <div className="field-editor-tools">
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(index, index - 1)} title="Move up">
            <ChevronUp size={15} />
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} title="Move down">
            <ChevronDown size={15} />
          </button>
          <button className="icon-btn icon-btn-danger" onClick={() => onRemove(subfield.id)} title="Remove subfield">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="field-editor-grid">
        <label className="form-field">
          <span className="form-label">Subfield label</span>
          <input
            className="control"
            value={subfield.label}
            placeholder="e.g. Table Cost"
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>

        {!subfield.calculated && (
          <label className="form-field">
            <span className="form-label">Type</span>
            <select className="control" value={subfield.type} onChange={(e) => update({ type: e.target.value })}>
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        )}

        {!subfield.calculated && subfield.type === "text" && (
          <label className="form-field">
            <span className="form-label">Allowed characters</span>
            <select className="control" value={subfield.textMode || "any"} onChange={(e) => update({ textMode: e.target.value })}>
              {TEXT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        )}

        {!subfield.calculated && subfield.type !== "boolean" && (
          <label className="form-field">
            <span className="form-label">Default value</span>
            <input
              className="control"
              value={subfield.defaultValue}
              placeholder="Optional"
              onChange={(e) => update({ defaultValue: e.target.value })}
            />
          </label>
        )}

        {!subfield.calculated && fieldTypeHasOptions(subfield.type) && (
          <label className="form-field form-field-wide">
            <span className="form-label">Dropdown options (comma separated)</span>
            <input
              className="control"
              value={(subfield.options || []).join(", ")}
              placeholder="Option A, Option B"
              onChange={(e) =>
                update({ options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })
              }
            />
          </label>
        )}
      </div>

      {subfield.calculated && (
        <div className="calc-config">
          <label className="form-field form-field-wide">
            <span className="form-label">Formula</span>
            <input
              className={`control ${!formulaCheck.ok ? "control-error" : ""}`}
              value={subfield.formula || ""}
              placeholder="e.g. Quantity * Price"
              onChange={(e) => update({ formula: e.target.value })}
            />
            {!formulaCheck.ok ? (
              <span className="form-error">{formulaCheck.error}</span>
            ) : (
              <span className="form-hint">Use + - * / and ( ). Reference number fields/subfields by name.</span>
            )}
          </label>

          {usableFields.length > 0 && (
            <div className="form-field form-field-wide">
              <span className="form-label">Insert field</span>
              <div className="calc-field-chips">
                {usableFields.map((f) => (
                  <button key={f.id} type="button" className="calc-chip" onClick={() => insertIntoFormula(f.label)} title={`Insert ${f.label}`}>
                    <Plus size={12} /> {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field-editor-grid">
            <label className="form-field">
              <span className="form-label">Format</span>
              <select className="control" value={subfield.format || "number"} onChange={(e) => update({ format: e.target.value })}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Decimals</span>
              <input className="control" type="number" min="0" max="6" value={subfield.decimals} placeholder="auto" onChange={(e) => update({ decimals: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Prefix</span>
              <input className="control" value={subfield.prefix} placeholder="e.g. ₹" onChange={(e) => update({ prefix: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Suffix</span>
              <input className="control" value={subfield.suffix} placeholder="e.g. /unit" onChange={(e) => update({ suffix: e.target.value })} />
            </label>
          </div>
        </div>
      )}

      <div className="subfield-editor-foot">
        <label className="toggle-row">
          <input type="checkbox" checked={Boolean(subfield.calculated)} onChange={(e) => update({ calculated: e.target.checked })} />
          <span><Calculator size={13} /> Calculated</span>
        </label>
        {!subfield.calculated && (
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(subfield.required)} onChange={(e) => update({ required: e.target.checked })} />
            <span>Required</span>
          </label>
        )}
      </div>
    </motion.div>
  );
}
