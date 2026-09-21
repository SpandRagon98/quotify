export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/;
const skipValues = new Set(["skip", "none", "n/a", "na", "-", "छोड़ें"]);

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function clean(value: unknown, maximum = 500) {
  return String(value ?? "").trim().slice(0, maximum);
}

export function validWebhookSecret(value: string) {
  return /^[A-Za-z0-9_-]{24,256}$/.test(value);
}

export function secretsMatch(left: string | null, right: string) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function telegramCommand(text: string) {
  return clean(text, 120).split(/\s+/)[0]?.split("@")[0]?.toLowerCase() || "";
}

export function displayName(user: Record<string, unknown> | undefined) {
  return clean(
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.username ||
      "Telegram enquiry",
    160,
  );
}

export function parseContact(message: Record<string, any>) {
  const text = clean(message.text, 320);
  return {
    email: clean(text.match(emailPattern)?.[0], 320),
    phone: clean(message.contact?.phone_number || text.match(phonePattern)?.[0], 80),
  };
}

export function isSkip(value: string) {
  return skipValues.has(clean(value, 30).toLowerCase());
}

export function reply(chatId: string | number, text: string, extra: Record<string, unknown> = {}) {
  return {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  };
}

export async function telegramApi(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(clean(data.description, 300) || `Telegram ${method} failed.`);
  }
  return data.result;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
