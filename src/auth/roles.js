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
};

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  doc_viewer: "Doc Viewer",
};

/** Roles that an Owner/Admin can assign to other users (not Owner). */
export const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.EDITOR, ROLES.DOC_VIEWER];

/** Sidebar tabs each role may see, in display order. */
const TAB_ACCESS = {
  owner: ["dashboard", "presets", "database", "docview", "email", "users"],
  admin: ["dashboard", "presets", "database", "docview", "email", "users"],
  editor: ["dashboard", "presets", "database", "docview", "email"],
  doc_viewer: ["docview"],
};

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
  return role === ROLES.DOC_VIEWER ? "docview" : "dashboard";
}
