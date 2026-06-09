/**
 * Authentication + roles — DUAL MODE.
 *
 *  • Cloud mode (Supabase configured): real email/password auth, sessions,
 *    password reset & email verification handled by Supabase. Each account owns a
 *    private organization (created by a DB trigger on signup); all app data is
 *    isolated per org by Row-Level Security.
 *
 *  • Local mode (no Supabase env vars): the original localStorage demo auth, so
 *    the app still builds and runs at $0. ⚠️ NOT secure — for local/dev only.
 *
 * `useAuth` is bound once at module load to the right implementation, so hooks are
 * always called unconditionally (rules-of-hooks safe). Both return the SAME shape
 * so the rest of the app is unchanged.
 */

import { useCallback, useEffect, useState } from "react";
import {
  OWNER_EMAIL,
  OWNER_DEFAULT_PASSWORD,
  OWNER_SEED_VERSION,
  STORAGE_KEYS,
} from "../config/appConfig";
import { ROLES } from "../auth/roles";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const normalize = (email) => String(email || "").trim().toLowerCase();

/* ============================ CLOUD (Supabase) ============================ */

function useSupabaseAuth() {
  const [ready, setReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState(null);
  const [profile, setProfile] = useState(null); // { id, email, name, avatar, role, orgId }

  const loadContext = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      setSessionEmail(null);
      return;
    }
    const email = normalize(user.email);
    let name = user.user_metadata?.full_name || email;
    let avatar = "";
    let orgId = null;
    let role = ROLES.OWNER;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, default_org_id")
        .eq("id", user.id)
        .maybeSingle();
      if (prof) {
        name = prof.full_name || name;
        avatar = prof.avatar_url || "";
        orgId = prof.default_org_id || null;
      }
      if (orgId) {
        const { data: mem } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", orgId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (mem?.role) role = mem.role;
      }
    } catch (err) {
      console.warn("[auth] could not load profile/role:", err?.message || err);
    }
    setProfile({ id: user.id, email, name, avatar, role, orgId });
    setSessionEmail(email);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await loadContext(data.session?.user || null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadContext(session?.user || null);
      setReady(true);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [loadContext]);

  const login = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalize(email),
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: normalize(email),
      password,
      options: { data: { full_name: (name || "").trim() } },
    });
    if (error) return { ok: false, error: error.message };
    // With email confirmation ON there is no session until the user confirms.
    if (!data.session) return { ok: true, needsVerification: true };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[auth] sign out:", err?.message || err);
    }
    // Privacy: drop ALL of this device's cached org/user data so the next
    // account on this browser starts clean (next sign-in re-hydrates from the
    // cloud). Missing any key here would leak data — or merge it into the next
    // user's workspace via the local→cloud migration.
    [
      STORAGE_KEYS.presets,
      STORAGE_KEYS.companyLogos,
      STORAGE_KEYS.emailTemplates,
      STORAGE_KEYS.docRegistry,
      STORAGE_KEYS.notifications,
      STORAGE_KEYS.notifSeen,
    ].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
  }, []);

  const updateProfile = useCallback(async ({ name, avatar }) => {
    setProfile((p) => (p ? { ...p, name: name ?? p.name, avatar: avatar ?? p.avatar } : p));
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        await supabase
          .from("profiles")
          .update({
            ...(name !== undefined ? { full_name: name } : {}),
            ...(avatar !== undefined ? { avatar_url: avatar } : {}),
          })
          .eq("id", data.user.id);
      }
    } catch (err) {
      console.warn("[auth] update profile:", err?.message || err);
    }
  }, []);

  // Team RBAC (inviting teammates by email + server-enforced roles) is the next
  // increment; the schema already supports it. For now the owner sees themselves.
  const userList = profile ? [{ email: profile.email, role: profile.role, owner: true }] : [];
  const upsertUser = useCallback(() => {}, []);
  const removeUser = useCallback(() => {}, []);

  const currentUser = profile
    ? { email: profile.email, role: profile.role, name: profile.name, avatar: profile.avatar }
    : null;

  return {
    ready,
    currentUser,
    session: sessionEmail,
    role: profile?.role || null,
    signup,
    login,
    logout,
    updateProfile,
    userList,
    upsertUser,
    removeUser,
  };
}

/* ============================ LOCAL (demo) ============================ */
/** ⚠️ localStorage-backed demo auth — NOT secure. Used only with no backend. */

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

function loadAccountsWithOwnerSeed() {
  const accounts = loadJson(STORAGE_KEYS.accounts, {});
  let seeded = false;
  try {
    seeded = localStorage.getItem(STORAGE_KEYS.ownerSeed) === OWNER_SEED_VERSION;
  } catch {
    // ignore
  }
  if (!seeded) {
    const ownerKey = normalize(OWNER_EMAIL);
    const existing = accounts[ownerKey];
    accounts[ownerKey] = {
      email: ownerKey,
      name: existing?.name || "Owner",
      passHash: hashPassword(OWNER_DEFAULT_PASSWORD),
      avatar: existing?.avatar || "",
    };
    try {
      localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
      localStorage.setItem(STORAGE_KEYS.ownerSeed, OWNER_SEED_VERSION);
    } catch {
      // ignore
    }
  }
  return accounts;
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

function useLocalAuth() {
  const [accounts, setAccounts] = useState(loadAccountsWithOwnerSeed);
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
    ready: true,
    currentUser, session, role,
    signup, login, logout, updateProfile,
    userList, upsertUser, removeUser,
  };
}

/* ============================ Selector ============================ */
/** Bound once at module load — components always call the same hook. */
export const useAuth = isSupabaseConfigured ? useSupabaseAuth : useLocalAuth;
