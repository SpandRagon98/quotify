import { supabase } from "../lib/supabaseClient";
import { rpc } from "./service";
import { parseSearch } from "./brain";
export const dayBounds = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const month = new Date(start.getFullYear(), start.getMonth(), 1);
  return {
    p_day_start: start.toISOString(),
    p_day_end: end.toISOString(),
    p_month_start: month.toISOString(),
  };
};
export const homeSnapshot = (orgId) =>
  rpc("crm_journey_home", { p_org: orgId, ...dayBounds() });
const cleanSearch = (text) =>
  text
    .replace(/[%,().:"\\]/g, " ")
    .trim()
    .slice(0, 100);
export async function journeyRecords(
  entity,
  orgId,
  { query = "", filters = {}, page = 0, size = 25, id } = {},
  signal,
) {
  const source =
    entity === "accounts"
      ? "crm_journey_customers"
      : entity === "opportunities"
        ? "crm_journey_deals"
        : entity === "quote_links"
          ? "crm_journey_documents"
          : entity === "activities"
            ? "crm_journey_tasks"
            : entity === "contacts"
              ? "crm_journey_contacts"
              : `crm_${entity}`;
  let request = supabase
    .from(source)
    .select("*", { count: "exact" })
    .eq("org_id", orgId);
  if (!["accounts", "opportunities"].includes(entity))
    request = request.is("archived_at", null);
  if (id) request = request.eq("id", id);
  const needle = cleanSearch(query);
  if (needle) {
    const columns =
      entity === "accounts"
        ? ["name", "customer_name", "customer_email", "customer_phone"]
        : entity === "opportunities"
          ? ["name", "company_name", "customer_name", "email", "phone"]
          : entity === "quote_links"
            ? ["quotation_id", "preset_name", "company_name", "customer_name"]
            : entity === "activities"
              ? ["title", "description", "company_name", "customer_name"]
              : entity === "contacts"
                ? ["customer_name", "company_name", "email", "phone"]
                : ["name", "company_name", "email", "phone"];
    request = request.or(
      columns.map((column) => `${column}.ilike.%${needle}%`).join(","),
    );
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value === "" || value == null) continue;
    if (key === "pulse") {
      request = request.eq("pulse_status", value);
      continue;
    }
    if (key === "min_value" || key === "max_value")
      request = request[key === "min_value" ? "gte" : "lte"]("amount", value);
    else if (key === "awaiting" && entity === "quote_links")
      request = request.eq("awaiting_reply", true);
    else if (key === "awaiting")
      request = request
        .not(entity === "quote_links" ? "sent_at" : "quote_sent_at", "is", null)
        .not(
          entity === "quote_links" ? "status" : "quote_status",
          "in",
          "(Accepted,Declined,Approved)",
        );
    else if (key === "inactive_days")
      request = request.or(
        `last_contacted_at.is.null,last_contacted_at.lt.${new Date(Date.now() - value * 86400000).toISOString()}`,
      );
    else if (key === "created_from") request = request.gte("created_at", value);
    else if (key === "created_before")
      request = request.lt("created_at", value);
    else if (key === "activity_view") {
      const bounds = dayBounds();
      if (value === "Today")
        request = request
          .not("status", "in", "(Completed,Cancelled)")
          .lt("due_at", bounds.p_day_end);
      if (value === "Upcoming")
        request = request
          .not("status", "in", "(Completed,Cancelled)")
          .gte("due_at", bounds.p_day_end);
      if (value === "Done") request = request.eq("status", "Completed");
    } else request = request.eq(key, value);
  }
  request = request
    .order(entity === "activities" ? "due_at" : "created_at", {
      ascending: entity === "activities",
      nullsFirst: false,
    })
    .order("id")
    .range(page * size, page * size + size - 1);
  const { data, error, count } = await request.abortSignal(
    signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  );
  if (error) throw new Error(error.message);
  return { rows: data || [], count: count || 0 };
}
export async function universalSearch(input, env, signal) {
  const parsed = parseSearch(input);
  const entities = (
    parsed.entity
      ? [parsed.entity]
      : [
          "accounts",
          "contacts",
          "opportunities",
          "quote_links",
          "activities",
          "leads",
        ]
  ).filter(
    (entity) =>
      env.access[entity === "quote_links" ? "quotations" : entity]?.view,
  );
  const settled = await Promise.allSettled(
    entities.map(async (entity) => ({
      entity,
      ...(await journeyRecords(
        entity,
        env.user.orgId,
        { query: parsed.query, filters: parsed.filters, size: 8 },
        signal,
      )),
    })),
  );
  const errors = settled.filter((item) => item.status === "rejected");
  if (errors.length === settled.length && errors.length) throw errors[0].reason;
  return {
    parsed,
    results: settled.flatMap((item) =>
      item.status === "fulfilled"
        ? item.value.rows.map((record) => ({
            entity: item.value.entity,
            record,
          }))
        : [],
    ),
    partial: errors.length > 0,
  };
}
