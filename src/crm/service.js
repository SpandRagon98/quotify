import { supabase } from "../lib/supabaseClient";
import { ENTITIES } from "./schema";
const tables = Object.keys(ENTITIES);
function client() {
  if (!supabase)
    throw new Error(
      "CRM requires your cloud workspace. Local demo authentication does not store CRM records.",
    );
  return supabase;
}
const table = (entity) => {
  if (
    !tables.includes(entity) &&
    ![
      "events",
      "notifications",
      "workflows",
      "workflow_executions",
      "teams",
    ].includes(entity)
  )
    throw new Error("Unknown CRM entity");
  return "crm_" + entity;
};
const requestSignal = (signal) =>
  signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000);
async function unwrap(request, signal) {
  const { data, error } = await request.abortSignal(requestSignal(signal));
  if (error)
    throw new Error(error.message || "The request timed out. Please retry.");
  return data;
}
export const rpc = (name, args = {}, signal) =>
  unwrap(client().rpc(name, args), signal);
export async function bootstrap(orgId, signal) {
  const [members, access, teams, workspaces] = await Promise.all([
    rpc("crm_members", { p_org: orgId }, signal),
    rpc("crm_access", { p_org: orgId }, signal),
    unwrap(
      client()
        .from("crm_teams")
        .select("id,name")
        .eq("org_id", orgId)
        .order("name"),
      signal,
    ),
    rpc("crm_workspaces", {}, signal),
  ]);
  return { members, access, teams, workspaces };
}
export async function listRecords(
  entity,
  orgId,
  {
    page = 0,
    size = 25,
    query = "",
    sort = "created_at",
    ascending = false,
    filters = {},
    related = {},
  } = {},
  signal,
) {
  const selections = {
    contacts:
      "*, account:crm_accounts!crm_contacts_org_id_account_id_fkey(id,name)",
    opportunities:
      "*, account:crm_accounts!crm_opportunities_org_id_account_id_fkey(id,name)",
    activities:
      "*, account:crm_accounts!crm_activities_org_id_account_id_fkey(id,name)",
  };
  let request = client()
    .from(table(entity))
    .select(selections[entity] || "*", { count: "exact" })
    .eq("org_id", orgId);
  if (tables.includes(entity)) request = request.is("archived_at", null);
  if (query.trim() && tables.includes(entity))
    request = request.textSearch("search", query.trim(), {
      type: "websearch",
      config: "simple",
    });
  for (const [key, value] of Object.entries({ ...filters, ...related })) {
    if (value === "" || value == null) continue;
    if (key === "created_from")
      request = request.gte("created_at", new Date(value).toISOString());
    else if (key === "created_to")
      request = request.lt(
        "created_at",
        new Date(new Date(value).getTime() + 86400000).toISOString(),
      );
    else if (key === "min_value")
      request = request.gte(
        entity === "leads" ? "estimated_value" : "amount",
        value,
      );
    else if (key === "max_value")
      request = request.lte(
        entity === "leads" ? "estimated_value" : "amount",
        value,
      );
    else if (key === "tag") request = request.contains("tags", [value]);
    else if (key === "activity_view") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 86400000);
      if (value === "Completed") request = request.eq("status", "Completed");
      else if (value === "Overdue")
        request = request
          .not("status", "in", "(Completed,Cancelled)")
          .lt("due_at", new Date().toISOString());
      else if (value === "Today")
        request = request
          .not("status", "in", "(Completed,Cancelled)")
          .gte("due_at", today.toISOString())
          .lt("due_at", tomorrow.toISOString());
      else if (value === "Upcoming")
        request = request
          .not("status", "in", "(Completed,Cancelled)")
          .gte("due_at", tomorrow.toISOString());
    } else request = request.eq(key, value);
  }
  const validSort = [
    ...(ENTITIES[entity]?.columns || []),
    "created_at",
    "updated_at",
    "name",
    "title",
  ];
  if (!validSort.includes(sort)) sort = "created_at";
  request = request
    .order(sort, { ascending, nullsFirst: false })
    .order("id", { ascending: true })
    .range(page * size, page * size + size - 1);
  request = request.abortSignal(requestSignal(signal));
  const { data, error, count } = await request;
  if (error) throw new Error(error.message);
  return { rows: data || [], count: count || 0 };
}
export const getRecord = (entity, orgId, id) =>
  unwrap(
    client()
      .from(table(entity))
      .select("*")
      .eq("org_id", orgId)
      .eq("id", id)
      .is("archived_at", null)
      .single(),
  );
