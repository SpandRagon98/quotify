/**
 * Helpers for the Email tab: placeholder substitution, recipient lookup,
 * and a sensible default template.
 */

import { flattenFields } from "./subfields";

/** Replace {{Header}} tokens in `text` with the row's value for that column. */
export function applyPlaceholders(text, headers, row) {
  return String(text || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    const i = headers.indexOf(key.trim());
    return i === -1 ? match : String(row[i] ?? "");
  });
}

/**
 * Find the recipient email for a row.
 * Prefers a preset field of type "email", then any header containing "email".
 * @returns {string} the email, or "" if none found
 */
export function findRowEmail(preset, headers, row) {
  const candidates = [];
  // Email-type parent fields and subfields (matched by their column label).
  flattenFields(preset.fields)
    .filter((l) => l.field.type === "email")
    .forEach((l) => candidates.push(l.columnLabel));
  headers.forEach((h) => {
    if (/e-?mail/i.test(h) && !candidates.includes(h)) candidates.push(h);
  });

  for (const label of candidates) {
    const i = headers.indexOf(label);
    if (i !== -1) {
      const value = String(row[i] ?? "").trim();
      if (value) return value;
    }
  }
  return "";
}

/** A starter template; the user edits it freely. */
export function defaultEmailTemplate(preset) {
  return {
    subject: `Your quotation from Qyrova — {{Quotation ID}}`,
    body:
      `Hello,\n\n` +
      `Thank you for your interest. Your ${preset?.name || "quotation"} is ready.\n\n` +
      `Quotation ID: {{Quotation ID}}\n\n` +
      `You can view, download, and respond to the quotation using the secure ` +
      `document link in this email.\n\n` +
      `Best regards,\nThe Qyrova Team`,
  };
}
