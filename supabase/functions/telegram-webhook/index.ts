import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clean,
  displayName,
  escapeHtml,
  isSkip,
  json,
  parseContact,
  reply,
  secretsMatch,
  telegramApi,
  telegramCommand,
  validWebhookSecret,
} from "../_shared/telegram.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

type TelegramMessage = {
  message_id: number;
  date?: number;
  text?: string;
  chat: { id: number | string; type?: string };
  from?: Record<string, unknown>;
  contact?: { phone_number?: string };
};

function configured() {
  return Boolean(
    supabaseUrl &&
      serviceRoleKey &&
      botToken &&
      validWebhookSecret(webhookSecret),
  );
}

function service() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function saveSession(
  db: ReturnType<typeof service>,
  chatId: string,
  orgId: string,
  step: string,
  draft: Record<string, string>,
) {
  const { error } = await db.from("crm_telegram_sessions").upsert(
    {
      chat_id: chatId,
      org_id: orgId,
      step,
      draft,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" },
  );
  if (error) throw error;
}

async function beginEnquiry(
  db: ReturnType<typeof service>,
  chatId: string,
  orgId: string,
) {
  await saveSession(db, chatId, orgId, "name", {});
  return reply(
    chatId,
    "👋 <b>Welcome to Qyrova.</b>\n\nI’ll collect four short details and send your enquiry to our sales team.\n\nWhat is your full name?",
    { reply_markup: { remove_keyboard: true } },
  );
}

async function finalizeEnquiry(
  db: ReturnType<typeof service>,
  orgId: string,
  chatId: string,
  message: TelegramMessage,
  draft: Record<string, string>,
) {
  const { data: organization, error: organizationError } = await db
    .from("organizations")
    .select("owner_id")
    .eq("id", orgId)
    .single();
  if (organizationError || !organization) {
    throw organizationError || new Error("The Qyrova workspace is unavailable.");
  }
  const fullName = clean(draft.fullName || displayName(message.from), 160);
  const names = fullName.split(/\s+/).filter(Boolean);
  const username = clean(message.from?.username, 80);
  const requirement = clean(draft.requirement, 2_000);
  const sourceIdentifier = `telegram:${chatId}:${message.message_id}`;
  const sourceTime = message.date
    ? new Date(message.date * 1_000).toISOString()
    : new Date().toISOString();
  const rawPayload = {
    telegram_chat_id: chatId,
    telegram_message_id: message.message_id,
    telegram_username: username || null,
    telegram_profile_url: username ? `https://t.me/${username}` : null,
    submitted_at: sourceTime,
  };
  const mappedFields = {
    first_name: names[0] || fullName,
    last_name: names.slice(1).join(" ") || null,
    email: clean(draft.email, 320) || null,
    phone: clean(draft.phone, 80) || null,
    notes: requirement,
    telegram_chat_id: chatId,
    telegram_username: username || null,
  };
  const { error: insertError } = await db.from("crm_inbox").insert({
    org_id: orgId,
    owner_id: organization.owner_id,
    source: "Telegram",
    source_identifier: sourceIdentifier,
    source_timestamp: sourceTime,
    raw_payload: rawPayload,
    mapped_fields: mappedFields,
    name: fullName,
    company_name: clean(draft.businessName, 160) || null,
    email: mappedFields.email,
    phone: mappedFields.phone,
  });
  // A retried Telegram update is safe: the source identifier uniquely identifies
  // its completed conversation message. Either way, clear the finished session.
  if (insertError && insertError.code !== "23505") throw insertError;
  const { error: clearError } = await db
    .from("crm_telegram_sessions")
    .delete()
    .eq("chat_id", chatId);
  if (clearError) throw clearError;
  return reply(
    chatId,
    "✅ Your enquiry has been sent to Qyrova’s Lead Inbox. Our team can now review and follow up.\n\nSend /lead whenever you want to submit another enquiry.",
    { reply_markup: { remove_keyboard: true } },
  );
}

async function processMessage(
  db: ReturnType<typeof service>,
  orgId: string,
  message: TelegramMessage,
) {
  const chatId = String(message.chat.id);
  const text = clean(message.text, 2_000);
  const command = telegramCommand(text);
  if (command === "/start" || command === "/lead") {
    return beginEnquiry(db, chatId, orgId);
  }
  if (command === "/cancel") {
    const { error } = await db
      .from("crm_telegram_sessions")
      .delete()
      .eq("chat_id", chatId);
    if (error) throw error;
    return reply(
      chatId,
      "The enquiry was cancelled. Send /lead whenever you want to begin again.",
      { reply_markup: { remove_keyboard: true } },
    );
  }
  if (command === "/help") {
    return reply(
      chatId,
      "Use /lead to send an enquiry to Qyrova, or /cancel to stop the current enquiry.",
    );
  }

  const { data: session, error: sessionError } = await db
    .from("crm_telegram_sessions")
    .select("step,draft")
    .eq("chat_id", chatId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) {
    return reply(chatId, "Send /lead to share an enquiry with the Qyrova sales team.");
  }
  const draft =
    session.draft && typeof session.draft === "object" ? session.draft : {};

  if (session.step === "name") {
    const fullName = clean(text || displayName(message.from), 160);
    if (!fullName) return reply(chatId, "Please enter your full name.");
    await saveSession(db, chatId, orgId, "business", { ...draft, fullName });
    return reply(
      chatId,
      `Thanks, <b>${escapeHtml(fullName)}</b>. What is your company or business name?`,
      {
        reply_markup: {
          keyboard: [["Skip"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
  }
  if (session.step === "business") {
    await saveSession(db, chatId, orgId, "contact", {
      ...draft,
      businessName: isSkip(text) ? "" : text,
    });
    return reply(
      chatId,
      "What is the best email address or phone number for a follow-up? You can also share your Telegram phone number or choose Skip.",
      {
        reply_markup: {
          keyboard: [[{ text: "Share phone number", request_contact: true }], ["Skip"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
  }
  if (session.step === "contact") {
    const contact = parseContact(message);
    if (!contact.email && !contact.phone && !isSkip(text)) {
      return reply(
        chatId,
        "Please enter a valid email or phone number, share your Telegram phone number, or choose Skip.",
      );
    }
    await saveSession(db, chatId, orgId, "requirement", {
      ...draft,
      email: contact.email,
      phone: contact.phone,
    });
    return reply(
      chatId,
      "Finally, briefly describe what you need help with.",
      { reply_markup: { remove_keyboard: true } },
    );
  }

  const requirement = clean(text, 2_000);
  if (!requirement) return reply(chatId, "Please describe your requirement in a message.");
  return finalizeEnquiry(db, orgId, chatId, message, {
    ...draft,
    requirement,
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!configured()) return json({ error: "Telegram is not configured." }, 503);
  if (
    !secretsMatch(
      request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
      webhookSecret,
    )
  ) {
    return json({ error: "Invalid Telegram webhook secret." }, 401);
  }

  let updateId: number | null = null;
  const db = service();
  try {
    const update = await request.json();
    updateId = Number(update?.update_id);
    if (!Number.isSafeInteger(updateId)) return json({ ok: true, ignored: true });

    await db
      .from("crm_telegram_updates")
      .delete()
      .lt("processed_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
    const { error: updateError } = await db
      .from("crm_telegram_updates")
      .insert({ update_id: updateId });
    if (updateError?.code === "23505") return json({ ok: true, duplicate: true });
    if (updateError) throw updateError;

    const message = update.message as TelegramMessage | undefined;
    if (!message?.chat?.id || message.chat.type !== "private") {
      return json({ ok: true, ignored: true });
    }
    const { data: integration, error: integrationError } = await db
      .from("crm_telegram_integration")
      .select("org_id")
      .eq("singleton", true)
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration?.org_id) {
      return json({ ok: true, ignored: true, reason: "No Qyrova workspace is connected." });
    }

    const response = await processMessage(db, integration.org_id, message);
    try {
      await telegramApi(botToken, "sendMessage", response);
    } catch (error) {
      console.error("Telegram reply failed", error);
    }
    return json({ ok: true });
  } catch (error) {
    if (updateId !== null) {
      await db
        .from("crm_telegram_updates")
        .delete()
        .eq("update_id", updateId)
        .then(() => undefined);
    }
    console.error("Telegram webhook failed", error);
    return json({ error: "Telegram webhook failed." }, 500);
  }
});
