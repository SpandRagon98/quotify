/**
 * Validation logic, kept separate from UI.
 * Each function returns an error string ("" means valid).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,15}$/;
const LETTERS_RE = /^[A-Za-z\s.'-]*$/;
const ALPHANUMERIC_RE = /^[A-Za-z0-9\s.'-]*$/;

function isEmpty(value) {
  return value === "" || value === null || value === undefined;
}

/** Validate a single field's value. Returns "" when valid. */
export function validateField(field, value) {
  if (field.required && (isEmpty(value) || (field.type === "boolean" && value === undefined))) {
    return `${field.label} is required`;
  }

  // Optional + empty → always valid (boolean false is a valid answer).
  if (isEmpty(value) && field.type !== "boolean") return "";

  switch (field.type) {
    case "number":
      if (isEmpty(value)) return "";
      if (Number.isNaN(Number(value))) return `${field.label} must be a number`;
      return "";

    case "email":
      if (isEmpty(value)) return "";
      return EMAIL_RE.test(String(value)) ? "" : `${field.label} must be a valid email`;

    case "phone":
      if (isEmpty(value)) return "";
      return PHONE_RE.test(String(value)) ? "" : `${field.label} must be a valid phone number`;

    case "date":
      if (isEmpty(value)) return "";
      return Number.isNaN(Date.parse(value)) ? `${field.label} must be a valid date` : "";

    case "dropdown":
      if (isEmpty(value)) return "";
      return (field.options || []).includes(value)
        ? ""
        : `${field.label} has an invalid selection`;

    case "text": {
      if (isEmpty(value)) return "";
      if (field.textMode === "letters" && !LETTERS_RE.test(String(value))) {
        return `${field.label} may contain letters only`;
      }
      if (field.textMode === "alphanumeric" && !ALPHANUMERIC_RE.test(String(value))) {
        return `${field.label} may contain letters and numbers only`;
      }
      return "";
    }

    default:
      return "";
  }
}

/** Validate every field. Returns a map of { [fieldId]: errorString }. */
export function validateForm(fields, values) {
  const errors = {};
  fields.forEach((field) => {
    const error = validateField(field, values[field.id]);
    if (error) errors[field.id] = error;
  });
  return errors;
}

/** Live input filter: should this keystroke result be accepted for the field? */
export function isInputAllowed(field, nextValue) {
  if (nextValue === "") return true;
  switch (field.type) {
    case "number":
      return /^-?\d*\.?\d*$/.test(nextValue);
    case "phone":
      return /^[+\d\s()-]*$/.test(nextValue);
    case "text":
      if (field.textMode === "letters") return LETTERS_RE.test(nextValue);
      if (field.textMode === "alphanumeric") return ALPHANUMERIC_RE.test(nextValue);
      return true;
    default:
      return true;
  }
}

/** Validate a preset's own configuration before saving it. */
export function validatePreset(preset) {
  const errors = [];
  if (!preset.name || !preset.name.trim()) errors.push("Preset name is required");
  if (!preset.sheetTabName || !preset.sheetTabName.trim()) {
    errors.push("Google Sheet tab name is required");
  }
  if (!preset.fields || preset.fields.length === 0) {
    errors.push("Add at least one field");
  }
  preset.fields?.forEach((f, i) => {
    if (!f.label || !f.label.trim()) errors.push(`Field ${i + 1} needs a label`);
    if (f.type === "dropdown" && (!f.options || f.options.length === 0)) {
      errors.push(`"${f.label || `Field ${i + 1}`}" needs at least one dropdown option`);
    }
  });
  return errors;
}
