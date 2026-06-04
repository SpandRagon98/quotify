/**
 * Email-based auth + user management (localStorage-backed).
 *
 * No password / OAuth yet — a user "logs in" with their email. The owner email
 * always resolves to Owner; everyone else must be added with a role by an
 * Owner/Admin, otherwise they have no access. Swap the storage calls for a real
 * backend later (see GOOGLE_APPS_SCRIPT_SETUP.md notes).
 */

import { useCallback, useEffect, useState } from "react";
import { OWNER_EMAIL, STORAGE_KEYS } from "../config/appConfig";
import { ROLES } from "../auth/roles";

const normalize = (email) => String(email || "").trim().toLowerCase();

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.users);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (err) {
    console.warn("Could not read users:", err);
  }
  return {};
}

function loadSession() {
  try {
    return localStorage.getItem(STORAGE_KEYS.session) || null;
  } catch {
    return null;
  }
}

/** Resolve a role for an email (owner email wins; else the user list). */
function resolveRole(email, users) {
  const key = normalize(email);
  if (!key) return null;
  if (key === normalize(OWNER_EMAIL)) return ROLES.OWNER;
  return users[key]?.role || null;
}

export function useAuth() {
  const [users, setUsers] = useState(loadUsers);
  const [session, setSession] = useState(loadSession); // logged-in email or null

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    } catch (err) {
      console.warn("Could not persist users:", err);
    }
  }, [users]);

  const role = resolveRole(session, users);
  const currentUser = session ? { email: normalize(session), role } : null;

  const login = useCallback((email) => {
    const key = normalize(email);
    if (!key) return;
    setSession(key);
    try {
      localStorage.setItem(STORAGE_KEYS.session, key);
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.session);
    } catch {
      // ignore
    }
  }, []);

  const upsertUser = useCallback((email, userRole) => {
    const key = normalize(email);
    if (!key || key === normalize(OWNER_EMAIL)) return; // owner is implicit
    setUsers((prev) => ({
      ...prev,
      [key]: { email: key, role: userRole, addedAt: prev[key]?.addedAt || new Date().toISOString() },
    }));
  }, []);

  const removeUser = useCallback((email) => {
    const key = normalize(email);
    setUsers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // The owner is always shown in the list (read-only) for clarity.
  const userList = [
    { email: normalize(OWNER_EMAIL), role: ROLES.OWNER, owner: true },
    ...Object.values(users)
      .filter((u) => normalize(u.email) !== normalize(OWNER_EMAIL))
      .sort((a, b) => a.email.localeCompare(b.email)),
  ];

  return { currentUser, session, role, login, logout, userList, upsertUser, removeUser };
}
