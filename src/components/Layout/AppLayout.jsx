import { LayoutDashboard, Layers, Database, FileText } from "lucide-react";
import { APP } from "../../config/appConfig";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "presets", label: "Presets", icon: Layers },
  { key: "database", label: "Database", icon: Database },
];

export default function AppLayout({ active, onNavigate, children }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <FileText size={20} strokeWidth={2.5} />
          </div>
          <div className="brand-text">
            <span className="brand-name">{APP.name}</span>
            <span className="brand-tag">Quotation builder</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${active === key ? "is-active" : ""}`}
              onClick={() => onNavigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="dot" /> Connected to Google Workspace
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
