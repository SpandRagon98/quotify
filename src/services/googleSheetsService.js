/**
 * Google Sheets integration.
 *
 * Preserves the existing mechanism (POST a JSON payload to a Google Apps Script
 * Web App) but makes both the target spreadsheet AND the payload fully dynamic:
 * the preset decides which spreadsheet, which tab, and the column headers.
 *
 * The Apps Script side (see GOOGLE_APPS_SCRIPT_SETUP.md) is responsible for:
 *   1. opening the preset's `spreadsheetId` (falls back to the bound sheet),
 *   2. ensuring the sheet tab `sheetTabName` exists (create if missing),
 *   3. ensuring the header row matches `headers` (append any new columns),
 *   4. appending `row` aligned to those headers as a new record.
 */

import { GOOGLE } from "../config/appConfig";

/**
 * Append one quotation row to its preset's sheet tab.
 * @param {object} payload - built by quotationService.buildSheetPayload
 * @returns {Promise<{success:boolean, mocked?:boolean, [k:string]:any}>}
 */
export async function appendQuotationRow(payload) {
  if (!GOOGLE.ENABLED) {
    console.info("[Sheets mock] appendQuotationRow", payload);
    return { success: true, mocked: true };
  }

  const response = await fetch(GOOGLE.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "appendRow",
      // payload.spreadsheetId (preset link) wins; fall back to global config.
      spreadsheetId: payload.spreadsheetId || GOOGLE.SPREADSHEET_ID || undefined,
      ...payload,
    }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to save to Google Sheet");
  }
  return result;
}

/**
 * Read all rows from a preset's linked spreadsheet/tab (Database tab).
 * @param {{spreadsheetId:string, sheetTabName:string}} params
 * @returns {Promise<{headers:string[], rows:Array<Array>, mocked?:boolean}>}
 */
export async function fetchSheetData({ spreadsheetId, sheetTabName }) {
  if (!GOOGLE.ENABLED) {
    console.info("[Sheets mock] fetchSheetData", { spreadsheetId, sheetTabName });
    return { headers: [], rows: [], mocked: true };
  }

  const url =
    `${GOOGLE.APPS_SCRIPT_URL}?action=getSheetData` +
    `&spreadsheetId=${encodeURIComponent(spreadsheetId || "")}` +
    `&sheetTabName=${encodeURIComponent(sheetTabName || "")}`;

  const response = await fetch(url);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Google Sheet data");
  }
  return { headers: result.headers || [], rows: result.rows || [] };
}
