/**
 * Central configuration for Quotify.
 *
 * Everything that is environment- or account-specific lives here so it can be
 * updated from a single place. When you receive a new Google Sheet link or new
 * Google Doc template links, update them here (or per-preset in the UI).
 */

export const APP = {
  name: "Quotify",
  tagline: "Dynamic quotation & form builder",
  description:
    "Design custom quotation presets, collect data through dynamic forms, and sync to Google Sheets & Docs.",
};

/**
 * Google integration config.
 *
 * The app talks to a single Google Apps Script Web App (deployed as
 * "Execute as me / Anyone"). The same script handles both Sheets (append rows)
 * and Docs (generate from template). See GOOGLE_APPS_SCRIPT_SETUP.md.
 *
 * NOTE: APPS_SCRIPT_URL below is the previously-working endpoint, kept so the
 * integration mechanism is preserved. Replace it with your new deployment URL
 * when ready. SPREADSHEET_ID can be left blank to let the script use its bound
 * spreadsheet, or set it to target a specific sheet.
 */
export const GOOGLE = {
  // Apps Script Web App endpoint (POST + GET). Update after re-deploying.
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbwNgTqLq1fClk326-nQqoqis8_g-iBWLBKCz8sI5j_sRtks2Ki1F-CLyVSx-wqvXVQ0Zg/exec",

  // Optional: target spreadsheet ID. Leave "" to use the script's bound sheet.
  SPREADSHEET_ID: "",

  // Set false to run the UI without hitting the network (logs payloads instead).
  // Useful for local testing before the new Sheet/Doc links are provided.
  ENABLED: true,
};

/** Metadata columns prepended to every preset sheet tab. */
export const METADATA_COLUMNS = [
  "Quotation ID",
  "Preset Name",
  "Created At",
  "Last Updated At",
];

/** localStorage keys. Swappable for a real backend later. */
export const STORAGE_KEYS = {
  presets: "quotify.presets.v1",
  config: "quotify.config.v1",
};
