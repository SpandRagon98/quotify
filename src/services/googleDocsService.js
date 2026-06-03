/**
 * Google Docs integration.
 *
 * Each preset can map to its own Google Doc template. On generate, we send the
 * template ID plus a { placeholderName: value } map. The Apps Script copies the
 * template, replaces {{Placeholder}} tokens, and returns the new doc's link.
 */

import { GOOGLE } from "../config/appConfig";

/** Extract a Google Doc ID from a full URL, or return the value unchanged. */
export function extractDocId(idOrUrl) {
  if (!idOrUrl) return "";
  const match = String(idOrUrl).match(/[-\w]{25,}/);
  return match ? match[0] : String(idOrUrl).trim();
}

/**
 * Generate a document from the preset's template.
 * @param {object} payload - built by quotationService.buildDocPayload
 * @returns {Promise<{success:boolean, docUrl?:string, mocked?:boolean}>}
 */
export async function generateDocument(payload) {
  if (!payload.templateId) {
    throw new Error("This preset has no Google Doc template assigned.");
  }

  if (!GOOGLE.ENABLED) {
    console.info("[Docs mock] generateDocument", payload);
    return { success: true, mocked: true, docUrl: "" };
  }

  const response = await fetch(GOOGLE.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "generateDoc", ...payload }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to generate document");
  }
  return result;
}
