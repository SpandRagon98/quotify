import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, FileText, FilePlus2, FileCheck2 } from "lucide-react";

export default function PresetManager({
  presets,
  onCreate,
  onEdit,
  onDelete,
  onOpenForm,
}) {
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Presets</h1>
          <p className="screen-sub">Create and manage your quotation templates.</p>
        </div>
        <button className="btn btn-primary" onClick={onCreate}>
          <Plus size={18} /> New Preset
        </button>
      </header>

      {presets.length === 0 ? (
        <div className="empty-state">
          <p>No presets yet.</p>
          <button className="btn btn-primary" onClick={onCreate}>
            <Plus size={18} /> Create your first preset
          </button>
        </div>
      ) : (
        <div className="preset-list">
          <AnimatePresence initial={false}>
            {presets.map((preset) => (
              <motion.div
                key={preset.id}
                className="preset-row"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
              >
                <div className="preset-row-main">
                  <h3>{preset.name}</h3>
                  <p>{preset.description || "No description"}</p>
                  <div className="preset-meta">
                    <span><FileText size={13} /> {preset.fields.length} fields</span>
                    <span><FileCheck2 size={13} /> Tab: {preset.sheetTabName}</span>
                    <span>
                      <FilePlus2 size={13} />{" "}
                      {preset.docTemplateId ? "Doc linked" : "No doc template"}
                    </span>
                  </div>
                </div>

                <div className="preset-row-actions">
                  <button className="btn btn-soft" onClick={() => onOpenForm(preset.id)}>
                    Use
                  </button>
                  <button className="icon-btn" title="Edit" onClick={() => onEdit(preset.id)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn icon-btn-danger"
                    title="Delete"
                    onClick={() => {
                      if (window.confirm(`Delete preset "${preset.name}"?`)) {
                        onDelete(preset.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
