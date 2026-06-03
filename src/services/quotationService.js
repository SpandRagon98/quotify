/**
 * Quotation orchestration: turns a preset + entered values into the payloads
 * the Sheets/Docs services expect, and runs the save/generate flow.
 *
 * UI components call submitQuotation() and stay free of integration details.
 */

import { METADATA_COLUMNS } from "../config/appConfig";
import { generateQuotationId } from "../utils/idGenerator";
import { valueForExport } from "../utils/fieldFormatters";
import { appendQuotationRow } from "./googleSheetsService";
import { generateDocument, extractDocId } from "./googleDocsService";

/** Build the dynamic Sheets payload (headers + aligned row). */
export function buildSheetPayload(preset, values, meta) {
  const fieldHeaders = preset.fields.map((f) => f.label);
  const headers = [...METADATA_COLUMNS, ...fieldHeaders];

  const metaRow = [meta.quotationId, preset.name, meta.createdAt, meta.updatedAt];
  const fieldRow = preset.fields.map((f) => valueForExport(f, values[f.id]));

  return {
    presetName: preset.name,
    sheetTabName: preset.sheetTabName,
    quotationId: meta.quotationId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    headers,
    row: [...metaRow, ...fieldRow],
    // Structured copy, handy for debugging / future Apps Script logic.
    fields: preset.fields.map((f) => ({
      label: f.label,
      type: f.type,
      value: valueForExport(f, values[f.id]),
    })),
  };
}

/** Build the Docs payload: { {{Label}}: value } placeholder map. */
export function buildDocPayload(preset, values, meta) {
  const placeholders = {
    "Quotation ID": meta.quotationId,
    "Preset Name": preset.name,
    "Created At": meta.createdAt,
  };
  preset.fields.forEach((f) => {
    placeholders[f.label] = valueForExport(f, values[f.id]);
  });

  return {
    templateId: extractDocId(preset.docTemplateId),
    presetName: preset.name,
    quotationId: meta.quotationId,
    placeholders,
  };
}

/**
 * Save a quotation row, and optionally generate its document.
 * @param {object} preset
 * @param {object} values - { [fieldId]: value }
 * @param {object} [opts] - { generateDoc?: boolean }
 */
export async function submitQuotation(preset, values, opts = {}) {
  const createdAt = new Date().toISOString();
  const meta = {
    quotationId: generateQuotationId(),
    createdAt,
    updatedAt: createdAt,
  };

  const sheetResult = await appendQuotationRow(buildSheetPayload(preset, values, meta));

  let docResult = null;
  if (opts.generateDoc && preset.docTemplateId) {
    docResult = await generateDocument(buildDocPayload(preset, values, meta));
  }

  return { meta, sheetResult, docResult };
}
