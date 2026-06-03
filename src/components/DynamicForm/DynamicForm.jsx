import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Pencil } from "lucide-react";
import FieldInput from "./FieldInput";
import { emptyValueForField } from "../../utils/fieldFormatters";
import { validateForm } from "../../utils/validation";

function initValues(preset) {
  const values = {};
  preset.fields.forEach((f) => {
    values[f.id] = emptyValueForField(f);
  });
  return values;
}

/** Fills values for a preset, validates, then hands off to preview. */
export default function DynamicForm({ preset, presets, onSelectPreset, onPreview, onBack, onEdit }) {
  const [values, setValues] = useState(() => initValues(preset));
  const [errors, setErrors] = useState({});

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
    <div className="screen">
      <header className="screen-head">
        <div className="head-with-back">
          <button className="icon-btn" onClick={onBack} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="screen-title">{preset.name}</h1>
            <p className="screen-sub">{preset.description || "Fill in the quotation details."}</p>
          </div>
        </div>
        <div className="head-actions">
          <select
            className="control preset-switch"
            value={preset.id}
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

      <motion.div
        key={preset.id}
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="form-grid">
          {preset.fields.map((field) => (
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
            <Eye size={18} /> Preview Quotation
          </button>
        </div>
      </motion.div>
    </div>
  );
}
