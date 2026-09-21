import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  cors,
  json,
  telegramApi,
  validWebhookSecret,
} from "../_shared/telegram.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const webhookUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-webhook`;

function configured() {
  return Boolean(
    supabaseUrl &&
      anonKey &&
      serviceRoleKey &&
      botToken &&
      validWebhookSecret(webhookSecret),
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!configured()) {
    return json(
      {
        error:
          "Telegram is not configured. Add TELEGRAM_BOT_TOKEN and a valid TELEGRAM_WEBHOOK_SECRET in Supabase Edge Function secrets.",
      },
      503,
    );
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in to connect Telegram." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Your Qyrova session has expired." }, 401);

    const { orgId } = await request.json();
    if (typeof orgId !== "string" || !orgId) {
      return json({ error: "A Qyrova workspace is required." }, 400);
    }
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: membership, error: membershipError } = await service
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return json({ error: "Only a workspace owner or admin can connect Telegram." }, 403);
    }

    const bot = await telegramApi(botToken, "getMe", {});
    const configuredAt = new Date().toISOString();
    const { error: saveError } = await service
      .from("crm_telegram_integration")
      .upsert(
        {
          singleton: true,
          org_id: orgId,
          bot_username: bot.username || "",
          webhook_url: webhookUrl,
          connected_at: null,
          last_error: "",
          updated_at: configuredAt,
        },
        { onConflict: "singleton" },
      );
    if (saveError) throw saveError;

    await telegramApi(botToken, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
    const info = await telegramApi(botToken, "getWebhookInfo", {});
    const connected = info.url === webhookUrl;
    const { error: statusError } = await service
      .from("crm_telegram_integration")
      .update({
        bot_username: bot.username || "",
        webhook_url: connected ? webhookUrl : "",
        connected_at: connected ? new Date().toISOString() : null,
        last_error: info.last_error_message || "",
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true);
    if (statusError) throw statusError;

    return json({
      connected,
      botUsername: bot.username || "",
      botUrl: bot.username ? `https://t.me/${bot.username}` : "",
      webhookUrl,
      pendingUpdates: Number(info.pending_update_count || 0),
      lastError: info.last_error_message || "",
    });
  } catch (error) {
    return json({ error: String((error as Error).message || error) }, 500);
  }
});
