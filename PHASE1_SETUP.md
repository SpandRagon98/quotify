# Qyrova — Phase 1: tracked quotes + branded email ($0)

Phase 1 productizes Qyrova: every quotation you email can now carry a **secure,
trackable link**. The recipient opens it (no login), sees a branded document, and
clicks **Approve / Decline / Negotiate** — and you see their **views and response**
back in the app. PDF stays client-side (no server cost).

Everything here is **free**. There is exactly **one required manual step** (run a
SQL file). Resend email is an **optional** upgrade you can add later.

---

## A. Required — enable tracked quotes (~2 min)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the whole of **`supabase/migrations/0002_tracked_quotes.sql`** from this
   repo and click **Run**. You should see "Success. No rows returned."

That's it. This adds the `tracked_quotes` + `quote_events` tables, the
member-only Row-Level Security, and three public capability functions
(`get_tracked_quote`, `record_quote_view`, `respond_to_quote`) that only work
when called with a valid, unguessable token.

### How to use it
- Go to **Email**, pick a record, **Compose email**.
- Leave **"Send as a tracked quote"** ticked (on by default in cloud mode).
- Optionally drop the **`{{Quote Link}}`** placeholder anywhere in the body; if you
  don't, the link is appended automatically.
- **Send.** The recipient's email contains a link like
  `https://your-app.workers.dev/q/ab12…`.
- Reopen the same record's email dialog any time to see **Viewed · N views** and
  the **Approve / Decline / Negotiate** outcome (plus any note they left).

Nothing else in the app changed — Save, Database, Doc View, native PDF, Google
Doc, roles, themes, notifications all behave exactly as before.

---

## B. Optional — branded email via Resend (free up to 3k/mo)

By default Qyrova keeps sending through the existing Google Apps Script path
(which already works). Resend is a cleaner, brandable sender you can switch on
**when you're ready** — it does **not** affect the live deployment until you
deploy it, so there's zero risk to what's working now.

> ⚠️ Resend will only send to **your own verified address** until you verify a
> sending **domain** (a DNS step that can take a little time). That's why this is
> optional and off by default — so nothing silently "fakes" a successful send.

### Steps
1. Create a free account at **resend.com** → **API Keys** → copy the key (`re_…`).
2. (To send to anyone) **Domains → Add domain** → add the DNS records it shows at
   your registrar → wait for "Verified".
3. Install the Supabase CLI and link your project, then deploy the function:
   ```bash
   supabase functions deploy send-quote-email --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_your_key
   supabase secrets set RESEND_FROM="Qyrova <quotes@yourdomain.com>"
   ```
   (Before a domain is verified, omit `RESEND_FROM` to use `onboarding@resend.dev`,
   which can only email your own account.)

The function code lives in **`supabase/functions/send-quote-email/index.ts`** and
the client wrapper in **`src/services/resendClient.js`** (`sendViaResend(...)`).

---

## What Phase 1 delivers

- ✅ **Tracked quotes** — shareable, no-login `/q/<token>` page; logs views; records
  Approve / Decline / Negotiate; owner sees status + view count. **$0, works now.**
- ✅ **Branded email** — the sent email carries the branded tracked link and CTAs.
- ✅ **PDF** — unchanged, still generated client-side. **$0.**
- ⚙️ **Resend** — wired and documented as an opt-in, isolated upgrade.

## Cost

| Piece | Service | Cost |
|---|---|---|
| Tracked quotes | Supabase (existing) | **$0** |
| Public quote pages | Cloudflare (existing) | **$0** |
| PDF | client-side | **$0** |
| Email (current) | Google Apps Script | **$0** |
| Email (optional) | Resend free tier | **$0** up to 3,000/mo |

**Total added cost: $0.**
