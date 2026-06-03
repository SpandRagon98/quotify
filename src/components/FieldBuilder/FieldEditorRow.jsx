import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, Trash2, GripVertical } from "lucide-react";
import { FIELD_TYPES, TEXT_MODES, fieldTypeHasOptions } from "../../utils/fieldFormatters";

export default function FieldEditorRow({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}) {
  const update = (patch) => onChange({ ...field, ...patch });

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
        <div className="field-editor-tools">
          <button
            className="icon-btn"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            title="Move up"
          >
            <ChevronUp size={16} />
          </button>
          <button
            className="icon-btn"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            title="Move down"
          >
            <ChevronDown size={16} />
          </button>
          <button
            className="icon-btn icon-btn-danger"
            onClick={() => onRemove(field.id)}
            title="Delete field"
          >
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
            placeholder="e.g. Customer Name"
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Type</span>
          <select
            className="control"
            value={field.type}
            onChange={(e) => update({ type: e.target.value })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        {field.type === "text" && (
          <label className="form-field">
            <span className="form-label">Allowed characters</span>
            <select
              className="control"
              value={field.textMode || "any"}
              onChange={(e) => update({ textMode: e.target.value })}
            >
              {TEXT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className="form-field">
          <span className="form-label">Placeholder / Help text</span>
          <input
            className="control"
            value={field.placeholder}
            placeholder="Optional hint shown in the input"
            onChange={(e) => update({ placeholder: e.target.value })}
          />
        </label>

        {field.type !== "boolean" && (
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

        {fieldTypeHasOptions(field.type) && (
          <label className="form-field form-field-wide">
            <span className="form-label">Dropdown options (comma separated)</span>
            <input
              className="control"
              value={(field.options || []).join(", ")}
              placeholder="Option A, Option B, Option C"
              onChange={(e) =>
                update({
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        )}
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => update({ required: e.target.checked })}
        />
        <span>Required field</span>
      </label>
    </motion.div>
  );
}
