// Qyrova sales automation. Secrets stay in Supabase Edge Function settings.
// The client can dispatch only its own workspace's approved auto-send queue;
// inbound email is accepted only with a separate webhook secret.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const resendFrom = Deno.env.get("RESEND_FROM") || "Qyrova <onboarding@resend.dev>";
const replyTo = Deno.env.get("REPLY_TO_ADDRESS") || "";
const inboundSecret = Deno.env.get("INBOUND_EMAIL_WEBHOOK_SECRET") || "";
const publicAppUrl = (Deno.env.get("PUBLIC_APP_URL") || "").replace(/\/$/, "");
const claudeKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
const claudeModel = Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-haiku-latest";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-qyrova-inbound-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const service = () => createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const clean = (value: unknown, max: number) => String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const referencePattern = /\bQYR-[A-Z0-9]{10}\b/i;

async function authenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || !anonKey) return null;
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await client.auth.getUser(token);
  return data.user || null;
}

async function canDispatch(orgId: string, userId: string) {
  const { data } = await service().from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return Boolean(data && !["viewer", "doc_viewer", "finance"].includes(data.role));
}

function currency(value: unknown, code = "INR") {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(value || 0)); }
  catch { return `${code} ${Number(value || 0)}`; }
}

function token() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

async function sendDraft(draft: Record<string, any>, actorId: string | null) {
  const db = service();
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured on the server.");
  if (!draft.recipient_email || !validEmail(draft.recipient_email)) throw new Error("A valid customer email is required.");
  const trackToken = token();
  const snapshot = draft.source_snapshot || {};
  const quoteUrl = publicAppUrl ? `${publicAppUrl}/q/${trackToken}` : "";
  const amount = currency(draft.amount, draft.currency);
  const tracked = await db.from("tracked_quotes").insert({
    org_id: draft.org_id,
    token: trackToken,
    quotation_id: draft.quote_reference,
    preset_name: "Automated quotation",
    recipient_email: draft.recipient_email,
    created_by: actorId || draft.owner_id,
    snapshot: {
      kind: "automated",
      quotationId: draft.quote_reference,
      presetName: "Automated quotation",
      automatedQuote: {
        customerName: snapshot.lead_name || "Customer",
        companyName: snapshot.company_name || "",
        product: snapshot.product || "Requested service",
        amount,
        currency: draft.currency,
        reference: draft.quote_reference,
        body: draft.body,
      },
    },
  });
  if (tracked.error) throw new Error(tracked.error.message);
  const subject = `[${draft.quote_reference}] ${draft.subject}`.slice(0, 300);
  const text = [draft.body, "", `Quotation reference: ${draft.quote_reference}`, quoteUrl ? `Review securely: ${quoteUrl}` : ""].filter(Boolean).join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: resendFrom, to: draft.recipient_email, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(clean(result?.message || "Email provider rejected the message.", 500));
  const sentAt = new Date().toISOString();
  const update = await db.from("crm_quote_drafts").update({ status: "Sent", provider_message_id: clean(result?.id, 300) || null, sent_at: sentAt, failure_reason: null }).eq("id", draft.id).eq("status", "Sending");
  if (update.error) throw new Error(update.error.message);
  await db.from("crm_activities").insert({
    org_id: draft.org_id, owner_id: draft.owner_id, title: `Automated quotation ${draft.quote_reference} sent`, activity_type: "Email", description: `Sent to ${draft.recipient_email}.`, status: "Completed", outcome: "Sent by sales automation", lead_id: draft.lead_id, account_id: draft.account_id, contact_id: draft.contact_id, opportunity_id: draft.opportunity_id,
  });
  return { reference: draft.quote_reference, recipient: draft.recipient_email, providerMessageId: result?.id || "" };
}

async function dispatch(orgId: string, actorId: string, draftId = "") {
  if (!(await canDispatch(orgId, actorId))) throw new Error("Sales automation access is required.");
  const db = service();
  const { data: setting, error: settingError } = await db.from("crm_sales_automation_settings").select("auto_send_qualified_quotes").eq("org_id", orgId).maybeSingle();
  if (settingError) throw new Error(settingError.message);
  if (!draftId && !setting?.auto_send_qualified_quotes) return { sent: [], skipped: "Automatic sending is off for this workspace." };
  let query = db.from("crm_quote_drafts").select("*").eq("org_id", orgId).eq("status", "Ready to send").is("archived_at", null).order("created_at").limit(draftId ? 1 : 5);
  if (draftId) query = query.eq("id", draftId);
  const { data: drafts, error } = await query;
  if (error) throw new Error(error.message);
  const sent: Array<Record<string, string>> = [];
  const failed: Array<Record<string, string>> = [];
  for (const draft of drafts || []) {
    const locked = await db.from("crm_quote_drafts").update({ status: "Sending", failure_reason: null }).eq("id", draft.id).eq("status", "Ready to send").select().maybeSingle();
    if (locked.error || !locked.data) continue;
    try { sent.push(await sendDraft(locked.data, actorId)); }
    catch (error) {
      const message = clean((error as Error).message, 1000);
      await db.from("crm_quote_drafts").update({ status: "Send failed", failure_reason: message }).eq("id", draft.id);
      failed.push({ reference: draft.quote_reference, error: message });
    }
  }
  return { sent, failed };
}

