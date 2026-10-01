# Sales automation setup

The CRM already creates a **quotation draft** when a lead becomes Qualified or Interested. Email sending and email-reply interpretation need the server configuration below. No key belongs in the browser, `.env.production`, Google Sheet, or Git.

## 1. Apply the database migration

From this project folder, link the existing Supabase project and apply the migration:

```powershell
npx supabase db push --linked
```

This adds the draft queue, reply inbox, reviewable AI suggestions, and workspace-level automation settings.

## 2. Configure the email sender

Create a Resend account, verify the sending domain, then set the server secrets. `RESEND_FROM` must be a verified sender. `REPLY_TO_ADDRESS` is the mailbox that receives customer replies.

```powershell
npx supabase secrets set RESEND_API_KEY="re_..."
npx supabase secrets set RESEND_FROM="Qyrova <quotes@your-domain.com>"
npx supabase secrets set REPLY_TO_ADDRESS="sales@your-domain.com"
npx supabase secrets set PUBLIC_APP_URL="https://qyrova.spandan305.workers.dev"
```

Deploy the function:

```powershell
npx supabase functions deploy sales-automation --no-verify-jwt
```

Open **Automation → Workflows → Sales automation → Settings** in Qyrova. Turn on automatic email only after sending one test quotation successfully.

## 3. Connect replies from your mailbox

Choose an email provider or forwarding service that can POST an incoming email to a webhook. Generate a random secret (at least 32 characters), save it only as a Supabase secret, and configure the relay to call:

```text
POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/sales-automation
x-qyrova-inbound-secret: YOUR_RANDOM_SECRET
content-type: application/json
```

Set the JSON body to this compact shape:

```json
{
  "action": "inbound_email",
  "from": "customer@example.com",
  "subject": "Re: [QYR-ABC123DEF4] Your quotation",
  "text": "Could you revise the price?",
  "messageId": "provider-message-id"
}
```

Set the secret first:

```powershell
npx supabase secrets set INBOUND_EMAIL_WEBHOOK_SECRET="a-long-random-secret"
```

Qyrova first matches the `QYR-…` reference in the reply. If that is missing, it matches the customer email address. Unmatched messages are rejected rather than accidentally attaching them to another customer.

## 4. Enable optional Claude reply suggestions

Claude is used only when deterministic rules cannot classify the reply (for example, clear price, change, meeting, or acceptance language does not call Claude). It receives at most 800 characters of the message, a compact 420-character customer context, and has a 180-token output limit. Suggestions are always reviewable in Qyrova before they change CRM records.

```powershell
npx supabase secrets set ANTHROPIC_API_KEY="your-new-rotated-key"
npx supabase secrets set ANTHROPIC_MODEL="claude-3-5-haiku-latest"
npx supabase functions deploy sales-automation --no-verify-jwt
```

In Qyrova, use **Automation → Workflows → Sales automation → Reply review** to apply or dismiss suggested actions. The app never sends a reply, deletes data, marks a deal won, or changes a quote solely because of AI output.
