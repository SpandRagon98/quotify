// Read-only live security/regression checks. Never prints tokens or customer data.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const project = "pczyjzkcmssxgqmzrona";
const backup = process.argv[2];
if (!backup)
  throw new Error("Supply the private pre-migration backup directory.");
const old = JSON.parse(
  readFileSync(resolve(backup, "schema-inventory.json"), "utf8"),
)[0].inventory;
const names = ["get_tracked_quote", "record_quote_view", "respond_to_quote"];
const sql =
  "select p.proname as name,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_tracked_quote','record_quote_view','respond_to_quote')";
const npx = resolve(process.execPath, "..", "node_modules/npm/bin/npx-cli.js");
const result = spawnSync(
  process.execPath,
  [
    npx,
    "--yes",
    "supabase",
    "db",
    "query",
    "--project-ref",
    project,
    "--linked",
    sql,
  ],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
if (result.status !== 0)
  throw new Error(result.stderr || "Database query failed");
const definitions = JSON.parse(
  result.stdout.slice(result.stdout.indexOf("{")),
).rows;
for (const name of names) {
  const previous = old.functions.find((f) =>
    f.includes(`FUNCTION public.${name}(`),
  );
  assert.ok(previous, `Missing private backup definition for ${name}`);
  assert.equal(
    definitions.find((f) => f.name === name)?.definition,
    previous,
    `${name} changed`,
  );
  console.log(`${name}: live hardened public function unchanged`);
}
const env = Object.fromEntries(
  readFileSync(".env.production", "utf8")
    .split(/\r?\n/)
    .filter((s) => s.includes("="))
    .map((s) => [
      s.slice(0, s.indexOf("=")),
      s.slice(s.indexOf("=") + 1).trim(),
    ]),
);
const headers = {
  apikey: env.VITE_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};
for (const table of [
  "crm_leads",
  "crm_accounts",
  "crm_contacts",
  "crm_opportunities",
  "crm_activities",
  "crm_inbox",
  "crm_quote_links",
  "crm_events",
  "crm_notifications",
  "crm_workflows",
]) {
  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
    { headers, signal: AbortSignal.timeout(15000) },
  );
  assert.ok(
    [401, 403].includes(response.status),
    `Anonymous ${table} read was not denied (${response.status})`,
  );
  console.log(`${table}: anonymous REST access denied`);
}
const denied = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/crm_ingest`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    p_org: "00000000-0000-0000-0000-000000000099",
    p_source: "Security check",
    p_entries: [{ name: "Must never be inserted" }],
  }),
  signal: AbortSignal.timeout(15000),
});
assert.ok(
  [401, 403].includes(denied.status),
  `Anonymous ingestion was not denied (${denied.status})`,
);
console.log("crm_ingest: anonymous ingestion denied; no record inserted");
