import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  Database,
  FileText,
  Mail,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { APP, STORAGE_KEYS } from "../../config/appConfig";
import { ROLE_LABELS } from "../../auth/roles";
import Logo from "../common/Logo";
import HelpWalkthrough from "../common/HelpWalkthrough";
import NotificationBell from "../Notifications/NotificationBell";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "presets", label: "Presets", icon: Layers },
  { key: "database", label: "Database", icon: Database },
  { key: "docview", label: "Doc View", icon: FileText },
  { key: "email", label: "Email", icon: Mail },
  { key: "users", label: "Users", icon: Users },
  { key: "settings", label: "Settings", icon: Settings },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const navItems = NAV.filter((item) => allowedTabs.includes(item.key));

  // Navigating on mobile also closes the drawer.
  const handleNav = (key) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <div className={`app ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Mobile top bar (hidden on desktop) */}
      <header className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="mobile-brand">
          <span className="mobile-brand-mark"><Logo size={20} /></span>
          <span className="mobile-brand-name">{APP.name}</span>
        </div>
        <div className="mobile-topbar-actions">
          <NotificationBell compact />
          <button className="mobile-menu-btn" onClick={onLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Drawer overlay (mobile only) */}
      <div className="drawer-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <Logo size={24} />
            </div>
            <div className="brand-text">
              <span className="brand-name">{APP.name}</span>
            </div>
          </div>
          <button
            className="collapse-btn desktop-only"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            className="collapse-btn mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${active === key ? "is-active" : ""}`}
              onClick={() => handleNav(key)}
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
              <div className="sidebar-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt="" />
                ) : (
                  (user.name || user.email).charAt(0).toUpperCase()
                )}
              </div>
              <div className="sidebar-user-info nav-label">
                <span className="sidebar-user-email">{user.name || user.email}</span>
                <span className="sidebar-user-role">{ROLE_LABELS[user.role] || user.role}</span>
              </div>
              <button className="collapse-btn" onClick={onLogout} title="Sign out" aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="content">
        <div className="content-topbar desktop-only">
          <NotificationBell />
        </div>
        {children}
        <HelpWalkthrough />
      </main>
    </div>
  );
}
