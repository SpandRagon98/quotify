/**
 * Supabase client (Phase 0 backend).
 *
 * The app is DUAL-MODE:
 *   - If VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, Qyrova uses real
 *     authentication + a multi-tenant Postgres (with Row-Level Security) so each
 *     account's data is isolated and synced across devices.
 *   - If they are NOT set, the app transparently falls back to the original
 *     localStorage behaviour, so it still builds and runs at $0 with no backend.
 *
 * The anon key is SAFE to expose in the browser bundle — Row-Level Security on
 * the database (see supabase/migrations/0001_init.sql) is what protects the data.
 * Never put the service_role key in the frontend.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True only when both env vars are present (i.e. cloud backend is enabled). */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** The shared client, or null when running in local-only mode. */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
