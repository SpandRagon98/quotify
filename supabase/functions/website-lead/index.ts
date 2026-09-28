import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const defaultPricing = {
  rateBands: {
    Essential: { min: 1200, max: 1800 },
    Premium: { min: 1800, max: 2800 },
    Luxury: { min: 2800, max: 4500 },
  },
  cityMultipliers: { Mumbai: 1.18, "Delhi NCR": 1.1, Bengaluru: 1.12, Kolkata: 0.95, Hyderabad: 1, Chennai: 1, Pune: 1.05, Other: 1 },
  styleMultipliers: { "Modern Minimal": 0.95, "Warm Contemporary": 1, Japandi: 1.05, "Modern Indian": 1.1, "Classic Luxury": 1.25, Scandinavian: 1, "Organic Modern": 1.1, Industrial: 1.05, "Not Sure Yet": 1 },
  minimumProjectValue: 450000,
};
const spaceWeights: Record<string, number> = { "Living Room": 0.2, Kitchen: 0.22, Bedrooms: 0.38, Wardrobes: 0.18, Dining: 0.1, "Home Office": 0.1, Bathrooms: 0.13, Balcony: 0.06 };

function json(body: unknown, status = 200, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Vary": "Origin" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}
function text(value: unknown, max = 500) { return String(value ?? "").trim().slice(0, max); }
function list(value: unknown) { return Array.isArray(value) ? value.map((item) => text(item, 80)).filter(Boolean).slice(0, 20) : []; }
function validEmail(value: string) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function service() { return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }
function estimate(answers: Record<string, unknown>, supplied: Record<string, any>) {
  const pricing = { ...defaultPricing, ...supplied, rateBands: { ...defaultPricing.rateBands, ...(supplied?.rateBands || {}) }, cityMultipliers: { ...defaultPricing.cityMultipliers, ...(supplied?.cityMultipliers || {}) }, styleMultipliers: { ...defaultPricing.styleMultipliers, ...(supplied?.styleMultipliers || {}) } };
  const area = Number(answers.carpet_area_sqft);
  if (!Number.isFinite(area) || area < 100 || area > 100000) throw new Error("Enter a valid carpet area.");
  const finish = text(answers.finish_level, 40) || "Premium";
  const band = pricing.rateBands[finish] || pricing.rateBands.Premium;
  const cityFactor = Number(pricing.cityMultipliers[text(answers.city, 80)]) || 1;
  const styles = list(answers.styles);
  const styleFactor = Math.max(1, ...styles.map((style) => Number(pricing.styleMultipliers[style]) || 1));
  const spaces = list(answers.spaces);
  const scopeFactor = spaces.includes("Full Home") || spaces.length === 0 ? 1 : Math.min(0.95, Math.max(0.16, [...new Set(spaces)].reduce((total, item) => total + (spaceWeights[item] || 0), 0)));
  const factor = cityFactor * styleFactor * scopeFactor;
  const minValue = scopeFactor === 1 ? Number(pricing.minimumProjectValue) || defaultPricing.minimumProjectValue : 0;
  const low = Math.max(minValue, Math.round(area * Number(band.min) * factor / 1000) * 1000);
  const high = Math.max(low, Math.round(area * Number(band.max) * factor / 1000) * 1000);
  return { low, high, rate_low_per_sqft: Math.round(Number(band.min) * factor), rate_high_per_sqft: Math.round(Number(band.max) * factor) };
}
async function fingerprint(request: Request, formId: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bytes = new TextEncoder().encode(`${formId}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Website lead intake is not configured." }, 503);
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 35_000) return json({ error: "Submission is too large." }, 413);
    const payload = await request.json();
    const formId = text(payload?.form_id, 80);
    if (!/^[0-9a-f-]{36}$/i.test(formId)) return json({ error: "Invalid website form." }, 400);
    const db = service();
    const { data: form, error: formError } = await db
      .from("crm_website_lead_forms")
      .select("id,org_id,allowed_origins,active")
      .eq("id", formId)
      .maybeSingle();
    if (formError) throw formError;
    const origin = request.headers.get("origin")?.replace(/\/$/, "") || "";
    if (!form?.active || !origin || !form.allowed_origins.includes(origin)) return json({ error: "Website origin is not permitted." }, 403);
    if (text(payload?.website, 200)) return json({ ok: true }, 200, origin); // honeypot
    const contact = payload?.contact && typeof payload.contact === "object" ? payload.contact : {};
    const answers = payload?.answers && typeof payload.answers === "object" ? payload.answers : {};
    const name = text(contact.name, 160);
    const email = text(contact.email, 320).toLowerCase();
    const phone = text(contact.phone, 80);
    if (!name || (!email && !phone) || !validEmail(email)) return json({ error: "Enter your name and a valid email address or phone number." }, 400, origin);
    for (const key of ["property_type", "bhk", "city", "locality", "possession_status", "finish_level", "timeline"]) if (!text(answers[key], 160)) return json({ error: `Missing ${key.replaceAll("_", " ")}.` }, 400, origin);
    if (list(answers.spaces).length === 0 || list(answers.styles).length === 0) return json({ error: "Choose at least one space and style." }, 400, origin);
    const visitor = await fingerprint(request, form.id);
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count, error: rateError } = await db.from("crm_website_lead_requests").select("id", { count: "exact", head: true }).eq("form_id", form.id).eq("fingerprint", visitor).gte("created_at", since);
    if (rateError) throw rateError;
    if ((count || 0) >= 8) return json({ error: "Please wait a few minutes before trying again." }, 429, origin);
    const sourceIdentifier = text(payload?.submission_id, 120) || crypto.randomUUID();
    const { data: existing } = await db.from("crm_leads").select("id").eq("org_id", form.org_id).eq("source", "Website · Interior questionnaire").eq("website", sourceIdentifier).maybeSingle();
    if (existing) return json({ ok: true, duplicate: true }, 200, origin);
    const { data: organization, error: organizationError } = await db.from("organizations").select("owner_id").eq("id", form.org_id).single();
    if (organizationError || !organization) throw organizationError || new Error("Workspace unavailable.");
    const calculated = estimate(answers, (await db.from("crm_lead_form_configs").select("interior_pricing").eq("org_id", form.org_id).maybeSingle()).data?.interior_pricing || {});
    const customFields = Object.fromEntries(Object.entries(answers).map(([key, value]) => [`custom_${key}`, Array.isArray(value) ? list(value) : text(value, 2_000)]));
    Object.assign(customFields, { interior_estimate_low: calculated.low, interior_estimate_high: calculated.high, interior_rate_low_per_sqft: calculated.rate_low_per_sqft, interior_rate_high_per_sqft: calculated.rate_high_per_sqft, website_submission_id: sourceIdentifier });
    const { error: requestError } = await db.from("crm_website_lead_requests").insert({ form_id: form.id, fingerprint: visitor });
    if (requestError) throw requestError;
    const { error: insertError } = await db.from("crm_leads").insert({
      org_id: form.org_id, owner_id: organization.owner_id, name, company_name: text(contact.company, 160) || null,
      email: email || null, phone: phone || null, source: "Website · Interior questionnaire", status: "New", stage: "Enquiry", priority: "Normal", city: text(answers.city, 100),
      product: "Interior design", website: sourceIdentifier, estimated_value: calculated.low,
      notes: text(answers.project_notes, 2_000), custom_fields: customFields,
    });
    if (insertError) throw insertError;
    return json({ ok: true, estimate: { low: calculated.low, high: calculated.high, currency: "INR" } }, 201, origin);
  } catch (error) {
    console.error("Website lead intake failed", error);
    return json({ error: "We could not send your enquiry. Please try again." }, 500);
  }
});
