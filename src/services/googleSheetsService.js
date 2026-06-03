/**
 * Google Sheets integration.
 *
 * Preserves the existing mechanism (POST a JSON payload to a Google Apps Script
 * Web App) but makes the payload fully dynamic: the preset decides the target
 * tab name and the column headers.
 *
 * The Apps Script side (see GOOGLE_APPS_SCRIPT_SETUP.md) is responsible for:
 *   1. ensuring the sheet tab `sheetTabName` exists (create if missing),
 *   2. ensuring the header row matches `headers` (append any new columns),
 *   3. appending `row` aligned to those headers as a new record.
 */

import { GOOGLE } from "../config/appConfig";

/**
 * Append one quotation row to its preset's sheet tab.
 * @param {object} payload - built by quotationService.buildSheetPayload
 * @returns {Promise<{success:boolean, mocked?:boolean, [k:string]:any}>}
 */
export async function appendQuotationRow(payload) {
  if (!GOOGLE.ENABLED) {
    // Network disabled: log so the UI flow can still be tested end-to-end.
    console.info("[Sheets mock] appendQuotationRow", payload);
    return { success: true, mocked: true };
  }

  const response = await fetch(GOOGLE.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "appendRow",
      spreadsheetId: GOOGLE.SPREADSHEET_ID || undefined,
      ...payload,
    }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to save to Google Sheet");
  }
  return result;
}
