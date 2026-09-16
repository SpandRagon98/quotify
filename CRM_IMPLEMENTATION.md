# Qyrova CRM implementation — discovery and delivery plan

Status: Core CRM implemented and locally validated; migrations 0004–0009 are now
applied to the existing Supabase project. Frontend publishing and live smoke checks
are in progress. External Google authorization remains a public-release blocker.

## Scope and existing application

Extend the existing web application in `SpandRagon98/quotify`. Do not modify the
marketing website or resume the experimental desktop/SQLite application.

- React 19, JavaScript/JSX, Vite 8, Framer Motion and Lucide; existing lockfile and
  dependencies should be retained. No ORM is currently used.
- Cloudflare Worker `qyrova` serves the SPA and assets. Existing production URL:
  https://qyrova.spandan305.workers.dev/.
- Supabase project `pczyjzkcmssxgqmzrona`: Auth, Postgres, PostgREST queries and
  SQL RPCs through `@supabase/supabase-js`.
- Existing tables: `profiles`, `organizations`, `org_members`, `app_state`,
  `tracked_quotes`, `quote_events`, as defined by migrations 0001–0003.
- Existing auth users are Supabase users. `profiles.default_org_id` selects a
  workspace; organization membership provides the existing role. Preserve the
  recent deferred-auth startup fix and its regression tests.
- The separate local demo account store named `accounts` is authentication data,
  **not** a CRM company/account entity. Do not reuse it for CRM customers.
- Navigation is a view state machine in `App.jsx`. `/q/<token>` is a separate
  public route in `main.jsx`. No React Router is currently installed.
- React hooks own state; presets, document configuration and email templates are
  browser-cached and mirrored as whole per-organization JSONB blobs in `app_state`.
  This is not appropriate for a growing CRM dataset or collaborative row edits.
- Google Apps Script performs quotation row CRUD in preset-linked Google Sheets,
  Google Doc generation and the default Gmail email delivery.
- `quotationService` builds dynamic sheet/document payloads, maintains quotation
  IDs during edits and handles calculated fields and subfields.
- `DocumentPreview`, browser print/PDF, `html2canvas` and jsPDF provide native
  documents and email attachments. `docRegistry` remembers document type/URL.
- `tracked_quotes` stores versioned snapshots and tokenized public quotations.
  `quote_events` plus public RPCs implement views, decisions, expiry and signatures.
- There is no dedicated invoice subsystem, customer/contact master or product
  catalog in the inspected schema. Customer/product details are arbitrary preset
  fields in historical quotation rows. Do not invent invoices or rewrite these rows.
- Existing table filtering/search/CSV are browser-side over fetched sheet data.
  CRM requires distinct server-paginated queries while retaining existing screens.
- `Overview`, `useDashboardData`, notification provider/bell, settings and shared
  workspace layout are existing extension points. Command search currently only
  searches screen names, not business records.
- Reuse current `.screen`, `.card`, `.control`, button, table, modal, status and
  layout tokens. Preserve DM Sans, burgundy default, classic/accent options,
  responsive sidebar and light/dark/glass themes. No new branding/design direction.

## Verified access and safety constraints

- The Supabase dashboard reports Qyrova healthy. It reports no tracked migrations
  and no listed backups; neither proves that schema/data is absent. Earlier SQL
  was applied manually. Do not replay migrations 0001–0003 blindly.
- Supabase CLI authorization succeeded using the user's one-use code. The live
  schema was inspected through the authorized Management API. Browser dashboard
  sign-in and the public anon key alone do not supply administration access.
- Never store a management/service-role token in
  frontend code, source control, this document or a public artifact.
- Before major implementation, finish feature-module inspection, capture the live
  schema/policy/function inventory and review existing data relationships using
  authorized access. Obtain a private logical backup/export before schema changes.
- Existing `app_state` policies allow any organization member to write; existing
  Google Apps Script endpoints execute as one operator without CRM role checks.
  Frontend tab hiding is not sufficient authorization. Do not present legacy
  document/integration access as fully secured merely by adding CRM role badges.
- The optional Resend function in source does not currently authenticate/authorize
  its caller itself. Do not reuse it for unattended workflow email until verified
  authentication, workspace authorization, sender restrictions and limits exist.

