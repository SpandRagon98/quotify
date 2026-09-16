import { useEffect, useState } from "react";
import { LayoutDashboard, Layers, Database, FileText, Mail, Users, Settings, PanelLeftClose, PanelLeft, LogOut, Menu, X, Search, ChevronRight, CalendarDays, ArrowUpRight, Sparkles } from "lucide-react";
import { APP, STORAGE_KEYS } from "../../config/appConfig";
import { ROLE_LABELS } from "../../auth/roles";
import Logo from "../common/Logo";
import Modal from "../common/Modal";
import HelpWalkthrough from "../common/HelpWalkthrough";
import NotificationBell from "../Notifications/NotificationBell";

const NAV = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { key: "presets", label: "Presets", icon: Layers, group: "Workspace" },
  { key: "database", label: "Quotations", icon: Database, group: "Workspace" },
  { key: "docview", label: "Documents", icon: FileText, group: "Workspace" },
  { key: "email", label: "Email", icon: Mail, group: "Workspace" },
  { key: "users", label: "Team members", icon: Users, group: "Manage" },
  { key: "settings", label: "Settings", icon: Settings, group: "Manage" },
];
function loadCollapsed() {
  try { return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1"; }
  catch { return false; }
}

export default function WorkspaceLayout({ active, onNavigate, allowedTabs = [], user, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navItems = NAV.filter((item) => allowedTabs.includes(item.key));
  const activeLabel = NAV.find((item) => item.key === active)?.label || "Workspace";
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? "1" : "0"); } catch { /* Private browser storage may be unavailable. */ }
  }, [collapsed]);
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setQuery(""); setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const handleNav = (key) => { onNavigate(key); setMobileOpen(false); setSearchOpen(false); };
  const avatar = <span className="sidebar-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : (user?.name || user?.email || "Q").charAt(0).toUpperCase()}</span>;
  return <div className={`app ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
    <header className="mobile-topbar"><button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="mobile-brand"><Logo size={22} /><span className="mobile-brand-name">{APP.name}</span></div><NotificationBell compact /></header>
    <div className="drawer-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
    <aside className="sidebar">
      <div className="sidebar-top"><div className="brand"><div className="brand-mark"><Logo size={27} /></div><div className="brand-text"><span className="brand-name">{APP.name}<span className="brand-dot">.</span></span><span className="brand-tag">Your quotation workspace</span></div></div><button className="collapse-btn desktop-only" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}</button><button className="collapse-btn mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav className="nav" aria-label="Main navigation">{["Workspace", "Manage"].map((group) => <div className="nav-group" key={group}>{navItems.some((item) => item.group === group) && <span className="nav-group-label nav-label">{group}</span>}{navItems.filter((item) => item.group === group).map(({ key, label, icon: Icon }) => <button key={key} className={`nav-item ${active === key ? "is-active" : ""}`} onClick={() => handleNav(key)} title={label} aria-current={active === key ? "page" : undefined}><Icon size={18} /><span className="nav-label">{label}</span>{active === key && <ChevronRight size={14} className="nav-active-arrow nav-label" />}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-note nav-label"><Sparkles size={20} /><strong>Less admin.<br />More possibility.</strong><p>Bring every quotation into focus.</p></div>{user && <div className="sidebar-user" title={user.email}>{avatar}<div className="sidebar-user-info nav-label"><span className="sidebar-user-email">{user.name || user.email}</span><span className="sidebar-user-role">{ROLE_LABELS[user.role] || user.role}</span></div><button className="collapse-btn" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button></div>}</div>
    </aside>
    <main className="content"><div className="content-topbar desktop-only"><div className="workspace-breadcrumb">Workspace <ChevronRight size={13} /><strong>{activeLabel}</strong></div><div className="workspace-top-actions"><button className="workspace-search" onClick={() => { setQuery(""); setSearchOpen(true); }} aria-label="Search workspace"><Search size={16} /><span>Jump to…</span><kbd>Ctrl K</kbd></button><span className="workspace-date"><CalendarDays size={15} />{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><NotificationBell />{allowedTabs.includes("settings") && <button className="top-profile" onClick={() => handleNav("settings")} aria-label="Open profile settings">{avatar}</button>}</div></div>{children}<HelpWalkthrough /></main>
    <Modal open={searchOpen} title="Find your workspace" onClose={() => setSearchOpen(false)}><label className="workspace-command-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search screens…" aria-label="Search screens" /></label><div className="workspace-command-list">{navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).map(({ key, label, icon: Icon }) => <button key={key} onClick={() => handleNav(key)}><Icon size={18} /><span>{label}</span><ArrowUpRight size={16} /></button>)}</div>{navItems.every((item) => !item.label.toLowerCase().includes(query.toLowerCase())) && <p className="empty-inline">No matching screens. Try “Presets” or “Email”.</p>}</Modal>
  </div>;
}
