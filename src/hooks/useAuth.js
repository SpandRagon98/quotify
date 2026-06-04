/**
 * Email + password auth, profile, and role management (localStorage-backed).
 *
 * Two stores:
 *   - accounts (credentials + profile): email → { email, name, passHash, avatar }
 *   - users (roles):                    email → { email, role, addedAt }
 *
 * Access rule: the owner email is always Owner; everyone else needs a role
 * assigned by an Owner/Admin, otherwise they have no access.
 *
 * ⚠️ SECURITY: passwords are stored as a lightweight non-cryptographic hash in
 * localStorage — this is a front-end-only demo, NOT real authentication. Migrate
 * to a backend / Firebase Auth before production (see GOOGLE_APPS_SCRIPT_SETUP.md).
 */

import { useCallback, useEffect, useState } from "react";
import { OWNER_EMAIL, STORAGE_KEYS } from "../config/appConfig";
import { ROLES } from "../auth/roles";

const normalize = (email) => String(email || "").trim().toLowerCase();

/** Non-cryptographic hash (djb2). NOT secure — see warning above. */
function hashPassword(password) {
  let h = 5381;
  const s = String(password || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(36)}`;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (err) {
    console.warn(`Could not read ${key}:`, err);
  }
  return fallback;
}

function loadSession() {
  try {
    return localStorage.getItem(STORAGE_KEYS.session) || null;
  } catch {
    return null;
  }
}

function resolveRole(email, users) {
  const key = normalize(email);
  if (!key) return null;
  if (key === normalize(OWNER_EMAIL)) return ROLES.OWNER;
  return users[key]?.role || null;
}

export function useAuth() {
  const [accounts, setAccounts] = useState(() => loadJson(STORAGE_KEYS.accounts, {}));
  const [users, setUsers] = useState(() => loadJson(STORAGE_KEYS.users, {}));
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts)); } catch { /* ignore */ }
  }, [accounts]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users)); } catch { /* ignore */ }
  }, [users]);

  const role = resolveRole(session, users);
  const account = session ? accounts[normalize(session)] : null;
  const currentUser = session
    ? {
        email: normalize(session),
        role,
        name: account?.name || normalize(session),
        avatar: account?.avatar || "",
      }
    : null;

  const persistSession = (email) => {
    setSession(email);
    try {
      if (email) localStorage.setItem(STORAGE_KEYS.session, email);
      else localStorage.removeItem(STORAGE_KEYS.session);
    } catch {
      // ignore
    }
  };

  const signup = useCallback(({ name, email, password }) => {
    const key = normalize(email);
    if (!key) return { ok: false, error: "Enter a valid email." };
    if (accounts[key]) return { ok: false, error: "An account with this email already exists. Please log in." };
    setAccounts((prev) => ({
      ...prev,
      [key]: { email: key, name: (name || "").trim() || key, passHash: hashPassword(password), avatar: "" },
    }));
    persistSession(key);
    return { ok: true };
  }, [accounts]);

  const login = useCallback(({ email, password }) => {
    const key = normalize(email);
    const acc = accounts[key];
    if (!acc) return { ok: false, error: "No account found for this email. Please sign up." };
    if (acc.passHash !== hashPassword(password)) return { ok: false, error: "Incorrect password." };
    persistSession(key);
    return { ok: true };
  }, [accounts]);

  const logout = useCallback(() => persistSession(null), []);

  const updateProfile = useCallback(({ name, avatar }) => {
    const key = normalize(session);
    if (!key) return;
    setAccounts((prev) => {
      const existing = prev[key] || { email: key, name: key, passHash: "", avatar: "" };
      return {
        ...prev,
        [key]: {
          ...existing,
          name: name !== undefined ? name : existing.name,
          avatar: avatar !== undefined ? avatar : existing.avatar,
        },
      };
    });
  }, [session]);

  // --- Role management (Users tab) ---
  const upsertUser = useCallback((email, userRole) => {
    const key = normalize(email);
    if (!key || key === normalize(OWNER_EMAIL)) return;
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

  const userList = [
    { email: normalize(OWNER_EMAIL), role: ROLES.OWNER, owner: true },
    ...Object.values(users)
      .filter((u) => normalize(u.email) !== normalize(OWNER_EMAIL))
      .sort((a, b) => a.email.localeCompare(b.email)),
  ];

  return {
    currentUser, session, role,
    signup, login, logout, updateProfile,
    userList, upsertUser, removeUser,
  };
}
