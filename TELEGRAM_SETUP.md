# Qyrova Telegram lead bot

Telegram enquiries enter Qyrova's **Lead Inbox**. They are not silently
converted into CRM leads: your team can review, de-duplicate, assign, and accept
each enquiry through the existing Lead Inbox workflow.

## One-time setup

1. Open Telegram and message `@BotFather`. Run `/newbot`, complete its naming
   prompts, and copy the bot token it gives you.
2. In the Qyrova repository, run the SQL in
   `supabase/migrations/0010_telegram_lead_inbox.sql` using **Supabase → SQL
   Editor**. This adds safe connection metadata and short-lived bot sessions.
3. Install and sign in to the Supabase CLI, then link the existing project:

   ```bash
   supabase login
   supabase link --project-ref pczyjzkcmssxgqmzrona
   ```

4. Generate a separate webhook secret containing 24–256 letters, numbers,
   underscores, or hyphens. It is not the bot token. Set both server secrets:

   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token
   supabase secrets set TELEGRAM_WEBHOOK_SECRET=your_random_webhook_secret
   ```

5. Deploy the two functions. The webhook must be public so Telegram can call
   it; it authenticates every request with the webhook secret.

   ```bash
   supabase functions deploy telegram-setup
   supabase functions deploy telegram-webhook --no-verify-jwt
   ```

6. Open [Qyrova](https://qyrova.spandan305.workers.dev/), sign in as a workspace
   owner or admin, open **Lead Inbox**, and select **Connect Telegram**.
7. Open the bot, send `/start`, and complete the four prompts: name, company,
   contact detail, and requirement. The result appears in **Lead Inbox** with
   source **Telegram**.

## Security and behavior

- The bot token and webhook secret are stored only as Supabase Edge Function
  secrets; never place either in a Vite/Cloudflare browser variable or commit it.
- One Qyrova deployment currently connects one Telegram bot to one selected
  workspace. Reconnecting as an owner/admin moves the bot to that workspace.
- Telegram retries and duplicate update deliveries are ignored. A completed
  enquiry has a unique Telegram source identifier.
- `/lead` starts a new enquiry, `/cancel` clears the current one, and `/help`
  explains the available commands.
