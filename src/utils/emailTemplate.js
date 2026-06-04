/**
 * Helpers for the Email tab: placeholder substitution, recipient lookup,
 * and a sensible default template.
 */

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
  preset.fields
    .filter((f) => f.type === "email")
    .forEach((f) => candidates.push(f.label));
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
      `Thank you for your interest. Please find your ${preset?.name || "quotation"} ` +
      `details below.\n\n` +
      `Quotation ID: {{Quotation ID}}\n\n` +
      `Use the Approve / Decline / Negotiate buttons below to respond.\n\n` +
      `Best regards,\nThe Qyrova Team`,
  };
}
