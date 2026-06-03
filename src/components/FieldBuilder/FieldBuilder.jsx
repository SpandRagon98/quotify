import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import FieldEditorRow from "./FieldEditorRow";
import { newFieldId } from "../../utils/idGenerator";

/** A reusable, controlled list of dynamic fields. */
export default function FieldBuilder({ fields, onFieldsChange }) {
  const addField = () => {
    onFieldsChange([
      ...fields,
      {
        id: newFieldId(),
        label: "",
        type: "text",
        required: false,
        defaultValue: "",
        placeholder: "",
        helpText: "",
        options: [],
        textMode: "any",
      },
    ]);
  };

  const updateField = (updated) =>
    onFieldsChange(fields.map((f) => (f.id === updated.id ? updated : f)));

  const removeField = (id) => onFieldsChange(fields.filter((f) => f.id !== id));

  const moveField = (from, to) => {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onFieldsChange(next);
  };

  return (
    <div className="field-builder">
      <div className="field-builder-head">
        <h3>Fields</h3>
        <button className="btn btn-soft" onClick={addField}>
          <Plus size={16} /> Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="empty-inline">No fields yet. Add your first field above.</div>
      ) : (
        <div className="field-builder-list">
          <AnimatePresence initial={false}>
            {fields.map((field, index) => (
              <FieldEditorRow
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                onChange={updateField}
                onRemove={removeField}
                onMove={moveField}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
