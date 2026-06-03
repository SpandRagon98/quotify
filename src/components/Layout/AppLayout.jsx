import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  Database,
  FileText,
  Mail,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { APP, STORAGE_KEYS } from "../../config/appConfig";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "presets", label: "Presets", icon: Layers },
  { key: "database", label: "Database", icon: Database },
  { key: "docview", label: "Doc View", icon: FileText },
  { key: "email", label: "Email", icon: Mail },
];

function loadCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1";
  } catch {
    return false;
  }
}

export default function AppLayout({ active, onNavigate, children }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  return (
    <div className={`app ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <FileText size={20} strokeWidth={2.5} />
            </div>
            <div className="brand-text">
              <span className="brand-name">{APP.name}</span>
              <span className="brand-tag">Quotation builder</span>
            </div>
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${active === key ? "is-active" : ""}`}
              onClick={() => onNavigate(key)}
              title={label}
            >
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="dot" /> <span className="nav-label">Connected to Google Workspace</span>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
