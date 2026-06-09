/** Small, dependency-free unique ID helpers. */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** 6 crypto-random base36 chars (falls back to Math.random in old browsers). */
function randomSuffix() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(6);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => ALPHABET[b % 36]).join("");
  }
  return Math.random().toString(36).slice(2, 8);
}

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${randomSuffix()}`;
}

export const newPresetId = () => generateId("preset");
export const newFieldId = () => generateId("field");

/** Human-friendly quotation reference, e.g. QTF-LXY12-AB3C. */
export function generateQuotationId() {
  const time = Date.now().toString(36).toUpperCase();
  return `QTF-${time}-${randomSuffix().toUpperCase()}`;
}
