/**
 * Tracked quotes (Phase 1).
 *
 * A tracked quote is a sent quotation with an unguessable token. The recipient
 * opens /q/<token> (no login) to view a branded document; that page logs a view
 * and lets them Approve / Decline / Negotiate. Owners see the live status and
 * view count back in the app.
 *
 * All access is via the anon-safe RPCs defined in 0002_tracked_quotes.sql — the
 * token is the capability, so nothing can be enumerated. Every call is guarded:
 * failures surface a real, actionable error (never a fake success).
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { currentOrgId } from "./cloudStore";

/** Tracking is available only when the cloud backend is configured. */
export const trackingEnabled = () => isSupabaseConfigured;

/** Generate an unguessable URL-safe token (128 bits of randomness). */
function newToken() {
  const bytes = new Uint8Array(16);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The public URL a recipient opens to view a tracked quote. */
export function trackedQuoteUrl(token) {
  return `${window.location.origin}/q/${token}`;
}

/** A UUID for grouping a quote's versions into one history thread. */
function newThreadId() {
  const c = globalThis.crypto || window.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback: build a v4-shaped id from random bytes.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

/**
 * Create a tracked quote for the active organization.
 *
 * Versioning: if a tracked quote already exists for the same (org, quotationId),
 * this creates the next VERSION in the same history thread and marks the prior
 * versions superseded — so re-sending a revised quote never loses history.
 *
 * @param {object} p
 * @param {string} p.quotationId
 * @param {string} p.presetName
 * @param {string} p.recipientEmail
 * @param {object} p.snapshot - data DocumentPreview needs to re-render the doc
 *   on the public page: { preset, values, quotationId, logo, banner,
 *   description, hiddenFields, extraContent }
 * @param {string} [p.expiresAt] - ISO timestamp ("valid until"); omit for none
 * @returns {Promise<{ token:string, url:string, version:number }>}
 */
export async function createTrackedQuote({
  quotationId,
  presetName,
  recipientEmail,
  snapshot,
  expiresAt,
}) {
  if (!isSupabaseConfigured) {
    throw new Error("Quote tracking needs the cloud backend (sign in to enable).");
  }
  const orgId = currentOrgId();
  if (!orgId) {
    throw new Error("Your workspace is still loading — try again in a moment.");
  }

  const token = newToken();
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData?.user?.id || null;

  // Find the latest existing version for this quotation (for revisioning).
  let version = 1;
  let threadId = newThreadId();
  if (quotationId) {
    const { data: prior } = await supabase
      .from("tracked_quotes")
      .select("version, thread_id")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior) {
      version = (prior.version || 1) + 1;
      threadId = prior.thread_id || threadId;
    }
  }

  const { error } = await supabase.from("tracked_quotes").insert({
    org_id: orgId,
    token,
    quotation_id: quotationId || null,
    preset_name: presetName || null,
    recipient_email: recipientEmail || null,
    snapshot: snapshot || {},
    created_by: createdBy,
    expires_at: expiresAt || null,
    version,
    thread_id: threadId,
  });
  if (error) throw new Error(error.message);

  // Mark earlier versions in this thread as superseded (history is preserved).
  if (version > 1) {
    await supabase
      .from("tracked_quotes")
      .update({ superseded: true })
      .eq("org_id", orgId)
      .eq("thread_id", threadId)
      .neq("token", token);
  }

  return { token, url: trackedQuoteUrl(token), version };
}

/** Public: fetch one quote by its token. Returns the quote object or null. */
export async function getTrackedQuote(token) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_tracked_quote", { p_token: token });
  if (error) throw new Error(error.message);
  return data || null;
}

/** Public: log that the quote was viewed (fire-and-forget; errors are swallowed). */
export async function recordQuoteView(token) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc("record_quote_view", { p_token: token });
  } catch (err) {
    console.warn("[tracking] view log failed:", err?.message || err);
  }
}

/** Public: record an Accept / Decline / Request-changes response (+ optional signature). */
export async function respondToQuote(token, response, note = "", signedName = "") {
  if (!isSupabaseConfigured) {
    throw new Error("Responses need the cloud backend.");
  }
  const { data, error } = await supabase.rpc("respond_to_quote", {
    p_token: token,
    p_response: response,
    p_note: note || null,
    p_signed_name: signedName || null,
  });
  if (error) throw new Error(error.message);
  return data; // { status, already? }
}

/**
 * Owner-side: map of quotationId -> latest tracked quote, for overlaying the
 * public approval decision onto the Email tab + Dashboard. Returns {} when
 * tracking is unavailable (no backend / not signed in).
 */
export async function trackedStatusByQuotation() {
  if (!isSupabaseConfigured) return {};
  const list = await listTrackedQuotes();
  const map = {};
  // listTrackedQuotes is ordered newest-first → first seen per id is the latest.
  for (const q of list) {
    if (q.quotation_id && !map[q.quotation_id]) map[q.quotation_id] = q;
  }
  return map;
}

/**
 * Owner-side: list the active org's tracked quotes (latest first). Used to poll
 * for real status changes and fire notifications. Returns [] if unavailable.
 */
export async function listTrackedQuotes(limit = 200) {
  if (!isSupabaseConfigured) return [];
  const orgId = currentOrgId();
  if (!orgId) return [];
  try {
    const { data, error } = await supabase
      .from("tracked_quotes")
      .select(
        "id, quotation_id, preset_name, recipient_email, status, view_count, version, signed_name, response_note, last_viewed_at, responded_at, expires_at, updated_at, created_at"
      )
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("[tracking] list failed:", err?.message || err);
    return [];
  }
}

/**
 * Owner-side: the latest tracked quote for a given quotation id (for showing
 * status + views in the app). Returns null if none / not configured.
 */
export async function latestTrackedQuote(quotationId) {
  if (!isSupabaseConfigured || !quotationId) return null;
  const orgId = currentOrgId();
  if (!orgId) return null;
  try {
    const { data, error } = await supabase
      .from("tracked_quotes")
      .select("token, status, view_count, last_viewed_at, responded_at, response_note, created_at")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (err) {
    console.warn("[tracking] status lookup failed:", err?.message || err);
    return null;
  }
}
