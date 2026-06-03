/** Small, dependency-free unique ID helpers. */

function randomSuffix() {
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
