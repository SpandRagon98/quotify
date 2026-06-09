/**
 * Cloud state helpers for the multi-tenant backend.
 *
 * Data hooks (presets, company profiles, email templates) stay LOCAL-FIRST: they
 * render instantly from a localStorage cache, then — when a user is signed in and
 * Supabase is configured — hydrate from and write through to the cloud.
 *
 * Each collection is stored as a single JSONB blob per organization in the
 * `app_state` table, keyed by (org_id, key). Row-Level Security guarantees a user
 * can only read/write rows for organizations they belong to. This preserves the
 * app's flexible data model (no reshaping) while giving real tenant isolation.
 *
 * Every network call is guarded: failures log and degrade to local-only — they
 * never throw into React render.
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";

let activeUserId = null;
let activeOrgId = null;
let started = false;
const listeners = new Set();

/** Resolve which organization the signed-in user is acting in. */
async function resolveOrgId(userId) {
  if (!userId) return null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.default_org_id) return profile.default_org_id;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return membership?.org_id || null;
  } catch (err) {
    console.warn("[cloud] could not resolve org:", err?.message || err);
    return null;
  }
}

async function applyUser(user) {
  activeUserId = user?.id || null;
  activeOrgId = activeUserId ? await resolveOrgId(activeUserId) : null;
  listeners.forEach((cb) => cb({ userId: activeUserId, orgId: activeOrgId }));
}

/** Begin tracking auth/org state. Safe to call multiple times. */
export function startCloud() {
  if (!isSupabaseConfigured || started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user || null));
  supabase.auth.onAuthStateChange((_event, session) => applyUser(session?.user || null));
}

/**
 * Subscribe to org/user changes. The callback fires immediately with the current
 * value and again whenever the signed-in user (and therefore org) changes.
 * @returns {() => void} unsubscribe
 */
export function onCloudAuth(cb) {
  listeners.add(cb);
  cb({ userId: activeUserId, orgId: activeOrgId });
  return () => listeners.delete(cb);
}

export const cloudEnabled = () => isSupabaseConfigured;
export const currentOrgId = () => activeOrgId;

/**
 * Load a collection blob for the active org.
 * @returns {Promise<any|null|undefined>} the stored value, `null` if no row yet,
 *   or `undefined` when cloud is unavailable (not configured / not signed in).
 */
export async function loadCloudState(key) {
  if (!isSupabaseConfigured || !activeOrgId) return undefined;
  try {
    const { data, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("org_id", activeOrgId)
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  } catch (err) {
    console.warn(`[cloud] load "${key}" failed:`, err?.message || err);
    return undefined;
  }
}

/** Write-through a collection blob for the active org (fire-and-forget). */
export async function saveCloudState(key, value) {
  if (!isSupabaseConfigured || !activeOrgId) return;
  try {
    const { error } = await supabase
      .from("app_state")
      .upsert(
        { org_id: activeOrgId, key, data: value, updated_at: new Date().toISOString() },
        { onConflict: "org_id,key" }
      );
    if (error) throw error;
  } catch (err) {
    console.warn(`[cloud] save "${key}" failed:`, err?.message || err);
  }
}