## Implementation sequence after access is available

1. Finish codebase discovery; snapshot live schema/data shape and establish a
   disposable test database/staging environment. Keep production demo-free.
2. Add new migrations after 0003 rather than editing applied migrations. Use
   dedicated organization-scoped relational tables for accounts, contacts, leads,
   opportunities, activities, lead sources/inbox, timeline events, quote links,
   workflow definitions/executions and persistent notifications. Add teams and
   membership relationships where required for team visibility.
3. Extend the **existing** role/membership system with Sales Manager, Sales User,
   Finance and Viewer capabilities, retaining Owner/Admin/Editor/Doc Viewer
   compatibility. Centralize permission evaluation in Postgres/server logic,
   including view/create/edit/archive/export/manage-all and own/team/all scopes.
4. Use RLS, workspace-consistent foreign keys, safe SQL RPCs, server validation,
   audit timestamps, soft archive and indexes for organization, owner, status,
   stage, source, account, dates and search. A client-provided workspace/owner ID
   is never proof of access. Privileged RPCs need explicit checks, limited grants
   and a fixed search path.
5. Implement Accounts/Contacts and reusable server-paginated CRM tables, filters,
   owner selectors, forms, detail layouts, timelines and confirmation modals.
6. Implement lead CRUD/search/filter/bulk selection and transactional conversion
   into a selected/new account, contact and optional opportunity. Make conversion
   idempotent, flag duplicate candidates and require confirmation for merging.
7. Implement the shared activity engine, My Activities views, completion/outcomes,
   rescheduling, follow-ups, due/overdue detection and reminders.
8. Implement opportunities with table and keyboard-accessible Kanban movement,
   persisted stage/probability changes, close dates, lost reason and aggregate KPIs.
9. Integrate the existing quotation form/review/service without changing its
   payload semantics. Carry an explicit CRM context through form/review navigation;
   map account/contact fields to preset field IDs with user-reviewable mappings.
   Store CRM-to-quotation relationships separately from historical sheet columns.
10. Complete Account 360 tabs and unified chronological timeline. Preserve quote
    versions/events, document URLs and historical snapshots. Backfill proposed
    account/contact matches only through a preview-and-confirm import, with a
    migration audit record and undo strategy where supported.
11. Implement Lead Inbox with manual/CSV ingestion, authenticated website/API
    ingestion, field mapping, source identifiers, source timestamps, preserved raw
    payloads, processing states, assignment and confirmed duplicate merging.
    IndiaMART/TradeIndia/Justdial/Meta/WhatsApp are unconfigured connectors, not
    working integrations. CSV import requires preview, validation and bounded batches.
12. Implement server-side rule workflows with AND conditions, bounded allowed
    actions, enabled/disabled state and execution history. Deduplicate each event
    execution, suppress recursive action-trigger loops and log failures. Handle
    due/overdue events with a scheduled backend worker, not only an open browser.
    Unconfigured email/external messaging actions must remain unavailable.
13. Implement a centralized server metrics/query service/RPC for timeframe- and
    permission-scoped dashboards, charts, salesperson/source performance, funnel,
    upcoming closes and actionable overdue follow-ups. Define won deal value as
    CRM won value, not invoiced/collected revenue where no invoice system exists.
14. Integrate grouped CRM/Sales/Automation/Reports navigation, real record search
    and database-backed in-app notifications. Preserve every existing screen and
    the public token route. Default home becomes the CRM management dashboard only
    after the complete journey and permissions pass validation.
15. Validate, deploy migrations/backend before enabling dependent frontend pages,
    and perform the full acceptance journey with dedicated test users/records.
    Publish only verified working functionality, not mock successes.

## Public links and historical data

The source migrations expose a broader public projection than the hardened live
`get_tracked_quote` RPC. Adding CRM foreign keys directly to that table could expose
new internal IDs through public links. Use a separate link table and an explicitly
reviewed public projection when changing quote schema/RPCs. Never expose CRM
notes, contact directories, account IDs or workflow data to anonymous recipients.

Existing Google Sheet rows remain the historical source for legacy quotations.
Link records should capture organization + preset ID + quotation ID and preserve
the exact historical artifact/reference. Do not infer financial totals from
arbitrary numeric preset fields without an explicit amount/currency mapping.

