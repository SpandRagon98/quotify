/**
 * Per-preset email template persistence.
 * Local-first with cloud sync when Supabase is configured (see cloudStore.js).
 * Templates are reusable across all rows of a preset.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";
import {
  startCloud,
  cloudEnabled,
  onCloudAuth,
  loadCloudState,
  saveCloudState,
} from "../lib/cloudStore";

const CLOUD_KEY = "email_templates";

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
  const templatesRef = useRef(templates);
  const hydratedRef = useRef(false);
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  // Hydrate from the cloud once a signed-in org is available.
  useEffect(() => {
    if (!cloudEnabled()) return undefined;
    startCloud();
    const off = onCloudAuth(async ({ orgId }) => {
      if (!orgId) {
        hydratedRef.current = false;
        return;
      }
      const cloud = await loadCloudState(CLOUD_KEY);
      if (cloud === undefined) return;
      if (cloud && typeof cloud === "object") {
        hydratedRef.current = true;
        setTemplates(cloud);
        try {
          localStorage.setItem(STORAGE_KEYS.emailTemplates, JSON.stringify(cloud));
        } catch {
          // ignore
        }
      } else {
        await saveCloudState(CLOUD_KEY, templatesRef.current);
        hydratedRef.current = true;
      }
    });
    return off;
  }, []);

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
      if (cloudEnabled() && hydratedRef.current) saveCloudState(CLOUD_KEY, next);
      return next;
    });
  }, []);

  return { getTemplate, saveTemplate };
}
