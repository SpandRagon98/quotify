import { motion } from "framer-motion";
import { Plus, FileText, ArrowRight, Layers, ListChecks } from "lucide-react";
import { APP } from "../../config/appConfig";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard({ presets, onCreatePreset, onOpenForm, onManagePresets }) {
  const totalFields = presets.reduce((sum, p) => sum + p.fields.length, 0);

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Welcome to {APP.name}</h1>
          <p className="screen-sub">{APP.description}</p>
        </div>
        <button className="btn btn-primary" onClick={onCreatePreset}>
          <Plus size={18} /> New Preset
        </button>
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <Layers size={20} className="stat-icon" />
          <div>
            <div className="stat-value">{presets.length}</div>
            <div className="stat-label">Presets</div>
          </div>
        </div>
        <div className="stat-card">
          <ListChecks size={20} className="stat-icon" />
          <div>
            <div className="stat-value">{totalFields}</div>
            <div className="stat-label">Total fields</div>
          </div>
        </div>
        <div className="stat-card">
          <FileText size={20} className="stat-icon" />
          <div>
            <div className="stat-value">
              {presets.filter((p) => p.googleDocUrl).length}
            </div>
            <div className="stat-label">Doc templates linked</div>
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Your presets</h2>
        <button className="btn btn-ghost" onClick={onManagePresets}>
          Manage <ArrowRight size={16} />
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="empty-state">
          <Layers size={28} />
          <p>No presets yet. Create your first quotation preset to get started.</p>
          <button className="btn btn-primary" onClick={onCreatePreset}>
            <Plus size={18} /> New Preset
          </button>
        </div>
      ) : (
        <motion.div className="preset-grid" variants={container} initial="hidden" animate="show">
          {presets.map((preset) => (
            <motion.button
              key={preset.id}
              className="preset-tile"
              variants={item}
              whileHover={{ y: -4 }}
              onClick={() => onOpenForm(preset.id)}
            >
              <div className="preset-tile-top">
                <span className="preset-chip">{preset.fields.length} fields</span>
                <ArrowRight size={18} className="preset-tile-arrow" />
              </div>
              <h3>{preset.name}</h3>
              <p>{preset.description || "No description"}</p>
              <div className="preset-tile-foot">
                <FileText size={14} /> {preset.sheetTabName}
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
