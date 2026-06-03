/**
 * Quotation orchestration: turns a preset + entered values into the payloads
 * the Sheets/Docs services expect, and runs the save/generate flow.
 *
 * Each preset now carries its OWN Google Sheet and Google Doc links, so the
 * payloads target the preset-specific spreadsheet / template.
 *
 * UI components call submitQuotation() and stay free of integration details.
 */

import { METADATA_COLUMNS } from "../config/appConfig";
import { generateQuotationId } from "../utils/idGenerator";
import { valueForExport } from "../utils/fieldFormatters";
import { extractId } from "../utils/googleLinks";
import {
  appendQuotationRow,
  updateQuotationRow,
  fetchSheetData,
} from "./googleSheetsService";
import { generateDocument } from "./googleDocsService";

/** Exact user-facing block messages (per spec). */
export const MSG_NO_SHEET =
  "Please link a Google Sheet for this preset before saving details.";
export const MSG_NO_DOC =
  "Please link a Google Doc template for this preset before generating the quotation.";
export const MSG_NO_QUOTATION_ID =
  "Missing quotation ID — cannot update this quotation.";

/** Resolve a preset's effective Sheet/Doc IDs (id field or extracted from URL). */
export function presetSheetId(preset) {
  return preset.googleSheetId || extractId(preset.googleSheetUrl);
}
export function presetDocId(preset) {
  return preset.googleDocId || extractId(preset.googleDocUrl);
}

/** Build the dynamic Sheets payload (headers + aligned row). */
export function buildSheetPayload(preset, values, meta) {
  const fieldHeaders = preset.fields.map((f) => f.label);
  const headers = [...METADATA_COLUMNS, ...fieldHeaders];

  const metaRow = [meta.quotationId, preset.name, meta.createdAt, meta.updatedAt];
  const fieldRow = preset.fields.map((f) => valueForExport(f, values[f.id]));

  return {
    spreadsheetId: presetSheetId(preset),
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

/**
 * Build the Docs payload: { {{Label}}: value } placeholder map.
 * Values come straight from the entered form — the doc does NOT read the Sheet.
 */
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
    templateId: presetDocId(preset),
    presetName: preset.name,
    quotationId: meta.quotationId,
    placeholders,
  };
}

/**
 * Save a quotation row, and optionally generate its document.
 * Throws the exact spec messages when a required link is missing.
 * @param {object} preset
 * @param {object} values - { [fieldId]: value }
 * @param {object} [opts] - { generateDoc?: boolean }
 */
export async function submitQuotation(preset, values, opts = {}) {
  if (!presetSheetId(preset)) throw new Error(MSG_NO_SHEET);
  if (opts.generateDoc && !presetDocId(preset)) throw new Error(MSG_NO_DOC);

  const createdAt = new Date().toISOString();
  const meta = {
    quotationId: generateQuotationId(),
    createdAt,
    updatedAt: createdAt,
  };

  const sheetResult = await appendQuotationRow(buildSheetPayload(preset, values, meta));

  let docResult = null;
  if (opts.generateDoc) {
    docResult = await generateDocument(buildDocPayload(preset, values, meta));
  }

  return { meta, sheetResult, docResult };
}

/**
 * Update an EXISTING quotation row (no new row is created).
 * The Apps Script locates the row by quotationId and overwrites it, preserving
 * the original Quotation ID / Created At and stamping Last Updated At server-side.
 * @param {object} preset
 * @param {object} values - { [fieldId]: value }
 * @param {string} quotationId - the existing quotation's ID (must stay the same)
 * @param {object} [opts] - { generateDoc?: boolean, createdAt?: string }
 */
export async function updateQuotation(preset, values, quotationId, opts = {}) {
  if (!presetSheetId(preset)) throw new Error(MSG_NO_SHEET);
  if (!quotationId) throw new Error(MSG_NO_QUOTATION_ID);
  if (opts.generateDoc && !presetDocId(preset)) throw new Error(MSG_NO_DOC);

  const meta = {
    quotationId,
    createdAt: opts.createdAt || "",
    updatedAt: new Date().toISOString(),
  };

  const sheetResult = await updateQuotationRow(buildSheetPayload(preset, values, meta));

  let docResult = null;
  if (opts.generateDoc) {
    docResult = await generateDocument(buildDocPayload(preset, values, meta));
  }

  return { meta, sheetResult, docResult };
}

/**
 * Read all rows from a preset's linked Google Sheet (Database tab).
 * @returns {Promise<{headers:string[], rows:Array<Array>}>}
 */
export async function fetchPresetData(preset) {
  if (!presetSheetId(preset)) throw new Error(MSG_NO_SHEET);
  return fetchSheetData({
    spreadsheetId: presetSheetId(preset),
    sheetTabName: preset.sheetTabName,
  });
}
