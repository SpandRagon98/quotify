/**
 * Google Sheets integration.
 *
 * Posts dynamic payloads to the Apps Script Web App. Both the target spreadsheet
 * AND the columns are preset-driven: the preset decides which spreadsheet, which
 * tab, and the header labels.
 *
 * Success is only reported when the response comes back from the matching
 * handler (see appsScriptClient.assertAction) — an outdated deployment that
 * doesn't implement these actions surfaces as a clear error instead of a fake OK.
 *
 * Apps Script responsibilities (see GOOGLE_APPS_SCRIPT_SETUP.md):
 *   1. open the preset's `spreadsheetId` (fall back to the bound sheet),
 *   2. ensure tab `sheetTabName` exists (create if missing),
 *   3. merge `headers` into the header row (append new columns, keep old),
 *   4. append `row` aligned to the live header order.
 */

import { GOOGLE } from "../config/appConfig";
import { postAction, getAction, assertAction } from "./appsScriptClient";

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

  const result = await postAction("appendRow", {
    // payload.spreadsheetId (preset link) wins; fall back to global config.
    spreadsheetId: payload.spreadsheetId || GOOGLE.SPREADSHEET_ID || undefined,
    ...payload,
  });
  assertAction(result, "appendRow");
  return result;
}

/**
 * Update one EXISTING quotation row (located by Quotation ID on the backend).
 * Does NOT create a new row.
 * @param {object} payload - built by quotationService.buildSheetPayload
 * @returns {Promise<{success:boolean, mocked?:boolean, [k:string]:any}>}
 */
export async function updateQuotationRow(payload) {
  if (!GOOGLE.ENABLED) {
    console.info("[Sheets mock] updateQuotationRow", payload);
    return { success: true, mocked: true };
  }

  const result = await postAction("updateRow", {
    spreadsheetId: payload.spreadsheetId || GOOGLE.SPREADSHEET_ID || undefined,
    ...payload,
  });
  assertAction(result, "updateRow");
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

  const result = await getAction("getSheetData", {
    spreadsheetId: spreadsheetId || "",
    sheetTabName: sheetTabName || "",
  });
  assertAction(result, "getSheetData");
  return { headers: result.headers || [], rows: result.rows || [] };
}
