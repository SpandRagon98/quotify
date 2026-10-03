import { useEffect, useState } from "react";
import {
  Home,
  Users,
  Layers,
  CheckSquare,
  FileText,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Menu,
  X,
  Search,
} from "lucide-react";
import { APP, STORAGE_KEYS } from "../../config/appConfig";
import { ROLE_LABELS } from "../../auth/roles";
import Logo from "../common/Logo";
import NotificationBell from "../Notifications/NotificationBell";
import WorkspaceSwitcher from "../../crm/WorkspaceSwitcher";
import GlobalSearch from "../../crm/GlobalSearch";
import CreateMenu from "../../crm/CreateMenu";
import { PRIMARY_NAV, primarySection } from "../../crm/navigation";
const ICONS = [Home, Users, Layers, CheckSquare, FileText, BarChart3];
const NAV = PRIMARY_NAV.map(([key, label], index) => ({
  key,
  label,
  icon: ICONS[index],
}));
const canonical = primarySection;
export default function WorkspaceLayout({
  active,
  onNavigate,
  allowedTabs = [],
  user,
  onLogout,
  go,
  createIntent,
  clearCreateIntent,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = (key, extra) => {
    (go || onNavigate)(key, extra);
    setMobileOpen(false);
    setSearchOpen(false);
  };
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.sidebarCollapsed,
        collapsed ? "1" : "0",
      );
    } catch {
      /* unavailable */
    }
  }, [collapsed]);
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((old) => !old);
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const avatar = (
    <span className="sidebar-avatar">
      {user?.avatar ? (
        <img src={user.avatar} alt="" />
      ) : (
        (user?.name || "Q").charAt(0).toUpperCase()
      )}
    </span>
  );
  return (
    <div
      className={`app journey-app ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
    >
      <header className="mobile-topbar">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="mobile-brand">
          <Logo size={22} />
          <span>{APP.name}</span>
        </div>
        <button
          className="icon-btn"
          aria-label="Search Qyrova"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={19} />
        </button>
        <NotificationBell compact />
      </header>
      <div
        className="drawer-overlay"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <Logo size={27} />
            </div>
            <div className="brand-text">
              <span className="brand-name">
                Qyrova<span className="brand-dot">.</span>
              </span>
              <span className="brand-tag">Your next move, made clear</span>
            </div>
          </div>
          <button
            className="collapse-btn desktop-only"
            onClick={() => setCollapsed((old) => !old)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button
            className="collapse-btn mobile-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {NAV.filter((item) => allowedTabs.includes(item.key)).map(
            ({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`nav-item ${canonical(active) === key ? "is-active" : ""}`}
                onClick={() => navigate(key)}
                title={label}
                aria-current={canonical(active) === key ? "page" : undefined}
              >
                <Icon size={18} />
                <span className="nav-label">{label}</span>
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          {allowedTabs.includes("settings") && (
            <button
              className={`nav-item ${canonical(active) === "settings" ? "is-active" : ""}`}
              onClick={() => navigate("settings")}
              title="Settings"
            >
              <Settings size={18} />
              <span className="nav-label">Settings</span>
            </button>
          )}
          <WorkspaceSwitcher />
          {user && (
            <div className="sidebar-user" title={user.email}>
              {avatar}
              <div className="sidebar-user-info nav-label">
                <span className="sidebar-user-email">
                  {user.name || user.email}
                </span>
                <span className="sidebar-user-role">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <button
                className="collapse-btn"
                onClick={onLogout}
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="content">
        <div className="content-topbar journey-topbar">
          <button
            className="universal-search-trigger"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
            <span>Search Qyrova or ask anything…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="workspace-top-actions">
            <NotificationBell />
            <CreateMenu
              go={navigate}
              intent={createIntent}
              clearIntent={clearCreateIntent}
            />
          </div>
        </div>
        {children}
      </main>
      {searchOpen && (
        <GlobalSearch
          open
          onClose={() => setSearchOpen(false)}
          go={navigate}
          onCreate={(kind) => navigate("create", { kind })}
          allowedTabs={allowedTabs}
        />
      )}
    </div>
  );
}
