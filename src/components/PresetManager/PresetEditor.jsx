import { useState } from "react";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import FieldBuilder from "../FieldBuilder/FieldBuilder";
import IntegrationPanel from "./IntegrationPanel";
import PlaceholderPanel from "./PlaceholderPanel";
import { validatePreset } from "../../utils/validation";
import { newPresetId } from "../../utils/idGenerator";

function blankPreset() {
  const now = new Date().toISOString();
  return {
    id: newPresetId(),
    name: "",
    description: "",
    googleSheetUrl: "",
    googleSheetId: "",
    googleDocUrl: "",
    googleDocId: "",
    sheetTabName: "",
    fields: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function PresetEditor({ preset, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => preset || blankPreset());
  const [errors, setErrors] = useState([]);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = () => {
    // Auto-fill the sheet tab from the preset name if left blank.
    const finalDraft = {
      ...draft,
      sheetTabName: draft.sheetTabName.trim() || draft.name.trim(),
    };
    const found = validatePreset(finalDraft);
    if (found.length) {
      setErrors(found);
      return;
    }
    setErrors([]);
    onSave(finalDraft);
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="head-with-back">
          <button className="icon-btn" onClick={onCancel} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="screen-title">{preset ? "Edit Preset" : "New Preset"}</h1>
            <p className="screen-sub">Configure the template, target sheet tab and fields.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> Save Preset
        </button>
      </header>

      {errors.length > 0 && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Preset details</h3>
        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">Preset name *</span>
            <input
              className="control"
              value={draft.name}
              placeholder="e.g. Standard Quotation"
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>

          <label className="form-field">
            <span className="form-label">Google Sheet tab name</span>
            <input
              className="control"
              value={draft.sheetTabName}
              placeholder="Defaults to preset name"
              onChange={(e) => update({ sheetTabName: e.target.value })}
            />
          </label>

          <label className="form-field form-field-wide">
            <span className="form-label">Description</span>
            <input
              className="control"
              value={draft.description}
              placeholder="Optional summary of this preset"
              onChange={(e) => update({ description: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Google integration</h3>
        <IntegrationPanel preset={draft} onChange={update} />
      </div>

      <div className="card">
        <FieldBuilder
          fields={draft.fields}
          onFieldsChange={(fields) => update({ fields })}
        />
      </div>

      <div className="card">
        <PlaceholderPanel fields={draft.fields} />
      </div>
    </div>
  );
}
