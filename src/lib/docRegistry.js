/**
 * Document registry — remembers, per quotation ID, which document type was
 * generated (native | googledoc) and the generated Google Doc's URL.
 *
 * Used so the Database tab's "View" opens the right artifact, the public
 * tracked-quote page can show the Google Doc when that's the saved type, and
 * the app can show a "Not generated / Native PDF / Google Doc" status badge.
 *
 * Local-first (synchronous localStorage reads) with cloud mirroring to the
 * org's `app_state` blob when Supabase is configured — same pattern as the
 * other stores. Entries are tiny: { docType, docUrl, generatedAt }.
 */

import { STORAGE_KEYS } from "../config/appConfig";
import {
  startCloud,
  cloudEnabled,
  onCloudAuth,
  loadCloudState,
  saveCloudState,
} from "./cloudStore";

const CLOUD_KEY = "doc_registry";

let initialized = false;

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.docRegistry);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocal(registry) {
  try {
    localStorage.setItem(STORAGE_KEYS.docRegistry, JSON.stringify(registry));
  } catch {
    // ignore
  }
}

/** Idempotent: hydrate from / migrate to the cloud once a signed-in org exists. */
function init() {
  if (initialized || !cloudEnabled()) return;
  initialized = true;
  startCloud();
  onCloudAuth(async ({ orgId }) => {
    if (!orgId) return;
    const cloud = await loadCloudState(CLOUD_KEY);
    if (cloud === undefined) return; // cloud unavailable → stay local
    if (cloud && typeof cloud === "object") {
      // Merge: keep the newer entry per quotation (local edits made offline win
      // if they're more recent).
      const local = readLocal();
      const merged = { ...local, ...cloud };
      Object.keys(local).forEach((id) => {
        const l = local[id];
        const c = cloud[id];
        if (c && l && (l.generatedAt || "") > (c.generatedAt || "")) merged[id] = l;
      });
      writeLocal(merged);
    } else {
      await saveCloudState(CLOUD_KEY, readLocal());
    }
  });
}

/** Full registry object: { [quotationId]: { docType, docUrl, generatedAt } }. */
export function loadDocRegistry() {
  init();
  return readLocal();
}

/** One quotation's record, or null. */
export function getDocRecord(quotationId) {
  if (!quotationId) return null;
  return loadDocRegistry()[quotationId] || null;
}

/**
 * Record a generated document for a quotation.
 * @param {string} quotationId
 * @param {{docType:"native"|"googledoc", docUrl?:string}} info
 */
export function recordDocument(quotationId, { docType, docUrl = "" }) {
  if (!quotationId || !docType) return;
  init();
  const registry = readLocal();
  registry[quotationId] = {
    docType,
    docUrl: docUrl || (docType === "googledoc" ? registry[quotationId]?.docUrl || "" : ""),
    generatedAt: new Date().toISOString(),
  };
  writeLocal(registry);
  if (cloudEnabled()) saveCloudState(CLOUD_KEY, registry);
}
