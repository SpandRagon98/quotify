# Qyrova — Phase 3: tracked-quote lifecycle ($0)

Phase 3 turns a sent quote into a real sales artifact. The client-facing page
(`/q/<token>`) now supports the full lifecycle, and your notifications fire on
**real database status changes** — not by diffing spreadsheet columns.

Everything here is **$0** (Supabase free tier). There is **one required step**:
run a SQL file.

---

## A. Required — run the lifecycle migration (~1 min)

Supabase → **SQL Editor** → **New query** → paste all of
**`supabase/migrations/0003_quote_lifecycle.sql`** → **Run**. ("Success.")

It extends `tracked_quotes` with expiry, a typed-name signature, versioning, and
`updated_at`, and upgrades the public functions (the responder now takes a
signature and blocks expired quotes).

> Order matters: run `0001` → `0002` → `0003`. If you've done 0001/0002 already
> (you have), just run 0003.

---

## What's new

### Client-facing quote page (`/q/<token>`)
- **Download PDF** — the client can download the quotation as a PDF, generated in
  their browser ($0, no server).
- **Accept / Request changes / Decline** — clear, branded actions.
- **Acceptance signature** — accepting requires the client to **type their full
  name**, captured as a lightweight signature and shown to you.
- **Expiry** — a "Valid until" date is displayed; once past it the quote shows as
  **Expired** and responses are blocked (enforced server-side too).
- **Versioning** — re-sending a quote for the same record creates **v2, v3, …** in
  one history thread; the page shows a "Revised · v2" badge. Old versions are kept.

### Sending (Email composer)
- A **"Valid for N days"** field (default 30; `0` = no expiry) sets the expiry.
- The status line now shows **version, view count, signature, and note**, e.g.
  *"Accepted · v2 · 3 views · signed: Jane Smith"*.

### Notifications on real DB changes
- In cloud mode the app polls `tracked_quotes` (every 45s and on tab focus) and
  fires a notification on real transitions: **Viewed / Accepted / Declined /
  Changes requested / Expired** — so you know exactly when to follow up. The old
  spreadsheet-column detection still works for the Gmail path; the two are
  complementary.

---

## Lifecycle

```
draft ─▶ sent ─▶ viewed ─▶ accepted
                     │          declined
                     │          changes requested
                     └─▶ expired (past "valid until")
```

(Re-sending a revised quote starts a new version in the same thread, preserving
history.)

## Cost

| Piece | Cost |
|---|---|
| Quotes table, lifecycle, functions | Supabase free — **$0** |
| Client PDF download | browser-side — **$0** |
| Status notifications (polling) | Supabase free — **$0** |

**Total added cost: $0.** Nothing else in the app changed — Save/Update/Load/
Delete, Database, Doc View, native PDF, Google Doc, roles, themes, presets,
subfields, and the existing email paths all behave exactly as before.