export const getLeadFormConfig = (orgId) =>
  unwrap(
    client()
      .from("crm_lead_form_configs")
      .select("fields,updated_at")
      .eq("org_id", orgId)
      .maybeSingle(),
  );
export const saveLeadFormConfig = (orgId, fields) =>
  unwrap(
    client()
      .from("crm_lead_form_configs")
      .upsert({ org_id: orgId, fields }, { onConflict: "org_id" })
      .select("fields,updated_at")
      .single(),
  );
export const findAccountByName = (orgId, name) =>
  unwrap(
    client()
      .from("crm_accounts")
      .select("id,name")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .ilike("name", String(name || "").trim())
      .limit(1)
      .maybeSingle(),
  );
export const saveRecord = (entity, orgId, payload, id) =>
  unwrap(
    id
      ? client()
          .from(table(entity))
          .update(payload)
          .eq("org_id", orgId)
          .eq("id", id)
          .select()
          .single()
      : client()
          .from(table(entity))
          .insert({ ...payload, org_id: orgId })
          .select()
          .single(),
  );
export const archiveRecords = (entity, orgId, ids) =>
  unwrap(
    client()
      .from(table(entity))
      .update({ archived_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .in("id", ids)
      .select("id"),
  );
export const getTelegramIntegration = (orgId) =>
  unwrap(
    client()
      .from("crm_telegram_integration")
      .select("org_id,bot_username,webhook_url,connected_at,last_error,updated_at")
      .eq("org_id", orgId)
      .maybeSingle(),
  );
export async function connectTelegram(orgId) {
  const { data, error } = await client().functions.invoke("telegram-setup", {
    body: { orgId },
  });
  if (error)
    throw new Error(data?.error || error.message || "Telegram setup failed.");
  if (data?.error) throw new Error(data.error);
  return data;
}
export const saveWorkflow = (orgId, payload, id) =>
  unwrap(
    id
      ? client()
          .from("crm_workflows")
          .update(payload)
          .eq("org_id", orgId)
          .eq("id", id)
          .select()
          .single()
      : client()
          .from("crm_workflows")
          .insert({ ...payload, org_id: orgId })
          .select()
          .single(),
  );
export const notifications = (orgId) =>
  unwrap(
    client()
      .from("crm_notifications")
      .select("*")
      .eq("org_id", orgId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
  );
export const markNotificationsRead = (orgId, ids) =>
  unwrap(
    client()
      .from("crm_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .in("id", ids),
  );
export const dismissNotifications = (orgId, ids) =>
  unwrap(
    client()
      .from("crm_notifications")
      .update({
        read_at: new Date().toISOString(),
        dismissed_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .in("id", ids),
  );
export async function linkQuotation(
  user,
  context,
  preset,
  values,
  result,
  docType = "native",
) {
  const existing = await unwrap(
    client()
      .from("crm_quote_links")
      .select("*")
      .eq("org_id", user.orgId)
      .eq("preset_id", preset.id)
      .eq("quotation_id", result.meta.quotationId)
      .maybeSingle(),
  );
  // Historical edits keep the original customer, salesperson and reporting amount.
  // Unlinked legacy quotations remain unlinked; no customer guesses or backfill.
  if (!context && !existing) return null;
  if (!context) {
    return unwrap(
      client()
        .from("crm_quote_links")
        .update({
          values_snapshot: values,
          ...(result.docResult?.docUrl
            ? { doc_type: "googledoc", doc_url: result.docResult.docUrl }
            : {}),
        })
        .eq("org_id", user.orgId)
        .eq("id", existing.id)
        .select()
        .single(),
    );
  }
  const payload = {
    org_id: user.orgId,
    owner_id: context.owner_id || user.id,
    account_id: context.account_id,
    contact_id: context.contact_id || null,
    opportunity_id: context.opportunity_id || null,
    lead_id: context.lead_id || null,
    preset_id: preset.id,
    preset_name: preset.name,
    quotation_id: result.meta.quotationId,
    values_snapshot: values,
    amount: context.amount ?? null,
    currency: context.currency || "INR",
    doc_type: result.docResult?.docUrl
      ? "googledoc"
      : existing?.doc_type || docType,
    doc_url: result.docResult?.docUrl || existing?.doc_url || null,
  };
  return unwrap(
    client()
      .from("crm_quote_links")
      .upsert(payload, { onConflict: "org_id,preset_id,quotation_id" })
      .select()
      .single(),
  );
}
