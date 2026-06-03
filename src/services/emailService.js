/**
 * Email sending via the Google Apps Script Web App (Gmail).
 *
 * The frontend sends the recipient + the placeholder-substituted subject/body.
 * The Apps Script wraps the body in the branded Quotify HTML template (with the
 * Approve / Decline / Negotiate CTAs) and sends it from the deploying account —
 * so no Gmail account is hardcoded. See GOOGLE_APPS_SCRIPT_SETUP.md.
 */

import { GOOGLE } from "../config/appConfig";
import { postAction, assertAction } from "./appsScriptClient";

/**
 * @param {object} params
 * @param {string} params.to - recipient email (must be non-empty)
 * @param {string} params.subject
 * @param {string} params.body - plain text, placeholders already replaced
 * @param {string} [params.quotationId]
 * @param {string} [params.presetName]
 * @param {string} [params.spreadsheetId] - lets the CTA links update this sheet
 * @param {string} [params.sheetTabName]
 */
export async function sendQuotationEmail({
  to,
  subject,
  body,
  quotationId,
  presetName,
  spreadsheetId,
  sheetTabName,
}) {
  if (!to) {
    throw new Error("No email address found in this row — add/fill an email field.");
  }

  if (!GOOGLE.ENABLED) {
    console.info("[Email mock] sendQuotationEmail", { to, subject, body });
    return { success: true, mocked: true };
  }

  const result = await postAction("sendEmail", {
    to,
    subject,
    body,
    quotationId: quotationId || "",
    presetName: presetName || "",
    spreadsheetId: spreadsheetId || "",
    sheetTabName: sheetTabName || "",
  });
  assertAction(result, "sendEmail");
  return result;
}
