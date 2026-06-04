import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Link2, Info } from "lucide-react";
import DocumentPreview from "../common/DocumentPreview";

export default function DocViewPage({ presets, initialPresetId, onEditPreset }) {
  const [presetId, setPresetId] = useState(initialPresetId || presets[0]?.id || "");
  const preset = presets.find((p) => p.id === presetId) || null;

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Doc View</h1>
          <p className="screen-sub">
            Generated document template for a preset. Copy the {"{{placeholders}}"} into your linked Google Doc.
          </p>
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

      {!preset ? (
        <div className="empty-state">
          <Link2 size={26} />
          <p>No presets yet. Create a preset to see its document template.</p>
        </div>
      ) : (
        <>
          {!preset.googleDocUrl && (
            <div className="alert alert-info">
              <Info size={18} />
              <span>
                No Google Doc linked yet — this is the generated template. Use these
                placeholders in a Google Doc, then link it from the preset editor.
              </span>
              <button className="btn btn-soft btn-xs doc-alert-btn" onClick={() => onEditPreset(preset.id)}>
                Link a Doc
              </button>
            </div>
          )}
          <motion.div
            key={preset.id}
            className="doc-stage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <DocumentPreview preset={preset} mode="template" />
          </motion.div>
        </>
      )}
    </div>
  );
}