function deterministicSuggestion(text: string, hasOpportunity: boolean) {
  const value = text.toLowerCase();
  if (/\b(accept|approved|go ahead|proceed|confirm(ed)?|let'?s do it)\b/.test(value))
    return { source: "Deterministic", confidence: 0.97, summary: "The customer appears ready to proceed.", recommendation: hasOpportunity ? { action: "update_stage", stage: "Negotiation", next_step: "Confirm final scope and commercial terms." } : { action: "mark_interested" } };
  if (/\b(price|cost|discount|budget|expensive|cheaper|revise|change|modify)\b/.test(value))
    return { source: "Deterministic", confidence: 0.94, summary: "The reply may require a commercial or scope review.", recommendation: { action: "create_follow_up", title: "Review customer quotation request", due_minutes: 60, reason: "Customer replied about price, budget or changes." } };
  if (/\b(meeting|call|speak|discuss|schedule|tomorrow|today)\b/.test(value))
    return { source: "Deterministic", confidence: 0.92, summary: "The customer wants a conversation or meeting.", recommendation: { action: "create_follow_up", title: "Schedule customer discussion", due_minutes: 60, reason: "Customer requested a call or meeting." } };
  return null;
}

function sanitizeRecommendation(value: any) {
  const allowed = new Set(["create_follow_up", "update_stage", "mark_interested"]);
  const action = clean(value?.action, 40);
  if (!allowed.has(action)) return null;
  if (action === "update_stage" && !["Qualification", "Discovery", "Demo/Meeting", "Proposal/Quotation", "Negotiation", "Won", "Lost"].includes(clean(value?.stage, 40))) return null;
  return { action, title: clean(value?.title, 200), due_minutes: Math.max(0, Math.min(Number(value?.due_minutes || 60), 10080)), reason: clean(value?.reason, 1000), stage: clean(value?.stage, 40), next_step: clean(value?.next_step, 500) };
}

async function claudeSuggestion(message: string, context: Record<string, any>) {
  if (!claudeKey) return null;
  // One compact prompt, no history, no tools, and a strict output ceiling keep
  // the costly path reserved for messages the deterministic rules cannot read.
  const prompt = `Classify this customer email for a small-business CRM. Return JSON only: {"summary":"max 180 chars","confidence":0..1,"recommendation":{"action":"create_follow_up|update_stage|mark_interested","title":"max 80","due_minutes":60,"reason":"max 180","stage":"optional CRM stage","next_step":"max 120"}}. Never send email or delete data. Customer context: ${JSON.stringify(context).slice(0, 420)}. Email: ${message.slice(0, 800)}`;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: claudeModel, max_tokens: 180, temperature: 0, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const raw = String(data?.content?.[0]?.text || "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(raw);
    const recommendation = sanitizeRecommendation(parsed.recommendation);
    if (!recommendation) return null;
    return { source: "Claude Haiku", confidence: Math.max(0, Math.min(Number(parsed.confidence || 0.5), 1)), summary: clean(parsed.summary, 1000) || "Customer reply needs review.", recommendation };
  } catch { return null; }
}

async function receiveInbound(request: Request, body: any) {
  if (!inboundSecret || request.headers.get("x-qyrova-inbound-secret") !== inboundSecret) return json({ error: "Inbound webhook is not authorized." }, 401);
  const sender = clean(body.from, 320).toLowerCase();
  const subject = clean(body.subject, 500);
  const text = clean(body.text || body.body, 20000);
  const providerMessageId = clean(body.messageId || body.message_id, 300);
  if (!validEmail(sender) || !text) return json({ error: "A valid sender and message text are required." }, 400);
  const db = service();
  const ref = `${subject}\n${text}`.match(referencePattern)?.[0]?.toUpperCase() || "";
  let draft: any = null;
  if (ref) ({ data: draft } = await db.from("crm_quote_drafts").select("*").eq("quote_reference", ref).is("archived_at", null).maybeSingle());
  let lead: any = null; let contact: any = null; let accountId = draft?.account_id || null; let opportunityId = draft?.opportunity_id || null; let matchMethod = draft ? "Quote reference" : "Unmatched";
  if (!draft) {
    const found = await db.from("crm_contacts").select("id,account_id,owner_id,email").ilike("email", sender).is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    contact = found.data || null;
    if (contact) {
      accountId = contact.account_id; matchMethod = "Email";
      const related = await db.from("crm_leads").select("id,org_id,opportunity_id,owner_id").eq("contact_id", contact.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      lead = related.data || null; opportunityId = lead?.opportunity_id || null;
    }
    if (!contact) {
      const foundLead = await db.from("crm_leads").select("id,org_id,account_id,contact_id,opportunity_id,owner_id").ilike("email", sender).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      lead = foundLead.data || null; accountId = lead?.account_id || null; opportunityId = lead?.opportunity_id || null;
      if (lead?.contact_id) ({ data: contact } = await db.from("crm_contacts").select("id,account_id,owner_id,email").eq("id", lead.contact_id).maybeSingle());
      if (lead) matchMethod = "Email";
    }
  } else {
    if (draft.contact_id) ({ data: contact } = await db.from("crm_contacts").select("id,account_id,owner_id,email").eq("id", draft.contact_id).maybeSingle());
    if (draft.lead_id) ({ data: lead } = await db.from("crm_leads").select("id,org_id,owner_id,opportunity_id").eq("id", draft.lead_id).maybeSingle());
  }
  const orgId = draft?.org_id || lead?.org_id || (accountId ? (await db.from("crm_accounts").select("org_id").eq("id", accountId).maybeSingle()).data?.org_id : null);
  if (!orgId) return json({ error: "No active Qyrova customer record matched this email." }, 404);
  const ownerId = draft?.owner_id || lead?.owner_id || contact?.owner_id;
  if (!ownerId) return json({ error: "Matched record has no owner." }, 409);
  const inserted = await db.from("crm_inbound_messages").insert({ org_id: orgId, source: "Email", provider_message_id: providerMessageId || null, sender_email: sender, subject: subject || null, body_text: text, quote_draft_id: draft?.id || null, lead_id: draft?.lead_id || lead?.id || null, account_id: accountId, contact_id: draft?.contact_id || contact?.id || null, opportunity_id: opportunityId, match_method: matchMethod }).select().single();
  if (inserted.error) {
    if (/duplicate/i.test(inserted.error.message)) return json({ ok: true, duplicate: true });
    throw new Error(inserted.error.message);
  }
  const settings = await db.from("crm_sales_automation_settings").select("reply_ai_enabled").eq("org_id", orgId).maybeSingle();
  let suggestion = deterministicSuggestion(`${subject}\n${text}`, Boolean(opportunityId));
  if (!suggestion && settings.data?.reply_ai_enabled !== false) suggestion = await claudeSuggestion(`${subject}\n${text}`, { product: draft?.source_snapshot?.product || "", amount: draft?.amount || 0, hasOpportunity: Boolean(opportunityId), quoteReference: draft?.quote_reference || "" });
  if (!suggestion) suggestion = { source: "Deterministic", confidence: 0.4, summary: "Customer replied. Review the message and choose the next step.", recommendation: { action: "create_follow_up", title: "Review customer reply", due_minutes: 120, reason: "The message needs human review." } };
  await db.from("crm_ai_suggestions").insert({ org_id: orgId, owner_id: ownerId, message_id: inserted.data.id, lead_id: draft?.lead_id || lead?.id || null, account_id: accountId, contact_id: draft?.contact_id || contact?.id || null, opportunity_id: opportunityId, source: suggestion.source, confidence: suggestion.confidence, summary: suggestion.summary, recommendation: suggestion.recommendation });
  await db.from("crm_events").insert({ org_id: orgId, owner_id: ownerId, entity_type: "inbound_messages", entity_id: inserted.data.id, account_id: accountId, lead_id: draft?.lead_id || lead?.id || null, contact_id: draft?.contact_id || contact?.id || null, opportunity_id: opportunityId, event_type: "customer_email_received", title: "Customer email received", detail: `Matched by ${matchMethod}.` });
  return json({ ok: true, messageId: inserted.data.id, matched: matchMethod, suggested: suggestion.summary });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    if (!url || !serviceKey) return json({ error: "Supabase service configuration is missing." }, 500);
    const body = await request.json();
    if (body.action === "inbound_email") return await receiveInbound(request, body);
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Sign in is required." }, 401);
    if (body.action !== "dispatch") return json({ error: "Unknown action." }, 400);
    const orgId = clean(body.orgId, 80);
    if (!orgId) return json({ error: "Workspace is required." }, 400);
    return json(await dispatch(orgId, user.id, clean(body.draftId, 80)));
  } catch (error) {
    return json({ error: clean((error as Error).message || "Sales automation failed.", 1000) }, 500);
  }
});
