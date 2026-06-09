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

/**
 * Create a tracked quote for the active organization.
 * @param {object} p
 * @param {string} p.quotationId
 * @param {string} p.presetName
 * @param {string} p.recipientEmail
 * @param {object} p.snapshot - the data DocumentPreview needs to re-render the
 *   document on the public page: { preset, values, quotationId, logo, banner,
 *   description, hiddenFields, extraContent }
 * @returns {Promise<{ token:string, url:string }>}
 */
export async function createTrackedQuote({
  quotationId,
  presetName,
  recipientEmail,
  snapshot,
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

  const { error } = await supabase.from("tracked_quotes").insert({
    org_id: orgId,
    token,
    quotation_id: quotationId || null,
    preset_name: presetName || null,
    recipient_email: recipientEmail || null,
    snapshot: snapshot || {},
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);

  return { token, url: trackedQuoteUrl(token) };
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

/** Public: record an Approve / Decline / Negotiate response. */
export async function respondToQuote(token, response, note = "") {
  if (!isSupabaseConfigured) {
    throw new Error("Responses need the cloud backend.");
  }
  const { data, error } = await supabase.rpc("respond_to_quote", {
    p_token: token,
    p_response: response,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  return data; // { status }
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
