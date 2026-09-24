// Disposable browser-test backend. Real Postgres migrations/RLS; never production data.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export const PROJECT = "pczyjzkcmssxgqmzrona";
export const PRESET = {
  id: "browser-preset",
  name: "CRM Test Quotation",
  sheetTabName: "CRM Test",
  googleSheetId: "browser-test-sheet",
  googleSheetUrl:
    "https://docs.google.com/spreadsheets/d/browser-test-sheet/edit",
  fields: [
    { id: "customer", label: "Customer Name", type: "text", required: true },
    { id: "company", label: "Company Name", type: "text", required: true },
    { id: "email", label: "Customer Email", type: "email" },
    {
      id: "value",
      label: "Deal Value",
      type: "number",
      required: true,
      defaultValue: 1000,
    },
  ],
};
export async function databaseFixture(page, { role = "owner" } = {}) {
  const db = new PGlite();
  let statements = [];
  const rows = async (sql, args = []) => {
    statements.push(sql);
    return (await db.query(sql, args)).rows;
  };
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key default gen_random_uuid(),email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for (const migration of [
    "0001_init",
    "0002_tracked_quotes",
    "0003_quote_lifecycle",
    "0004_crm_foundation",
    "0005_crm_operations",
    "0006_crm_workflows",
    "0008_crm_queries",
    "0009_crm_email_history",
    "0010_telegram_lead_inbox",
    "0011_lead_form_configuration",
  ]) {
    await db.exec(
      (
        await readFile(
          new URL(
            `../../supabase/migrations/${migration}.sql`,
            import.meta.url,
          ),
          "utf8",
        )
      ).replace('create extension if not exists "pgcrypto";', ""),
    );
  }
  const users = await rows(
    "insert into auth.users(email,raw_user_meta_data) values('browser-admin@test.invalid','{\"full_name\":\"Test Admin\"}'),('browser-sales@test.invalid','{\"full_name\":\"Test Salesperson\"}') returning id,email",
  );
  const [admin, sales] = users;
  const org = (
    await rows("select default_org_id from profiles where id=$1", [admin.id])
  )[0].default_org_id;
  await rows(
    "insert into org_members(org_id,user_id,role) values($1,$2,'sales_user')",
    [org, sales.id],
  );
  await rows("update org_members set role=$1 where org_id=$2 and user_id=$3", [
    role,
    org,
    admin.id,
  ]);
  await rows("insert into app_state(org_id,key,data) values($1,'presets',$2)", [
    org,
    JSON.stringify([PRESET]),
  ]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    admin.id,
  ]);
  await db.exec("set role authenticated");
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: admin.id, role: "authenticated", exp: expires, iss: `https://${PROJECT}.supabase.co/auth/v1` })}.fixture-signature`;
  await page.addInitScript(
    ({ project, session }) =>
      localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify(session)),
    {
      project: PROJECT,
      session: {
        access_token: token,
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expires,
        user: {
          id: admin.id,
          email: admin.email,
          role: "authenticated",
          aud: "authenticated",
          user_metadata: { full_name: "Test Admin" },
          app_metadata: { provider: "email", providers: ["email"] },
        },
      },
    },
  );
  const errors = [];
  await page.route(`https://${PROJECT}.supabase.co/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const method = request.method();
    const respond = (data, status = 200, count) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          ...(count != null
            ? { "content-range": `0-${Math.max(0, count - 1)}/${count}` }
            : {}),
        },
        body: JSON.stringify(data),
      });
    if (method === "OPTIONS") return respond({});
    if (url.pathname.startsWith("/auth/"))
      return respond({ user: { id: admin.id, email: admin.email } });
    try {
      if (url.pathname.includes("/rpc/")) {
        const name = url.pathname.split("/").pop();
        if (!/^crm_[a-z_]+$/.test(name))
          throw new Error("Unsupported fixture RPC");
        const body = request.postDataJSON() || {};
        const entries = Object.entries(body);
        if (entries.some(([key]) => !/^p_[a-z_]+$/.test(key)))
          throw new Error("Invalid RPC argument");
        const data = await rows(
          `select to_jsonb(public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")})) as result`,
          entries.map(([key, v]) =>
            key === "p_ids"
              ? v
              : Array.isArray(v) || (typeof v === "object" && v !== null)
                ? JSON.stringify(v)
                : v,
          ),
        );
        return respond(
          name === "crm_duplicates"
            ? data.map((d) => d.result)
            : (data[0]?.result ?? null),
        );
      }
      const table = url.pathname.split("/").pop();
      if (
        !/^(crm_[a-z_]+|profiles|org_members|app_state|tracked_quotes)$/.test(
          table,
        )
      )
        throw new Error(`Unsupported table ${table}`);
      let args = [],
        where = [];
      const parameter = (value) => {
        args.push(value);
        return "$" + args.length;
      };
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "offset", "limit", "on_conflict"].includes(key))
          continue;
        if (!/^[a-z_]+$/.test(key)) throw new Error("Unknown fixture filter");
        if (value === "is.null") where.push(`${key} is null`);
        else if (value.startsWith("eq."))
          where.push(`${key}=${parameter(value.slice(3))}`);
        else if (value.startsWith("gte."))
          where.push(`${key}>=${parameter(value.slice(4))}`);
        else if (value.startsWith("lt."))
          where.push(`${key}<${parameter(value.slice(3))}`);
        else if (value.startsWith("lte."))
          where.push(`${key}<=${parameter(value.slice(4))}`);
        else if (value.startsWith("in."))
          where.push(
            `${key} in (${value
              .slice(4, -1)
              .split(",")
              .map((v) => parameter(v))
              .join(",")})`,
          );
        else if (value === "not.in.(Completed,Cancelled)")
          where.push("status not in ('Completed','Cancelled')");
        else if (value.startsWith("wfts(simple)."))
          where.push(
            `search @@ websearch_to_tsquery('simple',${parameter(value.slice(13))})`,
          );
        else if (value.startsWith("cs."))
          where.push(
            `${key} @> ${parameter(JSON.parse(value.slice(3)))}::text[]`,
          );
        else throw new Error(`Unsupported fixture filter ${key}: ${value}`);
      }
      const suffix = where.length ? " where " + where.join(" and ") : "";
      let data, count;
      if (method === "GET" || method === "HEAD") {
        count = Number(
          (
            await rows(
              `select count(*) as count from public.${table}${suffix}`,
              args,
            )
          )[0].count,
        );
        const orders = (url.searchParams.get("order") || "")
          .split(",")
          .filter(Boolean)
          .map((value) => {
            const [key, direction] = value.split(".");
            if (!/^[a-z_]+$/.test(key) || !["asc", "desc"].includes(direction))
              throw new Error("Bad sort");
            return `${key} ${direction} nulls last`;
          });
        data = await rows(
          `select * from public.${table}${suffix}${orders.length ? " order by " + orders.join(",") : ""} limit ${Math.min(100, Number(url.searchParams.get("limit") || 100))} offset ${Number(url.searchParams.get("offset") || 0)}`,
          args,
        );
      } else if (method === "POST" || method === "PATCH") {
        const payload = request.postDataJSON();
        const entries = Object.entries(payload);
        if (entries.some(([key]) => !/^\w+$/.test(key)))
          throw new Error("Bad field");
        if (method === "POST") {
          const fields = entries.map(([key]) => key);
          const values = entries.map(([, v]) =>
            parameter(
              v && typeof v === "object" && !Array.isArray(v)
                ? JSON.stringify(v)
                : v,
            ),
          );
          const conflict = url.searchParams.get("on_conflict");
          if (conflict && !/^[a-z_,]+$/.test(conflict))
            throw new Error("Bad conflict");
          data = await rows(
            `insert into public.${table}(${fields.join(",")}) values(${values.join(",")})${
              conflict
                ? " on conflict(" +
                  conflict +
                  ") do update set " +
                  fields
                    .filter((f) => !["org_id", "id"].includes(f))
                    .map((f) => `${f}=excluded.${f}`)
                    .join(",")
                : ""
            } returning *`,
            args,
          );
        } else {
          const assignments = entries.map(
            ([key, value]) =>
              `${key}=${parameter(value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value)}`,
          );
          data = await rows(
            `update public.${table} set ${assignments.join(",")}${suffix} returning *`,
            args,
          );
        }
      } else throw new Error("Unsupported method");
      if (url.searchParams.get("select")?.includes("account:"))
        for (const record of data)
          record.account =
            (
              await rows(
                "select id,name from crm_accounts where org_id=$1 and id=$2",
                [org, record.account_id],
              )
            )[0] || null;
      const single = request.headers().accept?.includes("object+json");
      return respond(
        single ? (data[0] ?? null) : data,
        method === "POST" ? 201 : 200,
        count,
      );
    } catch (error) {
      errors.push({ path: url.pathname, message: error.message });
      return respond({ message: error.message, code: "FIXTURE_ERROR" }, 400);
    }
  });
  const sheet = { headers: [], rows: [] };
  let emailCount = 0;
  await page.route("https://script.google.com/macros/s/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const payload =
      request.method() === "POST"
        ? request.postDataJSON()
        : Object.fromEntries(url.searchParams);
    if (payload.action === "getSheetData")
      return route.fulfill({
        json: { success: true, action: payload.action, ...sheet },
      });
    if (payload.action === "appendRow") {
      sheet.headers = payload.headers;
      sheet.rows.push(payload.row);
    }
    if (payload.action === "updateRow") {
      const index = sheet.rows.findIndex((r) => r[0] === payload.quotationId);
      if (index < 0) throw new Error("Original test quotation missing");
      sheet.rows[index] = payload.row;
    }
    if (payload.action === "sendEmail") emailCount++;
    return route.fulfill({
      json: {
        success: true,
        action: payload.action,
        docUrl:
          payload.action === "generateDoc"
            ? "https://docs.google.com/document/d/browser-test-doc/edit"
            : undefined,
      },
    });
  });
  await page.addInitScript(() => {
    window.print = () => {
      window.__testPrintCount = (window.__testPrintCount || 0) + 1;
    };
  });
  return {
    db,
    org,
    admin,
    sales,
    sheet,
    errors,
    rows,
    get emailCount() {
      return emailCount;
    },
    get statements() {
      return statements;
    },
  };
}
