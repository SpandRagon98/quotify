import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, ExternalLink, Link2 } from "lucide-react";
import { presetDocId } from "../../services/quotationService";

export default function DocViewPage({ presets, initialPresetId, onEditPreset }) {
  const [presetId, setPresetId] = useState(initialPresetId || presets[0]?.id || "");
  const preset = presets.find((p) => p.id === presetId) || null;
  const docId = preset ? presetDocId(preset) : "";
  const previewUrl = docId ? `https://docs.google.com/document/d/${docId}/preview` : "";

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Doc View</h1>
          <p className="screen-sub">Preview the Google Doc template linked to a preset.</p>
        </div>
        <div className="head-actions">
          <select
            className="control preset-switch"
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
          >
            {presets.length === 0 && <option value="">No presets</option>}
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={!preset?.googleDocUrl}
            onClick={() => window.open(preset.googleDocUrl, "_blank", "noopener")}
            title={preset?.googleDocUrl ? "" : "Link a Google Doc to this preset first"}
          >
            <ExternalLink size={16} /> Edit in Google Docs
          </button>
        </div>
      </header>

      {!preset?.googleDocUrl ? (
        <div className="empty-state">
          <Link2 size={26} />
          <p>This preset has no Google Doc template linked yet.</p>
          {preset && (
            <button className="btn btn-primary" onClick={() => onEditPreset(preset.id)}>
              <FileText size={16} /> Link a Google Doc
            </button>
          )}
        </div>
      ) : (
        <motion.div
          key={docId}
          className="doc-stage"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="doc-page">
            <iframe
              title={`${preset.name} document preview`}
              src={previewUrl}
              className="doc-frame"
            />
          </div>
          <p className="doc-hint">
            Read-only preview. Use <strong>Edit in Google Docs</strong> to make changes.
          </p>
        </motion.div>
      )}
    </div>
  );
}
