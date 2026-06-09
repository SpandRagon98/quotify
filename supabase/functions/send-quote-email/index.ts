// =====================================================================
// Qyrova — Phase 1 (optional): branded email via Resend
//
// A Supabase Edge Function that sends an email through Resend. It is fully
// ISOLATED from the Cloudflare deployment — if you never deploy it, the app's
// existing email path keeps working unchanged.
//
// Deploy (needs the Supabase CLI):
//   supabase functions deploy send-quote-email --no-verify-jwt
// Secrets:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_FROM="Qyrova <quotes@yourdomain.com>"
//
// Until you verify a sending domain in Resend, you can only send to your own
// address using the default onboarding@resend.dev sender. See PHASE1_SETUP.md.
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Qyrova <onboarding@resend.dev>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY is not configured on the server." }, 500);
    }

    const { to, subject, html, text, from, attachments } = await req.json();
    if (!to || !subject || (!html && !text)) {
      return json({ error: "Missing required fields: to, subject, and html or text." }, 400);
    }

    const payload: Record<string, unknown> = { from: from || RESEND_FROM, to, subject, html, text };
    // attachments: [{ filename, content }] where content is base64 (no data: prefix)
    if (Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments
        .filter((a) => a && a.filename && a.content)
        .map((a) => ({ filename: a.filename, content: a.content }));
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      // Surface the real Resend error — never fake success.
      return json({ error: data?.message || "Resend send failed.", detail: data }, res.status);
    }
    return json({ success: true, id: data?.id });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
