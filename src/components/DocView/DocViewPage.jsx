import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Link2, Info, LayoutTemplate, FileText } from "lucide-react";
import DocumentPreview from "../common/DocumentPreview";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { presetDocId } from "../../services/quotationService";

export default function DocViewPage({ presets, initialPresetId, onEditPreset }) {
  const [presetId, setPresetId] = useState(initialPresetId || presets[0]?.id || "");
  const [docMode, setDocMode] = useState("native"); // native | googledoc
  const preset = presets.find((p) => p.id === presetId) || null;
  const cfg = useCompanyProfile(presetId);

  const docId = preset ? presetDocId(preset) : "";
  const previewUrl = docId ? `https://docs.google.com/document/d/${docId}/preview` : "";

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Doc View</h1>
          <p className="screen-sub">
            Compare the native Qyrova document with the linked Google Doc version.
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
          {docMode === "googledoc" && (
            <button
              className="btn btn-primary"
              disabled={!preset?.googleDocUrl}
              onClick={() => window.open(preset.googleDocUrl, "_blank", "noopener")}
              title={preset?.googleDocUrl ? "" : "Link a Google Doc to this preset first"}
            >
              <ExternalLink size={16} /> Edit in Google Docs
            </button>
          )}
        </div>
      </header>

      {/* Version toggle */}
      <div className="doc-toggle">
        <button
          className={`doc-toggle-btn ${docMode === "native" ? "is-active" : ""}`}
          onClick={() => setDocMode("native")}
        >
          <LayoutTemplate size={16} /> Native Version
        </button>
        <button
          className={`doc-toggle-btn ${docMode === "googledoc" ? "is-active" : ""}`}
          onClick={() => setDocMode("googledoc")}
        >
          <FileText size={16} /> Google Doc Version
        </button>
      </div>

      {!preset ? (
        <div className="empty-state">
          <Link2 size={26} />
          <p>No presets yet. Create a preset to see its document.</p>
        </div>
      ) : docMode === "native" ? (
        <>
          <div className="alert alert-info">
            <Info size={18} />
            <span>
              Native Qyrova document. Hide fields, add a banner or extra content, and copy any{" "}
              <code>{"{{placeholder}}"}</code> to build a Google Doc template.
            </span>
          </div>
          <motion.div
            key={`native-${preset.id}`}
            className="doc-stage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <DocumentPreview
              preset={preset}
              mode="template"
              editMeta
              editFields
              logo={cfg.logo}
              banner={cfg.banner}
              description={cfg.description}
              hiddenFields={cfg.hiddenFields}
              extraContent={cfg.extraContent}
              onLogoChange={cfg.setLogo}
              onLogoClear={cfg.clearLogo}
              onBannerChange={cfg.setBanner}
              onBannerClear={cfg.clearBanner}
              onDescriptionChange={cfg.setDescription}
              onToggleField={cfg.toggleField}
              onAddExtra={cfg.addExtra}
              onUpdateExtra={cfg.updateExtra}
              onRemoveExtra={cfg.removeExtra}
            />
          </motion.div>
        </>
      ) : !preset.googleDocUrl ? (
        <div className="empty-state">
          <Link2 size={26} />
          <p>No Google Doc linked or generated for this preset yet.</p>
          <p className="form-hint">
            Create a Google Doc with the placeholders from the Native Version, then link it here.
          </p>
          <button className="btn btn-primary" onClick={() => onEditPreset(preset.id)}>
            <FileText size={16} /> Link a Google Doc
          </button>
        </div>
      ) : (
        <motion.div
          key={`gdoc-${docId}`}
          className="doc-stage"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="doc-page">
            <iframe title={`${preset.name} Google Doc preview`} src={previewUrl} className="doc-frame" />
          </div>
          <p className="doc-hint">
            Linked Google Doc template. Use <strong>Edit in Google Docs</strong> to change it.
          </p>
        </motion.div>
      )}
    </div>
  );
}
