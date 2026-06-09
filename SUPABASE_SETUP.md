# Qyrova — Phase 0: real accounts + multi-tenant cloud ($0)

This turns Qyrova from a localStorage demo into a real product with **secure
authentication** and a **multi-tenant database** where each account's data is
isolated and synced across devices — all on **free tiers**.

The app is **dual-mode**:

- **No keys set** → runs exactly as before (localStorage, offline, $0). Nothing breaks.
- **Keys set** → real Supabase auth + per-organization Postgres data with Row-Level Security.

Everything below is the **manual** part (creating cloud accounts, running SQL,
deploying) — those need your own logins and can't be done from code.

---

## A. Create the free Supabase backend (~10 min)

1. Go to **supabase.com** → sign up (free) → **New project**.
   - Pick a name, a strong **database password** (save it), and the region closest to you.
   - Plan: **Free**. (It pauses after ~1 week idle — fine for now; upgrade to Pro $25/mo before real customers.)
2. Wait for the project to finish provisioning.
3. **Run the schema:** left sidebar → **SQL Editor** → **New query** → open
   `supabase/migrations/0001_init.sql` from this repo, paste the whole file, click **Run**.
   You should see "Success. No rows returned." This creates the tables, the
   tenant-isolation security policies, and the trigger that gives each new
   account its own workspace.
4. **Get your keys:** left sidebar → **Project Settings → API**. Copy:
   - **Project URL**
   - **Project API keys → `anon` `public`** (the anon key is safe for the browser)
5. **Email confirmation (recommended ON):** **Authentication → Providers → Email**
   is enabled by default and requires users to confirm their email.
   - To test faster you may toggle **"Confirm email" OFF** temporarily, then turn it back on.
6. **Redirect URLs:** **Authentication → URL Configuration** → set **Site URL** to
   your app URL (e.g. `http://localhost:5173` for dev, and later your real domain).

---

## B. Run it locally with the cloud backend

1. In the project root, copy `.env.example` to **`.env`** and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
2. `npm install` (first time) then `npm run dev`.
3. Open the app → **Sign up** with a real email → confirm it (check inbox) → log in.
   - You now have a real account and a private workspace. Create a preset, then
     open the app in another browser/incognito and log in — your presets are there.
   - Leave `.env` blank anytime to fall back to local-only mode.

> `.env` is gitignored on purpose — never commit it. (The anon key is public-safe,
> but keeping env out of git is good hygiene; the **service_role** key must never
> be in the frontend.)

---

## C. Deploy free on Cloudflare Pages (~10 min)

Cloudflare Pages is free, allows commercial use, and has unlimited bandwidth.

1. Push this repo to GitHub (see below).
2. Go to **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git** →
   pick the repo.
3. **Build settings:**
   - Framework preset: **Vite**
   - Build command: **`npm run build`**
   - Build output directory: **`dist`**
4. **Environment variables** (Settings → Environment variables → Production **and** Preview):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. **Deploy.** You'll get a `*.pages.dev` URL.
6. Back in Supabase → **Authentication → URL Configuration** → add that URL (and
   later your custom domain) to **Site URL / Redirect URLs**.
7. SPA routing is handled natively by Cloudflare Workers Assets — no `_redirects` file needed.

(Netlify works the same way: build `npm run build`, publish `dist`, add the two env vars.)

---

## What you get after Phase 0

- ✅ **Real authentication** (Supabase): hashed passwords, sessions, email
  verification, password reset — replaces the insecure demo login.
- ✅ **Multi-tenant data isolation**: every account gets a private organization;
  Row-Level Security guarantees one account can never read another's data.
- ✅ **Cloud sync** of presets, company/document config, and email templates across devices.
- ✅ **$0** to build and run; upgrade only when you have real users.

## Intentionally still local (next increments)

- **Theme/accent + notifications** stay per-device (UI preferences) — by design.
- **Quotation rows** still live in each preset's Google Sheet (Apps Script) — moving
  the system-of-record into Postgres is **Phase 1**.
- **Team invites + server-enforced per-role permissions** (editor/admin/doc-viewer) —
  the DB schema (`org_members`, roles, policies) already supports this; wiring the
  invite flow + role policies is the immediate next step. Today each account is the
  **owner** of its own workspace (perfect for freelancers).

## Security note

Once cloud mode is on, the hardcoded demo owner (`appConfig.js`) and the djb2
"hash" are **not used** — they only apply to local fallback mode. Before going
fully live, remove the demo owner constants and keep `.env`-driven config.
