/**
 * Email sending via the Google Apps Script Web App.
 *
 * The frontend sends the recipient + the placeholder-substituted subject/body.
 * The Apps Script wraps the body in the branded Qyrova HTML template (with the
 * Approve / Decline / Negotiate CTAs) and sends it via MailApp from the deploying
 * account — so no account is hardcoded. See GOOGLE_APPS_SCRIPT_SETUP.md.
 */

import { GOOGLE } from "../config/appConfig";
import { postAction, assertAction } from "./appsScriptClient";

/** Turn a raw Apps Script permission error into an actionable message. */
function clarifyError(message) {
  const msg = String(message || "");
  if (/permission|not authorized|Required permissions|authoriz/i.test(msg)) {
    return (
      "The Apps Script isn't authorized to send mail yet. Open the script, run the " +
      "doPost function once and click Allow (or re-deploy a new version), then try " +
      "again. — Original error: " + msg
    );
  }
  return msg;
}

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

  try {
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
  } catch (err) {
    // Surface the real backend error, but make permission failures actionable.
    throw new Error(clarifyError(err.message));
  }
}
