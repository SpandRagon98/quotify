/**
 * Per-preset email template persistence (localStorage).
 * Templates are reusable across all rows of a preset.
 */

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.emailTemplates);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (err) {
    console.warn("Could not read email templates:", err);
  }
  return {};
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState(loadAll);

  const getTemplate = useCallback(
    (presetId) => templates[presetId] || null,
    [templates]
  );

  const saveTemplate = useCallback((presetId, template) => {
    setTemplates((prev) => {
      const next = { ...prev, [presetId]: template };
      try {
        localStorage.setItem(STORAGE_KEYS.emailTemplates, JSON.stringify(next));
      } catch (err) {
        console.warn("Could not persist email template:", err);
      }
      return next;
    });
  }, []);

  return { getTemplate, saveTemplate };
}
