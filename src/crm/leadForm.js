import { ENTITIES } from "./schema";

const fieldByKey = Object.fromEntries(
  ENTITIES.leads.fields.map((item) => [item.key, item]),
);

const EXCLUDED_STANDARD_FIELDS = new Set([
  "name",
  "company_name",
  "owner_id",
  "source",
  "status",
  "stage",
]);

export const FIXED_LEAD_FIELDS = [
  { key: "name", label: "Name", type: "text", required: true, kind: "standard" },
  {
    key: "company_name",
    label: "Company",
    type: "text",
    required: true,
    kind: "standard",
  },
];

export const OPTIONAL_STANDARD_LEAD_FIELDS = ENTITIES.leads.fields
  .filter((item) => !EXCLUDED_STANDARD_FIELDS.has(item.key))
  .map((item) => ({
    key: item.key,
    label: item.label,
    type: item.type === "tags" ? "text" : item.type,
    options: item.options || [],
    kind: "standard",
  }));

const defaultKeys = ["email", "phone", "designation", "product", "priority", "notes"];

export const defaultLeadFormFields = () =>
  OPTIONAL_STANDARD_LEAD_FIELDS.filter((item) => defaultKeys.includes(item.key)).map(
    (item) => ({ ...item, id: `standard:${item.key}`, required: false }),
  );

const customKey = () =>
  `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const newCustomLeadField = () => ({
  id: customKey(),
  key: customKey(),
  label: "New field",
  type: "text",
  options: [],
  required: false,
  kind: "custom",
});

export function normalizeLeadFormFields(value) {
  const source = Array.isArray(value) ? value : defaultLeadFormFields();
  const standardKeys = new Set();
  const customKeys = new Set();
  const labels = new Set();
  return source.map((item, index) => {
    const standard = fieldByKey[item?.key];
    const kind = standard && !EXCLUDED_STANDARD_FIELDS.has(standard.key)
      ? "standard"
      : "custom";
    const label = String(item?.label || standard?.label || "New field").trim();
    const id = String(item?.id || `${kind}:${item?.key || index}`);
    const key = kind === "standard" ? standard.key : String(item?.key || customKey());
    const duplicateKey = kind === "standard" ? standardKeys : customKeys;
    const fieldLabel = label || "New field";
    const labelKey = fieldLabel.toLowerCase();
    if (duplicateKey.has(key) || labels.has(labelKey)) return null;
    duplicateKey.add(key);
    labels.add(labelKey);
    const type = kind === "standard" ? (standard.type === "tags" ? "text" : standard.type) : item?.type;
    return {
      id,
      key,
      kind,
      label: fieldLabel,
      type: ["text", "email", "tel", "number", "date", "datetime-local", "textarea", "select"].includes(type)
        ? type
        : "text",
      options: Array.isArray(item?.options)
        ? item.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 30)
        : [],
      required: Boolean(item?.required),
    };
  }).filter(Boolean);
}

export function leadFormFields(config) {
  return [...FIXED_LEAD_FIELDS, ...normalizeLeadFormFields(config)];
}

export function leadValue(value, field) {
  if (value === "" || value == null) return null;
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${field.label} must be a number.`);
    return number;
  }
  if (field.type === "datetime-local") return new Date(value).toISOString();
  return String(value).trim();
}

export function leadPayload(values, config, { preserveEmpty = false } = {}) {
  const standard = {};
  const custom = {};
  for (const field of leadFormFields(config)) {
    const value = leadValue(values[field.key], field);
    if (value == null && !preserveEmpty) continue;
    if (field.kind === "custom") custom[field.key] = value;
    else standard[field.key] = value;
  }
  return { ...standard, custom_fields: custom };
}

export function validateLeadFormConfig(config) {
  const fields = normalizeLeadFormFields(config);
  if (fields.length !== config.length)
    throw new Error("Each field needs a unique label and can be included only once.");
  for (const field of fields) {
    if (!field.label || field.label.length > 80)
      throw new Error("Each field label must be between 1 and 80 characters.");
    if (field.kind === "custom" && !/^custom_[a-z0-9_]+$/i.test(field.key))
      throw new Error("A custom field has an invalid internal name. Remove and add it again.");
    if (field.type === "select" && field.options.length === 0)
      throw new Error(`${field.label} needs at least one dropdown option.`);
  }
  return fields;
}
