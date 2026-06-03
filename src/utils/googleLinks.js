/**
 * Helpers for Google Sheet / Doc links: validation, ID extraction,
 * placeholder generation, and preset normalisation (backward compatibility).
 */

const ID_RE = /[-\w]{25,}/;

/** True if the string looks like a Google Sheets URL. */
export function isGoogleSheetUrl(url) {
  if (!url) return false;
  return /docs\.google\.com\/spreadsheets\/d\/[-\w]{25,}/.test(String(url).trim());
}

/** True if the string looks like a Google Docs URL. */
export function isGoogleDocUrl(url) {
  if (!url) return false;
  return /docs\.google\.com\/document\/d\/[-\w]{25,}/.test(String(url).trim());
}

/** Extract a Sheet/Doc file ID from a URL, or return a bare ID unchanged. */
export function extractId(idOrUrl) {
  if (!idOrUrl) return "";
  const str = String(idOrUrl).trim();
  // Prefer the /d/<id>/ segment when present.
  const dMatch = str.match(/\/d\/([-\w]{25,})/);
  if (dMatch) return dMatch[1];
  const any = str.match(ID_RE);
  return any ? any[0] : "";
}

export const extractSheetId = extractId;
export const extractDocId = extractId;

/**
 * Build placeholder tokens from a preset's fields.
 * @returns {{id:string, label:string, token:string}[]}
 */
export function fieldsToPlaceholders(fields = []) {
  return fields
    .filter((f) => f.label && f.label.trim())
    .map((f) => ({ id: f.id, label: f.label, token: `{{${f.label}}}` }));
}

/** Detect duplicate (case-insensitive) field labels in a preset. */
export function findDuplicateLabels(fields = []) {
  const seen = new Map();
  const dupes = new Set();
  fields.forEach((f) => {
    const key = (f.label || "").trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) dupes.add(f.label.trim());
    seen.set(key, true);
  });
  return [...dupes];
}

/**
 * Ensure a preset has all current fields, migrating older shapes.
 * Old presets used `docTemplateId`; new ones use googleDoc{Url,Id} + googleSheet{Url,Id}.
 */
export function normalizePreset(preset) {
  if (!preset || typeof preset !== "object") return preset;
  const now = new Date().toISOString();

  // Migrate legacy docTemplateId → googleDoc fields.
  let googleDocId = preset.googleDocId || "";
  let googleDocUrl = preset.googleDocUrl || "";
  if (!googleDocId && preset.docTemplateId) {
    googleDocId = extractId(preset.docTemplateId);
    if (isGoogleDocUrl(preset.docTemplateId)) googleDocUrl = preset.docTemplateId;
  }

  return {
    id: preset.id,
    name: preset.name || "",
    description: preset.description || "",
    fields: Array.isArray(preset.fields) ? preset.fields : [],
    googleSheetUrl: preset.googleSheetUrl || "",
    googleSheetId: preset.googleSheetId || "",
    googleDocUrl,
    googleDocId,
    sheetTabName: preset.sheetTabName || preset.name || "",
    createdAt: preset.createdAt || now,
    updatedAt: preset.updatedAt || now,
  };
}
