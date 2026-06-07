/**
 * Maps a Database (Google Sheet) row back into editable form values.
 * Mapping is by header LABEL, so column order or extra columns don't matter.
 */

import { METADATA_COLUMNS } from "../config/appConfig";
import { flattenFields } from "./subfields";

/** Convert a stored cell back to the field's working value. */
function coerceForField(field, raw) {
  if (raw === undefined || raw === null || raw === "") {
    return field.type === "boolean" ? false : "";
  }
  if (field.type === "boolean") {
    return raw === true || String(raw).trim().toLowerCase() === "yes";
  }
  // text / number / date / email / phone / dropdown / longtext are stored as-is.
  return raw;
}

/**
 * @param {object} preset
 * @param {string[]} headers - the sheet's header row
 * @param {Array} row - one data row aligned to `headers`
 * @returns {{ values:Object, quotationId:string, createdAt:string }}
 */
export function rowToFormValues(preset, headers, row) {
  const cell = (label) => {
    const i = headers.indexOf(label);
    return i === -1 ? undefined : row[i];
  };

  const values = {};
  // Parent fields and subfields are stored in their own columns; load both by
  // their column label ("Parent" / "Parent - Sub").
  flattenFields(preset.fields).forEach((leaf) => {
    if (leaf.field.calculated) return; // calculated values are recomputed from inputs
    values[leaf.valueId] = coerceForField(leaf.field, cell(leaf.columnLabel));
  });

  return {
    values,
    quotationId: cell(METADATA_COLUMNS[0]) ?? "", // "Quotation ID"
    createdAt: cell(METADATA_COLUMNS[2]) ?? "", // "Created At"
  };
}
