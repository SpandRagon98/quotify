/**
 * Thin client for the Google Apps Script Web App.
 *
 * Centralises POST/GET, JSON parsing, and — importantly — turns silent/fake
 * successes into real errors:
 *   - a non-JSON body (e.g. a Google sign-in HTML page) becomes a clear error,
 *   - `success !== true` throws the backend's own error message,
 *   - callers additionally assert the response came from the EXPECTED handler
 *     (via the `action` echo), so an outdated deployment can't look successful.
 */

import { GOOGLE } from "../config/appConfig";

async function parseResult(response) {
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      "Google Apps Script did not return JSON. Re-deploy the Web App and make sure " +
        "access is set to “Anyone” (a sign-in page is usually returned when it isn't)."
    );
  }
  if (!result || result.success !== true) {
    throw new Error(result?.error || "The Apps Script reported a failure.");
  }
  return result;
}

/** POST a JSON action payload (text/plain avoids a CORS preflight). */
export async function postAction(action, body = {}) {
  const response = await fetch(GOOGLE.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...body }),
  });
  return parseResult(response);
}

/** GET an action with query params. */
export async function getAction(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const response = await fetch(`${GOOGLE.APPS_SCRIPT_URL}?${qs}`);
  return parseResult(response);
}

/**
 * Guard that the response was produced by the expected handler.
 * Protects against an old deployment that returns success for a different action.
 */
export function assertAction(result, expected) {
  if (result.action && result.action !== expected) {
    throw new Error(
      `Unexpected response (got “${result.action}”, expected “${expected}”). ` +
        "Re-deploy the latest Apps Script — see GOOGLE_APPS_SCRIPT_SETUP.md."
    );
  }
}
