/**
 * Role definitions and capability helpers.
 *
 * - owner / admin : full access (incl. user management + delete)
 * - editor        : everything except deleting database records
 * - doc_viewer    : Doc View tab only
 */

export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
  DOC_VIEWER: "doc_viewer",
  SALES_MANAGER: "sales_manager",
  SALES_USER: "sales_user",
  FINANCE: "finance",
  VIEWER: "viewer",
};

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  doc_viewer: "Doc Viewer",
  sales_manager: "Sales Manager",
  sales_user: "Sales User",
  finance: "Finance",
  viewer: "Viewer",
};

/** Roles that an Owner/Admin can assign to other users (not Owner). */
export const ASSIGNABLE_ROLES = Object.values(ROLES).filter(r=>r!==ROLES.OWNER);

/** Sidebar tabs each role may see, in display order. Settings is available to all. */
const TAB_ACCESS = {
  owner: ["dashboard", "presets", "database", "docview", "email", "users", "settings"],
  admin: ["dashboard", "presets", "database", "docview", "email", "users", "settings"],
  editor: ["dashboard", "presets", "database", "docview", "email", "settings"],
  doc_viewer: ["docview", "settings"],
};
const CRM_TABS=['crm_dashboard','leads','accounts','contacts','opportunities','activities','inbox','reports'];
for(const role of ['owner','admin','editor'])TAB_ACCESS[role]=[...CRM_TABS,...TAB_ACCESS[role],...(role==='editor'?[]:['workflows','permissions'])];
TAB_ACCESS.sales_manager=[...CRM_TABS,'database','docview','email','settings'];
TAB_ACCESS.sales_user=[...CRM_TABS,'database','docview','email','settings'];
TAB_ACCESS.finance=['crm_dashboard','accounts','contacts','opportunities','reports','database','docview','email','settings'];
TAB_ACCESS.viewer=[...CRM_TABS,'database','docview','settings'];

export function allowedTabs(role) {
  return TAB_ACCESS[role] || [];
}

export function canAccessTab(role, tab) {
  return allowedTabs(role).includes(tab);
}

export function canManageUsers(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

export function canDeleteRecords(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/** Default landing tab for a role. */
export function defaultTab(role) {
  return role === ROLES.DOC_VIEWER ? "docview" : "crm_dashboard";
}
