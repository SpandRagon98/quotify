/**
 * Field type metadata + value formatting helpers.
 * Single source of truth for which field types exist and how they behave.
 */

export const FIELD_TYPES = [
  { value: "text", label: "Text", icon: "Type", hasOptions: false },
  { value: "number", label: "Number", icon: "Hash", hasOptions: false },
  { value: "boolean", label: "Yes / No", icon: "ToggleLeft", hasOptions: false },
  { value: "date", label: "Date", icon: "Calendar", hasOptions: false },
  { value: "dropdown", label: "Dropdown", icon: "List", hasOptions: true },
  { value: "longtext", label: "Long Text", icon: "AlignLeft", hasOptions: false },
  { value: "email", label: "Email", icon: "Mail", hasOptions: false },
  { value: "phone", label: "Phone", icon: "Phone", hasOptions: false },
];

/** Text input sub-modes (only relevant for the "text" type). */
export const TEXT_MODES = [
  { value: "any", label: "Any characters" },
  { value: "letters", label: "Letters only" },
  { value: "alphanumeric", label: "Letters & numbers" },
];

export function fieldTypeLabel(type) {
  return FIELD_TYPES.find((t) => t.value === type)?.label || type;
}

export function fieldTypeHasOptions(type) {
  return Boolean(FIELD_TYPES.find((t) => t.value === type)?.hasOptions);
}

/** Sensible empty value for a field type, used when initialising a form. */
export function emptyValueForField(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== "") {
    return field.defaultValue;
  }
  switch (field.type) {
    case "boolean":
      return false;
    default:
      return "";
  }
}

/** Format a stored value for display in previews / summaries. */
export function formatFieldValue(field, value) {
  if (value === "" || value === null || value === undefined) return "—";
  switch (field.type) {
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

/** Convert raw value to the string that should land in a Sheet cell / Doc. */
export function valueForExport(field, value) {
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "";
  return String(value);
}
