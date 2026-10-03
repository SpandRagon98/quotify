// The product's rules are pure, explainable and provider independent.
// Database stage names remain intact so historical reports and integrations survive.
export const JOURNEY = [
  ["Qualification", "New Enquiry"],
  ["Discovery", "Talking"],
  ["Demo/Meeting", "Requirement"],
  ["Proposal/Quotation", "Quote Sent"],
  ["Negotiation", "Decision"],
  ["Won", "Won"],
  ["Lost", "Lost"],
];
export const stageLabel = (stage) =>
  JOURNEY.find(([key]) => key === stage)?.[1] || stage || "New Enquiry";
export const relativeDate = (date) => {
  if (!date) return "No activity yet";
  const days = Math.floor((Date.now() - Date.parse(date)) / 86400000);
  return days < 1 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};
const daysSince = (date, now) =>
  date ? Math.max(0, (now - Date.parse(date)) / 86400000) : 0;
export function pulse(facts = {}, now = Date.now(), rules = {}) {
  const attention = Number(rules.quote_attention_days ?? 3);
  const risk = Number(rules.quote_risk_days ?? 7);
  const closed = ["Won", "Lost"].includes(facts.stage);
  const replied =
    facts.reply_at &&
    (!facts.quote_sent_at ||
      Date.parse(facts.reply_at) >= Date.parse(facts.quote_sent_at));
  const quoteAge = daysSince(facts.quote_sent_at, now);
  const awaiting =
    !!facts.quote_sent_at &&
    !replied &&
    !["Accepted", "Declined", "approved", "declined"].includes(
      facts.quote_status,
    );
  let level = "On Track",
    reason = "There is a clear next step with this customer.",
    action = "Log call",
    type = "Call";
  if (closed)
    return {
      level,
      reason:
        facts.stage === "Won"
          ? "The deal is won. Keep delivery moving."
          : "This deal is closed. The reason is saved for your reports.",
      action: facts.stage === "Won" ? "Create invoice" : "Review history",
      type: facts.stage === "Won" ? "Invoice" : "History",
      awaiting: false,
      quoteAge,
    };
  if (facts.overdue_count > 0) {
    level = "At Risk";
    reason = `${facts.overdue_count} overdue follow-up${facts.overdue_count === 1 ? "" : "s"} need attention.`;
    action = "Resolve overdue task";
    type = "Task";
  } else if (
    awaiting &&
    facts.quote_expires_at &&
    Date.parse(facts.quote_expires_at) <= now + 172800000
  ) {
    level = "At Risk";
    reason =
      Date.parse(facts.quote_expires_at) < now
        ? "The quotation expired without a recorded decision."
        : "The quotation expires within two days.";
    action = "Follow up today";
    type = "Follow-up";
  } else if (awaiting && quoteAge > risk) {
    level = "At Risk";
    reason = `Quotation sent ${Math.floor(quoteAge)} days ago. No response recorded.`;
    action = "Follow up today";
    type = "Follow-up";
  } else if (awaiting && quoteAge > attention) {
    level = "Needs Attention";
    reason = `No reply for ${Math.floor(quoteAge)} days since the quotation was sent.`;
    action = "Follow up today";
    type = "Follow-up";
  } else if (replied && daysSince(facts.reply_at, now) < 3) {
    reason = "The customer responded recently. Continue the conversation.";
    action = "Respond to customer";
    type = "Follow-up";
  } else if (facts.meeting_at && !facts.next_due_at) {
    level = "Needs Attention";
    reason = "A meeting was completed, but no next step is scheduled.";
    action = "Add next step";
    type = "Task";
  } else if (
    (!facts.stage || facts.stage === "Qualification") &&
    !facts.last_contacted_at &&
    daysSince(facts.created_at, now) >
      Number(rules.enquiry_attention_hours ?? 24) / 24
  ) {
    level = "Needs Attention";
    reason = "This enquiry has not been contacted yet.";
    action = "Contact customer";
    type = "Call";
  } else if (
    ["Demo/Meeting", "Discovery"].includes(facts.stage) &&
    !facts.quote_sent_at
  ) {
    reason = "Confirm the requirement, then share your quotation.";
    action = "Create quotation";
    type = "Quotation";
  } else if (!facts.next_due_at) {
    level = "Needs Attention";
    reason = "There is no next action scheduled.";
    action = "Add next step";
    type = "Task";
  } else {
    reason = `${facts.next_title || "Your next action"} is scheduled.`;
    action = facts.next_title || "Open next task";
    type = "Task";
  }
  return {
    level,
    reason,
    action,
    type,
    awaiting,
    quoteAge,
    recommendedAt: facts.next_due_at || new Date(now).toISOString(),
  };
}
export const pulseRank = (result) =>
  result.level === "At Risk" ? 2 : result.level === "Needs Attention" ? 1 : 0;
