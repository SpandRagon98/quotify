import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Pencil, X, Calculator } from "lucide-react";
import FieldInput from "./FieldInput";
import { emptyValueForField } from "../../utils/fieldFormatters";
import { validateForm } from "../../utils/validation";
import { computeCalculatedValues, formatCalculated } from "../../utils/formula";

function initValues(preset, initialValues) {
  const values = {};
  preset.fields.forEach((f) => {
    if (f.calculated) return; // calculated fields are derived, not entered
    values[f.id] =
      initialValues && f.id in initialValues ? initialValues[f.id] : emptyValueForField(f);
  });
  return values;
}

/** Fills values for a preset, validates, then hands off to preview. */
export default function DynamicForm({
  preset,
  presets,
  initialValues,
  editingQuotationId,
  onSelectPreset,
  onPreview,
  onBack,
  onEdit,
  onCancelEdit,
}) {
  const [values, setValues] = useState(() => initValues(preset, initialValues));
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(editingQuotationId);
  const inputFields = preset.fields.filter((f) => !f.calculated);
  const calcFields = preset.fields.filter((f) => f.calculated);

  // Live calculated values recomputed on every input change.
  const calcValues = useMemo(
    () => computeCalculatedValues(preset, values),
    [preset, values]
  );

  const setValue = (id, val) => {
    setValues((prev) => ({ ...prev, [id]: val }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: undefined }));
  };

  const handleContinue = () => {
    const found = validateForm(preset.fields, values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    onPreview(values);
  };

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div className="head-with-back">
          <button className="icon-btn" onClick={onBack} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="screen-title">{preset.name}</h1>
            <p className="screen-sub">
              {isEditMode
                ? "Editing an existing quotation."
                : preset.description || "Fill in the quotation details."}
            </p>
          </div>
        </div>
        <div className="head-actions">
          <select
            className="control preset-switch"
            value={preset.id}
            disabled={isEditMode}
            title={isEditMode ? "Preset is locked while editing a saved quotation" : ""}
            onChange={(e) => onSelectPreset(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-soft" onClick={() => onEdit(preset.id)}>
            <Pencil size={16} /> Edit preset
          </button>
        </div>
      </header>

      {isEditMode && (
        <motion.div className="edit-banner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <span className="edit-banner-text">
            <Pencil size={15} /> Editing quotation: <strong>{editingQuotationId}</strong>
          </span>
          <button className="btn btn-ghost btn-xs" onClick={onCancelEdit}>
            <X size={14} /> Cancel edit
          </button>
        </motion.div>
      )}

      <div className={calcFields.length > 0 ? "entry-grid" : ""}>
        <motion.div
          key={preset.id}
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="form-grid">
            {inputFields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                onChange={(val) => setValue(field.id, val)}
              />
            ))}
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleContinue}>
              <Eye size={18} /> {isEditMode ? "Review changes" : "Preview Quotation"}
            </button>
          </div>
        </motion.div>

        {calcFields.length > 0 && (
          <motion.aside
            className="card calc-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            <h3 className="calc-panel-title">
              <Calculator size={16} /> Calculations
            </h3>
            <div className="calc-list">
              {calcFields.map((f) => (
                <div className="calc-row" key={f.id}>
                  <span className="calc-row-label">{f.label}</span>
                  <span className="calc-row-value">{formatCalculated(calcValues[f.id], f)}</span>
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}
