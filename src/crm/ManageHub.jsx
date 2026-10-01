import { BarChart3, FileSpreadsheet, GitBranch, Settings, ShieldCheck, UsersRound } from "lucide-react";

const tools = [
  ["Lead database", "leads", FileSpreadsheet, "Configure forms, import Excel and review every lead."],
  ["Automation", "workflows", GitBranch, "Starter playbooks, advanced workflows and sales automation."],
  ["Reports", "reports", BarChart3, "Revenue, conversion, sources, workload and stuck-deal trends."],
  ["Team and permissions", "permissions", UsersRound, "Members, roles, teams and shared workspace access."],
  ["Sales documents", "presets", FileSpreadsheet, "Quote templates, documents, email and quotation records."],
  ["Workspace settings", "settings", Settings, "Brand, integrations and workspace preferences."],
];

export default function ManageHub({ go, env }) {
  return <div className="screen screen-wide manage-hub"><header className="screen-head"><div><h1 className="screen-title">Manage</h1><p className="screen-sub">Configuration and advanced tools—kept out of the daily operating flow.</p></div><ShieldCheck size={25} /></header><div className="manage-grid">{tools.filter(([, key]) => key !== "permissions" || env.access.users?.view || env.access.workflows?.view).map(([title, key, Icon, copy]) => <button key={key} className="card manage-card" onClick={() => go(key)}><Icon size={20} /><div><strong>{title}</strong><span>{copy}</span></div></button>)}</div></div>;
}
