/**
 * Placeholder substitution for the native document's company description.
 * Supports {{Field Label}}, {{Quotation Number}}, {{Quotation ID}}, {{Preset Name}}.
 */

import { computeCalculatedValues, formatCalculated } from "./formula";
import { flattenFields } from "./subfields";

export function buildDocPlaceholderMap(preset, values, quotationId) {
  const calc = values ? computeCalculatedValues(preset, values) : {};
  const map = {
    "Quotation ID": quotationId || "",
    "Quotation Number": quotationId || "",
    "Preset Name": preset.name,
  };
  // Parent fields + subfields, keyed by their column label ("Parent - Sub").
  flattenFields(preset.fields).forEach(({ field: f, columnLabel }) => {
    let v = "";
    if (f.calculated) v = formatCalculated(calc[f.id], f);
    else if (f.type === "boolean") v = values?.[f.id] ? "Yes" : "No";
    else v = values?.[f.id] != null && values?.[f.id] !== "" ? String(values[f.id]) : "";
    map[columnLabel] = v;
  });
  return map;
}

export function replaceDocPlaceholders(text, map) {
  return String(text || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => {
    const key = k.trim();
    return key in map ? map[key] : m;
  });
}
