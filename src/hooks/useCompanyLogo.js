/**
 * Per-preset uploaded company logo (data URL), persisted to localStorage so the
 * same logo shows in both the Review document and the Doc View preview.
 */

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";

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

export function useCompanyLogo(presetId) {
  const [logos, setLogos] = useState(loadAll);

  const persist = (next) => {
    try {
      localStorage.setItem(STORAGE_KEYS.companyLogos, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const setLogo = useCallback(
    (dataUrl) => {
      setLogos((prev) => {
        const next = { ...prev, [presetId]: dataUrl };
        persist(next);
        return next;
      });
    },
    [presetId]
  );

  const clearLogo = useCallback(() => {
    setLogos((prev) => {
      const next = { ...prev };
      delete next[presetId];
      persist(next);
      return next;
    });
  }, [presetId]);

  return { logo: logos[presetId] || "", setLogo, clearLogo };
}
