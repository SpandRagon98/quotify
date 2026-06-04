import { motion } from "framer-motion";
import {
  Plus,
  FileText,
  ArrowRight,
  Layers,
  Files,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { APP } from "../../config/appConfig";
import { useDashboardData } from "../../hooks/useDashboardData";
import DonutChart from "./DonutChart";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const COLORS = {
  approved: "#2b9a66",
  declined: "#e5484d",
  negotiated: "#b7791f",
  pending: "#8c91a3",
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export default function Dashboard({ presets, onCreatePreset, onOpenForm, onManagePresets }) {
  const { state, error, stats, reload } = useDashboardData(presets);

  const metricCards = [
    { key: "total", label: "Total quotations", value: stats.total, icon: Files, color: "var(--brand)" },
    { key: "approved", label: "Approved", value: stats.approved, icon: CheckCircle2, color: COLORS.approved },
    { key: "declined", label: "Declined", value: stats.declined, icon: XCircle, color: COLORS.declined },
    { key: "negotiated", label: "Negotiation", value: stats.negotiated, icon: MessageSquare, color: COLORS.negotiated },
    { key: "pending", label: "Pending", value: stats.pending, icon: Clock, color: COLORS.pending },
  ];

  const donutSegments = [
    { label: "Approved", value: stats.approved, color: COLORS.approved },
    { label: "Declined", value: stats.declined, color: COLORS.declined },
    { label: "Negotiated", value: stats.negotiated, color: COLORS.negotiated },
    { label: "Pending", value: stats.pending, color: COLORS.pending },
  ];

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Welcome to {APP.name}</h1>
          <p className="screen-sub">{APP.description}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-soft" onClick={reload} disabled={state === "loading"}>
            <RefreshCw size={16} className={state === "loading" ? "spin" : ""} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={onCreatePreset}>
            <Plus size={18} /> New Preset
          </button>
        </div>
      </header>

      {state === "error" && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}
      {state === "loaded" && error && (
        <div className="alert alert-info">
          <AlertCircle size={18} /> <span>Some presets could not be loaded: {error}</span>
        </div>
      )}

      {/* Metric cards */}
      <motion.div className="metric-row" variants={container} initial="hidden" animate="show">
        {metricCards.map((m) => (
          <motion.div key={m.key} className="stat-card metric-card" variants={item}>
            <span className="metric-icon" style={{ background: `${m.color}1f`, color: m.color }}>
              <m.icon size={18} />
            </span>
            <div>
              <div className="stat-value">{state === "loading" ? "…" : m.value}</div>
              <div className="stat-label">{m.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Donut + latest */}
      <div className="dash-grid">
        <div className="card dash-donut-card">
          <h3 className="card-title">Status distribution</h3>
          {state === "loading" ? (
            <div className="db-state"><Loader2 size={20} className="spin" /> Loading…</div>
          ) : stats.total === 0 ? (
            <div className="empty-inline">No quotations recorded yet.</div>
          ) : (
            <div className="donut-wrap">
              <DonutChart segments={donutSegments} total={stats.total} />
              <div className="donut-legend">
                {donutSegments.map((s) => (
                  <div className="legend-row" key={s.label}>
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span className="legend-label">{s.label}</span>
                    <span className="legend-value">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card dash-latest-card">
          <h3 className="card-title">Latest quotation</h3>
          {state === "loading" ? (
            <div className="db-state"><Loader2 size={20} className="spin" /> Loading…</div>
          ) : stats.latest ? (
            <div className="latest-box">
              <div className="latest-id">{stats.latest.quotationId || "—"}</div>
              <div className="latest-meta">
                <span><Layers size={14} /> {stats.latest.presetName}</span>
                <span><Clock size={14} /> {formatDate(stats.latest.createdAt)}</span>
              </div>
            </div>
          ) : (
            <div className="empty-inline">No quotations yet.</div>
          )}
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
