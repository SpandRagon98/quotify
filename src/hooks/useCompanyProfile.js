/**
 * Per-preset company profile (uploaded logo + editable description), persisted to
 * localStorage. Shared by the Review document and the Doc View preview, and used
 * when generating the formatted Google Doc.
 *
 * Backward compatible: older entries stored just a logo data-URL string.
 */

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";

function normalizeEntry(entry) {
  if (typeof entry === "string") return { logo: entry, description: "" };
  if (entry && typeof entry === "object") {
    return { logo: entry.logo || "", description: entry.description || "" };
  }
  return { logo: "", description: "" };
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.companyLogos);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function useCompanyProfile(presetId) {
  const [store, setStore] = useState(loadAll);

  const profile = normalizeEntry(store[presetId]);

  const persist = (next) => {
    try {
      localStorage.setItem(STORAGE_KEYS.companyLogos, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const patch = useCallback(
    (changes) => {
      setStore((prev) => {
        const current = normalizeEntry(prev[presetId]);
        const next = { ...prev, [presetId]: { ...current, ...changes } };
        persist(next);
        return next;
      });
    },
    [presetId]
  );

  const setLogo = useCallback((logo) => patch({ logo }), [patch]);
  const setDescription = useCallback((description) => patch({ description }), [patch]);
  const clearLogo = useCallback(() => patch({ logo: "" }), [patch]);

  return { logo: profile.logo, description: profile.description, setLogo, setDescription, clearLogo };
}
