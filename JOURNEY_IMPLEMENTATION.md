# Qyrova lead-to-cash journey

This increment evolves the existing React/Vite/Supabase app. It does not replace
authentication, workspace ownership, existing records, Google Sheets/Docs
templates, lead form/Excel imports, interior estimates, Telegram, lead scoring,
automation, email intent processing, or change-order approval links.

## Everyday navigation

- Home: attention-first customer actions and exact workspace totals.
- Customers: a readable customer list, with enquiries, contacts and company
  records available as secondary views.
- Deals: the seven-stage pipeline with drag/drop and a keyboard/mobile stage
  selector, a small Lost reason dialog, and Won → invoice/kickoff/task actions.
- Tasks: Today (including overdue), Upcoming, Done, and the original complete
  activity list. Plan My Day ranks the loaded page using due date, urgency,
  deal value and Pulse.
- Documents: quotation, invoice and proposal creation; existing custom templates,
  quotation records, previews and email history remain reachable here.
- Reports: business snapshot and the original advanced reports.

Settings retains templates, existing quotation database, team, integrations,
automation, permissions, themes and advanced sales configuration. Legacy routes
still work and select the corresponding primary sidebar section.

## Guidance and search

Rules live in `src/crm/brain.js`. Pulse shows facts and its reason; its thresholds
are configurable per workspace. Database views use the same business rules so
filters and totals are not based only on a downloaded page.

Ctrl/Cmd+K opens permission-scoped search over customers, contacts, enquiries,
deals, documents, tasks, navigation and create actions. Common natural-language
filters, Indian amounts, month names and timeline/phone questions are parsed
locally. Queries are debounced, abortable, bounded, and never sent to an LLM.
This is deterministic command search, not an unrestricted chatbot.

Quick Capture proposes editable details, then creates linked records atomically.
The provider-independent `configureIntelligence({ extract })` boundary permits a
future lightweight extraction provider. The current fallback is a local parser,
not AI. Follow-up tone controls also use local templates. These new features
consume zero AI tokens. Existing optional sales AI functionality is unchanged.

## Documents and events

The new five-step document flow stores a durable snapshot in the existing
`crm_quote_links` table. Amounts are rounded and validated; discount is applied
before tax. Saved native documents can be reopened for PDF download, email or
share links. Existing custom-template editing/versioning remains in the original
quotation workflow. Native invoices are documents, not a new payment processor.

Email uses the existing configured delivery integration. Only a successful
provider response records a send. Copying a public link alone does not mark an
email Sent. Public links remain capability links; invoice links do not expose
quotation acceptance controls.

Database events connect the journey:

- Verified quotation email → Sent date, timeline, appropriate stage, one follow-up.
- Customer reply (received integration message or recorded response) → completes
  pending quotation follow-ups and recalculates guidance.
- Accepted current quotation → Won; superseded versions cannot change the deal.
- Manual Won/Lost → stops generated quotation follow-ups, leaving delivery tasks.
- Completed call/meeting/email → contact history and initial Talking stage.
- Existing automatically sent quotation drafts → the same document/timeline model.

A customer with multiple deals prioritizes its riskiest active deal. Quotations
and replies from another deal are not borrowed into that deal's guidance.
Local calendar boundaries are sent explicitly for daily/monthly reporting.

## Migration and rollout

`supabase/migrations/0019_lead_to_cash_journey.sql` is transactional and additive.
It adds document metadata, lost notes, scoped settings, indexed read views and
narrow RPCs/triggers. It does not drop existing tables or data. The live database
also retains objects from the earlier reverted 0018 UI; those are not removed.

The existing deployment has an empty Supabase CLI migration-history table even
though earlier schemas are present. Do not blindly run `supabase db push` against
it: that would attempt to replay old migrations. This rollout applies only 0019
using `supabase db query --linked --file supabase/migrations/0019_lead_to_cash_journey.sql`.
Reconcile migration history separately before switching to automated DB pushes.

No development sample customers or messages are inserted into production.

## Verification

- `npm test`: 46 unit/database regressions, including authorization, cross-workspace
  isolation, duplicate/atomic capture, document amounts, quotation events and
  multi-deal guidance.
- `npm run lint` and `npm run build`.
- Playwright CLI checks against a disposable PGlite backend: onboarding,
  quotation save/send/PDF, search/filters, Customer 360, stale Pulse/follow-up,
  response recording, Won/invoice, Quick Capture, Lost reasons, reports and
  mobile drawer/layout. Email delivery is mocked during these checks; no real
  customer emails are sent.
- The existing browser regression spec is updated for the new navigation.

For an isolated interactive browser backend, run
`node tests/browser/fixture-server.mjs --seed`. Its coherent demo data belongs
only to its disposable database. Do not use it as a production backend.

Motion uses short transform/fade/subtle blur transitions with reduced-motion
support. Heavy PDF/Excel and advanced screens remain lazy-loaded. No universal
60 fps guarantee is made across all hardware or dataset sizes.