## Test and release gates

- Baseline: existing seven authentication lifecycle tests pass before CRM changes.
- Database tests: anonymous denial; cross-workspace direct API denial; own/team/all
  visibility; Viewer write/export restrictions; forged owner/relationship IDs;
  non-admin role changes; unauthorized RPC and ingestion attempts.
- Leads: create/edit/search/filter, duplicate candidates and idempotent conversion.
- Accounts: multiple contacts, primary contact, linked opportunities and activities.
- Opportunities: creation, table/Kanban transitions, probabilities, Won/Lost and
  weighted metrics with shared server definitions.
- Activities: completion, reschedule, outcomes, overdue and scheduled reminders.
- Workflows: trigger/condition/actions, disabled behavior, duplicate events, loop
  prevention, allowed actions, failures and execution history.
- Customer 360: account/contact/opportunity/quote relationships and chronological
  events; explicit prefill mapping; historical quotations still open unchanged.
- Regression: presets/calculated fields/subfields, quotation create/edit, native
  and Google Doc PDF, public decisions/expiry/versioning, authentication,
  search/filter/export, email, notifications and settings/themes.
- Run compilation, lint, automated tests, desktop/mobile/browser navigation and
  the Lead Inbox → Lead → Activity → Conversion → Opportunity → Quotation journey.
  Do not send real email or populate production demo customers for testing.

## Current delivery boundary

The live schema has an additional `tracked_quotes.revoked_at` column and hardened
public-link RPCs not present in migrations 0001–0003. Preserve these live changes.
A private export of the six existing application tables plus public columns,
constraints, policies, functions and triggers was completed outside the repository.
It is not a full disaster-recovery backup of Auth, Storage or Google services.

Local validation uses PGlite/Postgres, not production demo data. All 23 Node tests
pass, including seven existing auth regressions, ten database/RLS/workflow tests
and six parsing/prefill/timeframe tests. Three isolated Edge browser tests pass:
the complete enquiry-to-quotation/PDF journey, enabled/disabled workflows, and
responsive Viewer navigation/documents with light/dark/glass appearance. Google
requests in these tests are intercepted; they do not prove live Gmail/Docs delivery.
The production build passes and now lazy-loads CRM, documents, PDF tooling and
public quotation screens. Full ESLint passes. Hosted scheduling, production schema
checks and Cloudflare publishing have passed. Migrations 0004–0009 have
now run successfully against Supabase, without replaying 0001–0003. Authenticated
owner RPCs and non-member isolation pass transaction-local read-only smoke checks.
All 12 CRM tables have RLS, the minute-based cron job is active and its last two
runs succeeded. Original table counts remain unchanged; new customer tables are
empty. No production demo data was inserted. The extended browser journey also
verifies historical Sales-screen edits update the same CRM snapshot without losing
account/contact/opportunity/owner/amount relationships or creating a second row.
Migration 0009 adds a narrowly authorized quotation email history RPC so Finance
can record client-reported sends without acquiring general activity-write access.
The live public quotation/view/response RPC definitions match the private backup
exactly. Anonymous REST reads of ten CRM tables and anonymous ingestion are denied.

The frontend is deployed at https://qyrova.spandan305.workers.dev/ with Cloudflare
version `c73b21db-3644-4da4-a0f0-ba0ebc967c06`. An isolated signed-out Edge smoke
test confirms the hosted assets match the validated build and the login opens
without runtime errors. The invalid public-token route is checked separately.
Authenticated acceptance journeys use isolated test credentials and intercepted
Google requests, not the owner's live session. Live Gmail/Docs delivery and the
Google authorization boundary are still external release gates, not passed tests.

The existing project was manually initialized and had no tracked migration
history. These additive scripts were also applied through authorized SQL queries;
do not blindly run `db push` over 0001–0003. Reconcile the live baseline and record
migration history before adopting an automatic database deployment pipeline.

The existing Apps Script endpoint is publicly callable. New CRM RLS and UI role
checks cannot close that external endpoint. Full quotation/document authorization
requires a secured Google bridge and updating/redeploying the actual Apps Script.
Do not describe legacy external integration access as fully secured until then.
