export const LEAD_STATUSES = [
  "New",
  "Attempted Contact",
  "Contacted",
  "Qualified",
  "Unqualified",
  "Converted",
  "Lost",
];
export const STAGES = [
  "Qualification",
  "Discovery",
  "Demo/Meeting",
  "Proposal/Quotation",
  "Negotiation",
  "Won",
  "Lost",
];
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
export const ACTIVITY_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
  "Overdue",
];
export const ACTIVITY_TYPES = [
  "Task",
  "Call",
  "Meeting",
  "Follow-up",
  "Email",
  "Note",
];
const field = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const owner = field("owner_id", "Owner", "owner", { required: true });
const tags = field("tags", "Tags (comma separated)", "tags");
const note = field("notes", "Internal notes", "textarea");
const location = [
  field("city", "City"),
  field("state", "State"),
  field("country", "Country"),
  field("pincode", "Pincode"),
];
const communication = [
  field("email", "Email", "email"),
  field("phone", "Phone", "tel"),
  field("alternate_phone", "Alternate phone", "tel"),
];
const account = field("account_id", "Account", "relation", {
  entity: "accounts",
  required: true,
});
const contact = field("contact_id", "Contact", "relation", {
  entity: "contacts",
  dependsOn: "account_id",
});
export const ENTITIES = {
  leads: {
    title: "Leads",
    singular: "Lead",
    label: "name",
    columns: [
      "name",
      "company_name",
      "owner_id",
      "status",
      "source",
      "estimated_value",
      "next_follow_up_at",
    ],
    fields: [
      field("name", "Lead name", "text", { required: true }),
      field("company_name", "Company name"),
      field("first_name", "First name"),
      field("last_name", "Last name"),
      ...communication,
      field("designation", "Designation"),
      owner,
      field("source", "Lead source", "text", { default: "Manual" }),
      field("status", "Status", "select", {
        options: LEAD_STATUSES,
        default: "New",
      }),
      field("stage", "Lead stage", "text", { default: "Enquiry" }),
      field("product", "Product / service"),
      field("estimated_value", "Estimated deal value (INR)", "number", {
        default: 0,
      }),
      field("priority", "Priority", "select", {
        options: PRIORITIES,
        default: "Normal",
      }),
      field("industry", "Industry"),
      ...location,
      field("website", "Website"),
      field("last_contacted_at", "Last contacted", "datetime-local"),
      field("next_follow_up_at", "Next follow-up", "datetime-local"),
      tags,
      note,
    ],
  },
  accounts: {
    title: "Accounts",
    singular: "Account",
    label: "name",
    columns: [
      "name",
      "owner_id",
      "account_type",
      "industry",
      "email",
      "phone",
      "city",
    ],
    fields: [
      field("name", "Account name", "text", { required: true }),
      owner,
      field("account_type", "Type", "select", {
        options: ["Prospect", "Customer", "Partner", "Other"],
        default: "Prospect",
      }),
      field("industry", "Industry"),
      field("website", "Website"),
      field("phone", "Main phone", "tel"),
      field("email", "Main email", "email"),
      field("gstin", "GSTIN"),
      field("pan", "PAN"),
      field("billing_address", "Billing address", "textarea"),
      field("shipping_address", "Shipping address", "textarea"),
      ...location,
      field("annual_revenue", "Annual revenue (INR)", "number"),
      tags,
      note,
    ],
  },
  contacts: {
    title: "Contacts",
    singular: "Contact",
    label: "first_name",
    columns: [
      "first_name",
      "last_name",
      "account_id",
      "designation",
      "email",
      "phone",
      "owner_id",
    ],
    fields: [
      account,
      field("first_name", "First name", "text", { required: true }),
      field("last_name", "Last name"),
      field("designation", "Designation"),
      field("department", "Department"),
      ...communication,
      field("is_primary", "Primary contact", "checkbox"),
      field("is_decision_maker", "Decision maker", "checkbox"),
      owner,
      tags,
      note,
    ],
  },
  opportunities: {
    title: "Opportunities",
    singular: "Opportunity",
    label: "name",
    columns: [
      "name",
      "account_id",
      "owner_id",
      "stage",
      "amount",
      "expected_close_date",
      "probability",
    ],
    fields: [
      field("name", "Opportunity name", "text", { required: true }),
      account,
      contact,
      owner,
      field("amount", "Deal value", "number", { default: 0 }),
      field("currency", "Currency", "select", {
        options: ["INR", "USD", "EUR", "GBP"],
        default: "INR",
      }),
      field("expected_close_date", "Expected close", "date"),
      field("stage", "Stage", "select", {
        options: STAGES,
        default: "Qualification",
      }),
      field("probability_override", "Override stage probability", "checkbox"),
      field("probability", "Probability (%)", "number", { default: 10 }),
      field("source", "Lead source", "text", { default: "Manual" }),
      field("product", "Product / service"),
      field("description", "Description", "textarea"),
      field("competitor", "Competitor"),
      field("next_step", "Next step"),
      field("lost_reason", "Lost reason", "textarea"),
      tags,
    ],
  },
  activities: {
    title: "Activities",
    singular: "Activity",
    label: "title",
    columns: [
      "title",
      "activity_type",
      "owner_id",
      "due_at",
      "status",
      "priority",
      "account_id",
    ],
    fields: [
      field("title", "Title", "text", { required: true }),
      field("activity_type", "Type", "select", {
        options: ACTIVITY_TYPES,
        default: "Task",
      }),
      owner,
      field("lead_id", "Related lead", "relation", { entity: "leads" }),
      field("account_id", "Related account", "relation", {
        entity: "accounts",
      }),
      contact,
      field("opportunity_id", "Related opportunity", "relation", {
        entity: "opportunities",
        dependsOn: "account_id",
      }),
      field("due_at", "Due date and time", "datetime-local"),
      field("reminder_at", "Reminder", "datetime-local"),
      field("status", "Status", "select", {
        options: ACTIVITY_STATUSES,
        default: "Pending",
      }),
      field("priority", "Priority", "select", {
        options: PRIORITIES,
        default: "Normal",
      }),
      field("description", "Description / note", "textarea"),
      field("outcome", "Outcome", "textarea"),
      tags,
    ],
  },
  inbox: {
    title: "Lead Inbox",
    singular: "Enquiry",
    label: "name",
    columns: [
      "name",
      "company_name",
      "source",
      "email",
      "phone",
      "owner_id",
      "status",
      "created_at",
    ],
    fields: [
      field("name", "Enquiry name", "text", { required: true }),
      field("company_name", "Company"),
      field("email", "Email", "email"),
      field("phone", "Phone", "tel"),
      owner,
      field("source", "Source", "text", { default: "Manual" }),
      field("source_identifier", "External identifier"),
      field("source_timestamp", "Source time", "datetime-local"),
    ],
  },
  quote_links: {
    title: "Quotations",
    singular: "Quotation",
    label: "quotation_id",
    columns: ["quotation_id", "preset_name", "amount", "status", "created_at"],
    fields: [],
  },
};
export const displayName = (entity, row) =>
  entity === "contacts"
    ? [row.first_name, row.last_name].filter(Boolean).join(" ")
    : row[ENTITIES[entity]?.label] || row.title || row.name || "Record";
export const money = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const labelFor = (key) =>
  key
    .replace(/_id$/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function activityStatus(row, now = Date.now()) {
  return !["Completed", "Cancelled"].includes(row.status) &&
    row.due_at &&
    new Date(row.due_at).getTime() < now
    ? "Overdue"
    : row.status;
}
export function formPayload(entity, values) {
  return Object.fromEntries(
    ENTITIES[entity].fields.map((f) => {
      let v = values[f.key];
      if (f.type === "tags")
        v = Array.isArray(v)
          ? v
          : String(v || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
      else if (f.type === "checkbox") v = Boolean(v);
      else if (f.type === "number")
        v = v === "" || v == null ? null : Number(v);
      else if (f.type === "datetime-local")
        v = v ? new Date(v).toISOString() : null;
      else if (v === "" || v == null) v = null;
      return [f.key, v];
    }),
  );
}