export function taskRank(task, facts = {}, now = Date.now()) {
  if (["Completed", "Cancelled"].includes(task.status)) return -1;
  const due = task.due_at ? Date.parse(task.due_at) : Infinity;
  return (
    (due < now
      ? 100 + Math.min(30, (now - due) / 86400000)
      : due < now + 86400000
        ? 50
        : 0) +
    ({ Urgent: 35, High: 20, Normal: 5 }[task.priority] || 0) +
    Math.min(20, Number(facts.amount || 0) / 50000) +
    pulseRank(pulse(facts, now)) * 15
  );
}
export function parseSearch(input, now = new Date()) {
  const text = input.trim();
  const lower = text.toLowerCase();
  let entity = null,
    query = text,
    filters = {};
  if (/deals?|pipeline|opportunit/.test(lower)) entity = "opportunities";
  else if (/quotes?|quotations?|invoices?|proposals?/.test(lower))
    entity = "quote_links";
  else if (/tasks?|follow.?ups?|due today/.test(lower)) entity = "activities";
  else if (/customers?|companies|contacted/.test(lower)) entity = "accounts";
  const amount = lower.match(
    /(?:over|above|greater than|more than|under|below)\s*(?:₹|rs\.?\s*)?([\d,.]+)\s*(lakh|lac|crore|million|k|l)?/,
  );
  if (amount) {
    const multiplier =
      {
        lakh: 100000,
        lac: 100000,
        crore: 10000000,
        million: 1000000,
        k: 1000,
        l: 100000,
      }[amount[2]] || 1;
    filters[/under|below/.test(amount[0]) ? "max_value" : "min_value"] =
      Number(amount[1].replaceAll(",", "")) * multiplier;
  }
  if (/at risk|attention|stale/.test(lower)) {
    entity ||= "opportunities";
    filters.pulse = /at risk/.test(lower) ? "At Risk" : "Needs Attention";
  }
  if (/waiting|awaiting|no reply/.test(lower)) {
    entity ||= "quote_links";
    filters.awaiting = true;
  }
  if (/haven.t contacted|not contacted|inactive/.test(lower)) {
    entity ||= "accounts";
    filters.inactive_days = Number(lower.match(/(\d+)\s*days?/)?.[1] || 7);
  }
  if (/today/.test(lower) && entity === "activities")
    filters.activity_view = "Today";
  for (const type of ["Invoice", "Proposal", "Quotation"])
    if (lower.includes(type.toLowerCase())) filters.document_kind = type;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const month = months.findIndex((name) => lower.includes(name));
  if (month !== -1) {
    const year = Number(lower.match(/\b20\d{2}\b/)?.[0] || now.getFullYear());
    filters.created_from = new Date(year, month, 1).toISOString();
    filters.created_before = new Date(year, month + 1, 1).toISOString();
  }
  const summary = /what happened|history|summary/.test(lower);
  if (summary) query = text.replace(/^.*?(?:with|for|about)\s+/i, "");
  else if (/phone number|email address/.test(lower))
    query = text
      .replace(/what is|what's|phone number|email address|'s|\?/gi, "")
      .trim();
  else if (
    entity &&
    (Object.keys(filters).length || /^(show|find|which|who|list)/.test(lower))
  )
    query = "";
  return { entity, query, filters, summary };
}
let intelligenceProvider = null;
export function configureIntelligence(provider) {
  intelligenceProvider = provider;
}
export async function extractCapture(text) {
  if (intelligenceProvider?.extract)
    return intelligenceProvider.extract(text.slice(0, 2000));
  const name =
    text.match(
      /(?:this is|i am|i'm|name\s*[:=])\s+([\p{L}]+(?:\s+[\p{L}]+)?)(?=\s+(?:from|at|and)|[.,]|$)/iu,
    )?.[1] || "";
  const company =
    text.match(
      /(?:from|company\s*[:=])\s+([^.,\n]+?)(?=[.,\n]|\s+(?:we|i)\s|$)/i,
    )?.[1] || "";
  const value = text.match(
    /(?:₹|rs\.?|budget(?: approximately| around| of)?|value\s*:?)\s*([\d,.]+)\s*(lakh|lac|crore|k|million)?/i,
  );
  const amount = value
    ? Number(value[1].replaceAll(",", "")) *
      ({
        lakh: 100000,
        lac: 100000,
        crore: 10000000,
        k: 1000,
        million: 1000000,
      }[value[2]?.toLowerCase()] || 1)
    : 0;
  return {
    name,
    company_name: company.trim(),
    email: text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "",
    phone: text.match(/(?:\+91[ -]?)?\b[6-9]\d{9}\b/)?.[0] || "",
    product:
      text.match(
        /(?:need|looking for|require)\s+([^.!?]+?)(?=\s+for\s+(?:around|about|\d)|[.!?]|$)/i,
      )?.[1] || "",
    estimated_value: amount,
    timeline:
      text.match(/\b\d+\s*(?:days?|weeks?|months?|years?)\b/i)?.[0] || "",
    next_action: /meet|call|discuss/i.test(text)
      ? "Schedule meeting"
      : "Contact customer",
    notes: text.slice(0, 4000),
  };
}
export function followUpText(name, tone = "default") {
  const first = (name || "there").split(" ")[0];
  const bodies = {
    default: `Hi ${first},\n\nJust following up on the quotation shared earlier. Please let me know if you would like to discuss any changes.\n\nBest regards`,
    shorter: `Hi ${first}, any thoughts on the quotation? Happy to discuss changes.\n\nBest regards`,
    warmer: `Hi ${first},\n\nHope you're having a good week! I wanted to check in on the quotation. I'd be happy to walk you through it or help with any changes.\n\nBest regards`,
    formal: `Dear ${first},\n\nI am writing to follow up on our quotation. Please let us know if you require further information or revisions. We look forward to your response.\n\nKind regards`,
  };
  return bodies[tone] || bodies.default;
}
