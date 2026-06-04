import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  Database,
  FileText,
  Mail,
  Users,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { APP, STORAGE_KEYS } from "../../config/appConfig";
import { ROLE_LABELS } from "../../auth/roles";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "presets", label: "Presets", icon: Layers },
  { key: "database", label: "Database", icon: Database },
  { key: "docview", label: "Doc View", icon: FileText },
  { key: "email", label: "Email", icon: Mail },
  { key: "users", label: "Users", icon: Users },
];

function loadCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1";
  } catch {
    return false;
  }
}

export default function AppLayout({ active, onNavigate, allowedTabs = [], user, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const navItems = NAV.filter((item) => allowedTabs.includes(item.key));

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
          {navItems.map(({ key, label, icon: Icon }) => (
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

        <div className="sidebar-bottom">
          {user && (
            <div className="sidebar-user" title={user.email}>
              <div className="sidebar-avatar">{user.email.charAt(0).toUpperCase()}</div>
              <div className="sidebar-user-info nav-label">
                <span className="sidebar-user-email">{user.email}</span>
                <span className="sidebar-user-role">{ROLE_LABELS[user.role] || user.role}</span>
              </div>
              <button className="collapse-btn" onClick={onLogout} title="Sign out" aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
