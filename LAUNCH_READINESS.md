# Qyrova — Launch readiness (multi-user audit)

Audit date: 2026-06-10. Target: 100+ simultaneous users without crashes,
data mixing, or data loss.

---

## TL;DR

**Architecturally, 100 concurrent users is not a problem**: the app is a static
SPA on Cloudflare's edge (effectively unlimited), auth + data isolation run on
Supabase Postgres with Row-Level Security, and heavy work (PDF render) happens
in each user's own browser. There is no shared server process to crash.

**The one feature that is NOT multi-tenant is the Google integration** (Sheets
rows + Gmail sending via your single Apps Script). See "Known limitations" —
decide before launch how you position it.

---

## ✅ Verified safe (how isolation actually works)

| Area | Mechanism |
|---|---|
| Accounts | Supabase Auth (hashed passwords, email verification, session refresh). Refresh-proof: the app waits for session restore before rendering. |
| Workspace isolation | Every account gets a private organization (DB trigger). **Every table has Row-Level Security** — queries physically cannot return another org's rows, even with a modified client. |
| Presets / doc config / email templates / doc registry | Stored per-org in `app_state`; RLS member-only. |
| Tracked quotes & events | Per-org rows + RLS. Public access ONLY via `SECURITY DEFINER` functions keyed by a 128-bit crypto-random token — unguessable, non-enumerable. |
| Approval / signature | `respond_to_quote(token, …)` updates only the row owning that token. Finalized quotes are idempotent; expired quotes are blocked server-side. One user's approval cannot touch another user's data. |
| Public links | `/q/<token>` validates the token; invalid/expired links get clean error pages. The page never mounts the authenticated app. |
| Unauthenticated access | No session → only the Auth screen renders. The `/q/` page is the only public surface. |
| IDs | Quotation IDs: timestamp + crypto-random suffix. Tracked-quote tokens: 128-bit crypto-random. Versioned re-sends keep history (thread + version). |
| Concurrency | No server-side shared mutable state. Each browser session is independent; Supabase handles concurrent writes transactionally. |
| Crash safety | Top-level error boundary: a render bug shows a "Reload Qyrova" recovery card, never a white page. All failed saves/sends surface real errors. |
| Big datasets | Tables render incrementally (150 rows + Show more); search/filter/CSV operate on the full set. |

### Fixed in this audit
- **Shared-browser leak**: logout now clears *all* cached user data
  (doc registry, notifications, seen-status) — previously the next account on
  the same browser could see the prior user's notification history and have
  the prior user's doc registry merged into their own cloud workspace.
- **Token-refresh churn**: Supabase fires an auth event ~every 50 min; stores
  no longer re-hydrate from the cloud unless the actual user/org changed
  (an unlucky refresh could previously overwrite an in-flight edit).
- **Crypto-strength ID suffixes** (was `Math.random`).
- **Error boundary** + **incremental table rendering** (above).

---

## ⚠️ Known limitations — read before launch

### 1. Google Sheets/Docs/Gmail is a single-operator integration (biggest one)
All users share **one Apps Script deployment that runs as YOUR Google account**:
- A user can only link a Sheet/Doc that *your* Google account can open. Other
  people's private sheets won't work unless they share them with you.
- Seeded presets ship with **no** sheet linked (verified) — users can't
  accidentally write into each other's sheets. But nothing *prevents* two users
  from pasting the same sheet URL.
- The Apps Script endpoint is public (the URL is in the app bundle). Anyone
  with the URL can call it against any sheet **your account** can access.
- Gmail sending: all "Gmail path" emails come from your account and share
  **your daily quota (~100–1,500/day)**. 100 active users will exhaust it.

**Launch recommendation:** position cloud accounts + tracked quotes as the
product (fully isolated, scales fine), use the **Resend** email path
(per PHASE2_SETUP.md), and treat the Google Sheet link as a power-user/your-own
workflow. The real fix later (Phase: per-user Google OAuth, or moving rows
into Postgres) is a multi-day project — don't rush it into this launch.

### 2. Same account on two devices simultaneously
Presets/config are saved as whole blobs — concurrent edits from two devices of
the *same* account are last-write-wins (one device's change can win over the
other's). Fine for single-owner workspaces; revisit before team accounts.

### 3. Tracked-quote snapshots store images inline
A quote with a large logo/banner stores those data-URIs in its snapshot
(≤ ~2 MB each, capped at upload). Heavy senders will grow the free 500 MB
database — monitor Supabase storage usage after launch.

### 4. Supabase free tier
Pauses after ~1 week of inactivity and has shared resources. **Upgrade to Pro
($25/mo) before/at launch** if you expect real traffic — that's the only line
item needed for 100 users.

---

## 🧪 Pre-launch test checklist (do this with 2 real accounts)

Use two browsers (or one normal + one incognito), accounts A and B:

1. **Signup/verify/login** both accounts. Refresh mid-session — still signed in.
2. A creates a preset + quotation; B creates different ones.
   → B's Presets/Database/Email tabs show **only B's data** (and vice versa).
3. A and B generate documents at the same time (one Native, one Google Doc).
4. A and B send tracked emails at the same time; both `/q/` links open the
   correct document; approving B's quote changes **nothing** in A's account.
5. Open A's `/q/` link, modify the token in the URL → "Quotation not found".
6. Approve an already-approved link again → idempotent "already responded".
7. A logs out on a shared browser; B logs in → no trace of A's presets,
   notifications, or documents.
8. Database tab with 200+ rows → loads instantly, "Show more" works,
   search/filter/CSV cover all rows.
9. View PDF from Database for both Native and Google Doc rows.
10. Kill the network mid-save → a real error message appears (no fake success).

## Manual launch steps (recap)
- Supabase: run migrations 0001 → 0002 → 0003 (done), set Site/Redirect URLs,
  **consider Pro upgrade**.
- Apps Script: paste the latest script (plainMode email) + deploy new version.
- Optional but recommended: deploy the Resend edge function for email.
