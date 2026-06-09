/**
 * Optional Resend email path (Phase 1 productization).
 *
 * Calls the `send-quote-email` Supabase Edge Function (see
 * supabase/functions/send-quote-email/index.ts), which holds the secret
 * RESEND_API_KEY server-side. This is an OPT-IN upgrade: the app's existing
 * email path keeps working until you deploy the function and a verified domain.
 *
 * Errors are surfaced verbatim — no fake success.
 */

import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

export const resendAvailable = () => isSupabaseConfigured;

/**
 * Send a branded HTML email via Resend.
 * @param {object} p
 * @param {string} p.to
 * @param {string} p.subject
 * @param {string} [p.html]
 * @param {string} [p.text]
 * @param {string} [p.from] - overrides RESEND_FROM (must be a verified sender)
 */
export async function sendViaResend({ to, subject, html, text, from }) {
  if (!isSupabaseConfigured) {
    throw new Error("Cloud backend not configured — cannot reach the email function.");
  }
  const { data, error } = await supabase.functions.invoke("send-quote-email", {
    body: { to, subject, html, text, from },
  });
  if (error) throw new Error(error.message || "Email function call failed.");
  if (data?.error) throw new Error(data.error);
  return data; // { success: true, id }
}
