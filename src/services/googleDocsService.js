/**
 * Google Docs integration.
 *
 * Each preset maps to its own Google Doc template. On generate, we send the
 * template ID plus a { placeholderName: value } map built from the ENTERED form
 * values (the doc never reads the Sheet). The Apps Script copies the template,
 * replaces {{Placeholder}} tokens, and returns the new doc's link.
 *
 * Success is only reported when a real document URL comes back, so an outdated
 * deployment can't show a fake "generated" state with no link.
 */

import { GOOGLE } from "../config/appConfig";
import { postAction, assertAction } from "./appsScriptClient";

// Re-exported for any legacy import sites; the canonical helper lives in utils.
export { extractDocId } from "../utils/googleLinks";

/**
 * Generate a document from the preset's template.
 * @param {object} payload - built by quotationService.buildDocPayload
 * @returns {Promise<{success:boolean, docUrl:string, docId?:string, mocked?:boolean}>}
 */
export async function generateDocument(payload) {
  if (!payload.templateId) {
    throw new Error("This preset has no Google Doc template assigned.");
  }

  if (!GOOGLE.ENABLED) {
    console.info("[Docs mock] generateDocument", payload);
    return { success: true, mocked: true, docUrl: "" };
  }

  const result = await postAction("generateDoc", payload);
  assertAction(result, "generateDoc");

  if (!result.docUrl) {
    throw new Error(
      "The document was not generated (no link returned). Re-deploy the latest " +
        "Apps Script and check the template is shared with the script owner — " +
        "see GOOGLE_APPS_SCRIPT_SETUP.md."
    );
  }
  return result;
}
