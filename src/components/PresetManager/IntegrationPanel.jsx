import { useState } from "react";
import { Link2, ExternalLink, Sheet, FileText, CheckCircle2 } from "lucide-react";
import LinkModal from "./LinkModal";

/**
 * Link / View controls for a preset's Google Sheet and Google Doc.
 * Operates on the editor draft via onChange(patch); persisted on Save Preset.
 */
export default function IntegrationPanel({ preset, onChange }) {
  const [modal, setModal] = useState(null); // "sheet" | "doc" | null

  const saveLink = (kind, { url, id }) => {
    if (kind === "sheet") onChange({ googleSheetUrl: url, googleSheetId: id });
    else onChange({ googleDocUrl: url, googleDocId: id });
    setModal(null);
  };

  const sheetLinked = Boolean(preset.googleSheetUrl);
  const docLinked = Boolean(preset.googleDocUrl);

  return (
    <div className="integration-grid">
      <IntegrationRow
        icon={<Sheet size={18} />}
        title="Google Sheet"
        subtitle="Saved quotation rows are written here."
        linked={sheetLinked}
        onLink={() => setModal("sheet")}
        onView={() => window.open(preset.googleSheetUrl, "_blank", "noopener")}
      />
      <IntegrationRow
        icon={<FileText size={18} />}
        title="Google Doc template"
        subtitle="Generated quotations use this template."
        linked={docLinked}
        onLink={() => setModal("doc")}
        onView={() => window.open(preset.googleDocUrl, "_blank", "noopener")}
      />

      <LinkModal
        open={modal === "sheet"}
        kind="sheet"
        initialUrl={preset.googleSheetUrl}
        onClose={() => setModal(null)}
        onSave={(r) => saveLink("sheet", r)}
      />
      <LinkModal
        open={modal === "doc"}
        kind="doc"
        initialUrl={preset.googleDocUrl}
        onClose={() => setModal(null)}
        onSave={(r) => saveLink("doc", r)}
      />
    </div>
  );
}

function IntegrationRow({ icon, title, subtitle, linked, onLink, onView }) {
  return (
    <div className="integration-row">
      <div className="integration-info">
        <span className="integration-icon">{icon}</span>
        <div>
          <div className="integration-title">
            {title}
            {linked && (
              <span className="linked-badge">
                <CheckCircle2 size={13} /> Linked
              </span>
            )}
          </div>
          <div className="integration-sub">{subtitle}</div>
        </div>
      </div>
      <div className="integration-actions">
        <button className="btn btn-soft" onClick={onLink}>
          <Link2 size={15} /> {linked ? "Update" : "Link"}
        </button>
        <button className="btn btn-ghost" onClick={onView} disabled={!linked}>
          <ExternalLink size={15} /> View
        </button>
      </div>
    </div>
  );
}
