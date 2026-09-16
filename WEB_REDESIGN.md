# Qyrova web workspace redesign

This is the existing browser application, not the experimental Tauri/SQLite desktop build.

## Design

- Warm neutral surfaces, burgundy accents, self-hosted DM Sans, grouped navigation and quieter controls.
- Dashboard uses actual Google Sheet quotation records with the existing Supabase approval overlay. No invented balances or financial data.
- Recent records, six-month activity, pipeline and preset shortcuts replace the previous overview.
- Shared styling covers presets, quotation entry, database, document view, email, users, settings, dialogs and public quotation pages.
- Existing theme/accent choices, permissions, storage and document/email workflows are retained. New users default to burgundy.
- Screen search is a navigation shortcut, not a search of stored quotations.
- Password visibility and accessible names for dynamic form controls are included.

The inspiration is Nixtio's Banking Dashboard UI Design on Dribbble. Its page text and palette were accessible, but the reference image was blocked. This is an interpretation, not a verified pixel-for-pixel recreation.

## Verification

`npm run lint`, `npm run build`, `git diff --check` and `npm audit --omit=dev` pass. The production audit reports zero known vulnerabilities after upgrading jsPDF.

Browser checks use the local demo account only: sign-in, overview, presets, quotation entry/validation, document view, email empty state, settings, dark theme and screen-search navigation. No production quotations or email were written or sent. End-to-end Google Docs/Gmail operations and populated production data require a separate account-level acceptance test. Responsive breakpoints are implemented; physical phone testing remains recommended.

## Deployment

The existing Cloudflare Worker `qyrova` builds from `SpandRagon98/quotify`, production branch `main`, using `npm run build` then `npx wrangler deploy`.

Keep `.env.production` configured with the public Supabase URL and anon key; do not replace these with a service-role key. This UI release does not change Supabase policies, Google Apps Script access or the backend's authorization design. A visual refresh is not a public-launch security audit.
