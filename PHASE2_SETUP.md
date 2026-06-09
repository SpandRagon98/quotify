# Qyrova — Phase 2: branded transactional email + tokenized CTAs ($0)

Phase 2 replaces the "via gmail.com" send with **branded email from your own
domain** through **Resend**, and turns the Approve / Decline / Negotiate buttons
into **secure, tokenized links to your own backend** (Supabase) instead of the
open Apps Script endpoint. This is where quoting tools win or lose: **inbox
deliverability** and **trustworthy response links**.

Everything is **$0** under 3,000 emails/month. You only pay for a domain
(~$10/yr — you need one anyway). Until you add a domain you can still test for
free to your **own** address using Resend's sandbox sender.

> Nothing breaks while you set this up. The default send path stays Gmail/Apps
> Script until you flip `VITE_EMAIL_PROVIDER=resend`, and you can pick **Resend**
> or **Gmail** per‑send in the Email composer. Errors are shown for real — the app
> never fakes a successful send.

---

## What changed in the app

- **Email composer → "Send with: Resend (branded) / Gmail".** In cloud mode you
  choose the path. Resend builds a branded HTML email (your logo + message + a
  PDF attachment if selected) and **always** creates a tracked quote.
- **Tokenized CTAs.** The email's Approve / Negotiate / Decline buttons link to
  `…/q/<token>?intent=…` — your own page. Only the recipient's unguessable token
  works, and the page requires an explicit **Confirm** click, so mail‑client link
  prefetching can never trigger a false response. No Apps Script involved.

---

## A. Required for Phase 2 — Resend + the Edge Function

> Prerequisite: Phase 0 (Supabase) and Phase 1 SQL (`0002_tracked_quotes.sql`)
> are already done.

1. **Resend account** — sign up free at **resend.com** → **API Keys** → create one
   (`re_…`) and copy it.

2. **Verify your domain** (for sending to real recipients) — **Domains → Add
   domain**, then add the **SPF / DKIM / DMARC** DNS records it shows at your
   registrar. Wait until it reads **Verified**. (Skip this to test only to your
   own address with the sandbox sender.)

3. **Deploy the Edge Function** (needs the Supabase CLI, `npm i -g supabase`):
   ```bash
   supabase login
   supabase link --project-ref pczyjzkcmssxgqmzrona
   supabase functions deploy send-quote-email --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_your_key
   supabase secrets set RESEND_FROM="Qyrova <quotes@yourdomain.com>"
   ```
   Before your domain is verified, omit `RESEND_FROM` — it defaults to
   `onboarding@resend.dev`, which can only email **your own** Resend account.

4. **Make Resend the default (optional).** Add to `.env.production` (and the
   Cloudflare project) then redeploy:
   ```
   VITE_EMAIL_PROVIDER=resend
   ```
   Even without this, you can choose **Resend** per‑send in the composer.

---

## B. Test it

1. Open the app → **Email** → pick a record → **Compose**.
2. **Send with → Resend (branded)**, optionally keep **Native PDF**.
3. **Send.** You'll see a real success id, or a real Resend error (e.g. "domain
   not verified") — never a fake "sent".
4. Open the email → click **Approve** → you land on `/q/<token>` with the action
   pre‑selected → click **Confirm**. Back in the app, the record shows
   **Approved · N views**.

---

## Why this matters (deliverability)

| | Before (Gmail/Apps Script) | After (Resend + your domain) |
|---|---|---|
| Sender | personal Gmail, "via gmail.com" | `quotes@yourdomain.com` |
| Auth | none | SPF + DKIM + DMARC |
| Inbox vs spam | spam risk | trusted, lands in inbox |
| Daily cap | ~100–1,500 | 3,000/mo free, 50k for $20/mo |
| Response links | open Apps Script endpoint | tokenized links to your backend |

## Cost

| Piece | Cost |
|---|---|
| Resend (≤ 3,000 emails/mo) | **$0** |
| Resend (50,000/mo) | $20/mo |
| Domain | ~$10/yr |
| Supabase Edge Function | **$0** (free tier) |
| Everything else | **$0** |

**Added cost to ship Phase 2 now: $0** (domain only when you're ready to mail real clients).
