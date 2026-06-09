/**
 * Central configuration for Qyrova.
 *
 * Everything that is environment- or account-specific lives here so it can be
 * updated from a single place. When you receive a new Google Sheet link or new
 * Google Doc template links, update them here (or per-preset in the UI).
 */

export const APP = {
  name: "Qyrova",
  tagline: "Dynamic quotation & form builder",
  description:
    "Design custom quotation presets, collect data through dynamic forms, and sync to Google Sheets & Docs.",
};

/** Theme accent options exposed in Settings (CSS handles the palettes). */
export const ACCENTS = [
  { value: "indigo", label: "Indigo", color: "#635bff" },
  { value: "violet", label: "Violet", color: "#7c5cff" },
  { value: "blue", label: "Blue", color: "#2f7df6" },
  { value: "cyan", label: "Cyan", color: "#0bb3d6" },
  { value: "emerald", label: "Emerald", color: "#0f9d6e" },
  { value: "rose", label: "Rose", color: "#e8497b" },
  { value: "amber", label: "Amber", color: "#e0921f" },
  { value: "slate", label: "Slate", color: "#475569" },
  { value: "bluegray", label: "Blue Gray", color: "#546079" },
  { value: "graphite", label: "Graphite", color: "#545861" },
  { value: "charcoal", label: "Charcoal", color: "#44474f" },
  { value: "neutral", label: "Neutral Gray", color: "#6b7280" },
];

/** The app owner always gets Owner access, regardless of the user list. */
export const OWNER_EMAIL = "spandan305@gmail.com";

/**
 * Default owner password, seeded/reset once into the local account store so the
 * owner can always log in. (Demo-only localStorage auth — migrate to a real
 * backend / Firebase Auth before production.)
 */
export const OWNER_DEFAULT_PASSWORD = "spand1234";
export const OWNER_SEED_VERSION = "1";

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
    "https://script.google.com/macros/s/AKfycbx2QedMsMnDquFsSf0NpwHYAmKjfflr36v89oVpZnUZSTQbAe95NHxAFC4kKwsgLFsFXw/exec",

  // Optional: target spreadsheet ID. Leave "" to use the script's bound sheet.
  SPREADSHEET_ID: "",

  // Set false to run the UI without hitting the network (logs payloads instead).
  // Useful for local testing before the new Sheet/Doc links are provided.
  ENABLED: true,
};

/**
 * Email delivery (Phase 2).
 *
 * PROVIDER picks the default sending path:
 *   - "appsscript" (default): the existing Google Apps Script / Gmail path.
 *   - "resend": branded transactional email from your own domain via the
 *     `send-quote-email` Supabase Edge Function, with tokenized Approve/Decline/
 *     Negotiate CTAs to our own backend. See PHASE2_SETUP.md.
 *
 * Set VITE_EMAIL_PROVIDER=resend (in .env.production / Cloudflare) once the Edge
 * Function + Resend domain are configured. Users can still switch per-send in the
 * Email composer when the cloud backend is active.
 */
export const EMAIL = {
  PROVIDER: import.meta.env.VITE_EMAIL_PROVIDER === "resend" ? "resend" : "appsscript",
};

/** Metadata columns prepended to every preset sheet tab. */
export const METADATA_COLUMNS = [
  "Quotation ID",
  "Preset Name",
  "Created At",
  "Last Updated At",
];

/**
 * Status columns written by the email CTA responses (Apps Script `respond`).
 * Surfaced as coloured badges in the Email (and Database) tables.
 */
export const STATUS_COLUMNS = ["Approval", "Decline", "Negotiate"];

/** localStorage keys. Swappable for a real backend later. */
export const STORAGE_KEYS = {
  presets: "quotify.presets.v1",
  config: "quotify.config.v1",
  emailTemplates: "quotify.emailTemplates.v1",
  sidebarCollapsed: "quotify.sidebarCollapsed.v1",
  users: "quotify.users.v1",
  session: "quotify.session.v1",
  accounts: "quotify.accounts.v1",
  settings: "quotify.settings.v1",
  ownerSeed: "quotify.ownerSeed.v1",
  companyLogos: "quotify.companyLogos.v1",
  notifications: "quotify.notifications.v1",
  notifSeen: "quotify.notifSeen.v1",
};
