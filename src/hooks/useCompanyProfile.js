/**
 * Per-preset document config, persisted to localStorage. Shared by the Review
 * document, Doc View preview, the native PDF and email attachment.
 *
 * Shape: { logo, banner, description, hiddenFields: [fieldId], extraContent: [{id,label,value}] }
 * Backward compatible: older entries were a logo data-URL string or {logo,description}.
 */

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";

function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { logo: entry, banner: "", description: "", hiddenFields: [], extraContent: [] };
  }
  if (entry && typeof entry === "object") {
    return {
      logo: entry.logo || "",
      banner: entry.banner || "",
      description: entry.description || "",
      hiddenFields: Array.isArray(entry.hiddenFields) ? entry.hiddenFields : [],
      extraContent: Array.isArray(entry.extraContent) ? entry.extraContent : [],
    };
  }
  return { logo: "", banner: "", description: "", hiddenFields: [], extraContent: [] };
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

let counter = 0;
const extraId = () => `x_${Date.now().toString(36)}_${(counter++).toString(36)}`;

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
        const updated = typeof changes === "function" ? changes(current) : { ...current, ...changes };
        const next = { ...prev, [presetId]: updated };
        persist(next);
        return next;
      });
    },
    [presetId]
  );

  const setLogo = useCallback((logo) => patch({ logo }), [patch]);
  const clearLogo = useCallback(() => patch({ logo: "" }), [patch]);
  const setBanner = useCallback((banner) => patch({ banner }), [patch]);
  const clearBanner = useCallback(() => patch({ banner: "" }), [patch]);
  const setDescription = useCallback((description) => patch({ description }), [patch]);

  const toggleField = useCallback(
    (fieldId) =>
      patch((c) => {
        const hidden = c.hiddenFields.includes(fieldId)
          ? c.hiddenFields.filter((id) => id !== fieldId)
          : [...c.hiddenFields, fieldId];
        return { ...c, hiddenFields: hidden };
      }),
    [patch]
  );

  const addExtra = useCallback(
    () => patch((c) => ({ ...c, extraContent: [...c.extraContent, { id: extraId(), label: "", value: "" }] })),
    [patch]
  );
  const updateExtra = useCallback(
    (id, changes) =>
      patch((c) => ({
        ...c,
        extraContent: c.extraContent.map((x) => (x.id === id ? { ...x, ...changes } : x)),
      })),
    [patch]
  );
  const removeExtra = useCallback(
    (id) => patch((c) => ({ ...c, extraContent: c.extraContent.filter((x) => x.id !== id) })),
    [patch]
  );

  return {
    ...profile,
    setLogo, clearLogo, setBanner, clearBanner, setDescription,
    toggleField, addExtra, updateExtra, removeExtra,
  };
}
