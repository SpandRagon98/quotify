# Qyrova CRM — first-use guide

## Set up your team

Sign in using your existing Qyrova email and password. Existing presets, Sheets,
documents, settings and public quotation links remain in their original services.
The default Home screen is now the Management dashboard; the old dashboard is
still available under Sales → Overview.

In Admin → Team members, add a colleague's existing Qyrova signup email. This does
not send an invitation. Create teams and choose a member's role/team. The colleague
can select your workspace in the sidebar and should reopen the app after a role
change. Owners cannot remove themselves or change the workspace owner's access.
Reassign a departing member's CRM records before removing them.

Sales Users work on their own assigned records. Sales Managers work on their own
and same-team records. Owner/Admin and legacy Editor have broader access; Viewer
cannot create/edit/archive/export CRM records. Finance has commercial/document
access. Doc Viewer retains the original document-only role. Server permissions,
not just hidden buttons, control the relational CRM and tracked quotation tables.

## Work an enquiry through to a quotation

1. In Lead Inbox, create an enquiry or preview/map a CSV import. Assign its owner.
   Each incoming record retains its source and original payload. CSV imports are
   limited to 2 MB / 1,000 rows, uploaded in validated batches of at most 100.
2. Review/accept it. Possible duplicate matches require explicit confirmation for
   merging or creating a separate lead. Merging appends notes, not field overwrites.
3. Open the lead. Log calls/notes, schedule meetings/tasks/follow-ups, and qualify it.
   Activities defaults to your Today list; switch to Upcoming, Overdue, Completed
   or All. Complete an activity with an outcome or edit its due date to reschedule.
4. Convert Lead: create or select the company Account, reuse an exact Contact where
   appropriate, and optionally create an Opportunity. Retrying conversion returns
   the same records. Existing follow-ups remain linked to the lead and new account.
5. In Opportunities, drag the deal or select its stage. Table view provides additional
   search, owner, source, stage, account, dates and value filters. Lost requires a
   reason. Won records deal value, not a customer payment or invoice.
6. Open Customer 360 to see the company, primary contact, metrics, contacts, deals,
   tasks, linked quotations/documents, notes and chronological history.
7. Create quotation from the account or opportunity. Select the Contact and related
   Opportunity, select a preset, and review which custom fields should receive each
   customer value. Unmapped fields keep their original defaults/manual entry.
   The optional CRM reporting amount does not alter calculated quotation fields.
8. Review in the original quotation form and generate its native PDF or configured
   Google Doc. The same Google Sheet quotation ID is linked to the CRM. Repeating
   generation on that review screen does not append another row. Edits from Sales
   → Quotations update the same CRM snapshot and preserve its relationships.

Quotation histories are not automatically converted into customer masters: their
custom fields cannot safely be interpreted without review. Unlinked historical
quotations still open through the original Sales screens.

## Workflows, reports and notifications

Owner/Admin can create rules in Automation → Workflows. Choose a trigger, optional
AND conditions and ordered actions, then explicitly enable the rule. Actions run
on new matching events, not a retrospective import. Execution history records
success, skipped conditions and failures. Recursive workflow actions are suppressed.
Email/WhatsApp workflow actions are not enabled without a secured provider.

Dashboard/Reports share one server metrics definition. Filter by time period,
salesperson, team, source, stage and currency. Lead counts use creation dates;
Won/Lost values use close dates. Open pipeline and due activities are current
snapshots. Date ranges use UTC. Currency values are never silently converted.
The conversion chart is a process summary rather than strict cohort attribution.
There is no invented invoice/revenue-collection module.

Assigned-record and workflow notifications appear in the existing bell. The
database scheduler checks overdue activities and configured reminders every minute;
the browser polls notifications approximately every 45 seconds while open. Read and
dismiss state persists per member. This is not desktop push/email notification.

## Storage and release boundary

CRM records, permissions, timelines, workflows and notifications live in the existing
Supabase Postgres workspace with row-level security. Presets/company configuration
remain in existing per-workspace `app_state` blobs plus the device cache. Original
quotation rows remain in Google Sheets; Google Docs/Gmail retain their existing paths.
Native PDFs are generated locally in the browser. CRM quote links retain reviewed
values and exact original quotation IDs without exposing CRM foreign keys publicly.

**Do not grant untrusted/public users access until the existing Google Apps Script
endpoint is secured.** Its operator-backed public endpoint is outside Postgres RLS.
The Apps Script editor project must be updated/redeployed with authenticated,
workspace/record-authorized requests and suitable limits. Optional Resend also needs
verified server authorization and sender/provider configuration before enabling it.

Website/API ingestion is a real authenticated `crm_ingest` RPC. An anonymous website
collector requires a separate server-authenticated, rate-limited gateway. IndiaMART,
TradeIndia, Justdial, Meta, WhatsApp and inbound Email are visibly unconfigured;
no third-party connection or automatic messaging is simulated.

## Validation and maintenance

Run `npm test`, `npm run test:browser`, `npm run lint` and `npm run build`. Browser
tests use isolated Edge and disposable PostgreSQL/RLS with intercepted Google/Auth
requests; they never seed production or send real email. Live smoke checks are in
`scripts/verify-crm.sql` and `scripts/verify-database.mjs`.

The private pre-migration logical export is outside Git. It is not a backup of
managed Auth/Storage or Google Sheets/Docs. Establish complete backups and restore
tests before public onboarding. Migrations were applied additively to the existing
manually initialized database; reconcile its baseline/history before using `db push`.
