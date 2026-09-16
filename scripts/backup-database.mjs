// Private pre-migration export. Uses the authorized Supabase CLI; never reads tokens.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const project = 'pczyjzkcmssxgqmzrona';
const tables = ['profiles', 'organizations', 'org_members', 'app_state', 'tracked_quotes', 'quote_events'];
function query(sql) {
  const npx = resolve(process.execPath, '..', 'node_modules/npm/bin/npx-cli.js');
  const result = spawnSync(process.execPath, [npx, '--yes', 'supabase', 'db', 'query', '--project-ref', project, '--linked', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || 'Database export failed');
  const start = result.stdout.indexOf('{');
  return JSON.parse(result.stdout.slice(start)).rows;
}
// Do not put backups in the repository: they may contain private customer data.
const target = resolve(process.argv[2] || '../../private-backups', `qyrova-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(target, { recursive: true });
const inventory = query("select jsonb_build_object('columns',(select jsonb_agg(to_jsonb(c)) from information_schema.columns c where c.table_schema='public'),'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where p.schemaname='public'),'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where connamespace='public'::regnamespace),'functions',(select jsonb_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t where not t.tgisinternal and t.tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace))) as inventory");
writeFileSync(resolve(target, 'schema-inventory.json'), JSON.stringify(inventory, null, 2));
for (const table of tables) {
  const rows = query(`select * from public.${table}`);
  writeFileSync(resolve(target, `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`${table}: ${rows.length} rows exported (contents kept private)`);
}
writeFileSync(resolve(target, 'README.txt'), 'Private logical export of application tables and public schema definitions. Not a full Supabase disaster-recovery backup: Auth users, managed storage, Google Sheets and Google Docs remain in their original services. Restore requires reviewing schema inventory and inserting rows in FK order. Never publish this directory.');
console.log(`Private export: ${target}`);
