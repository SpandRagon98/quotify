/**
 * App appearance settings: theme mode (light/dark/glass) + accent color.
 * Persisted to localStorage and applied to <html data-theme data-accent>.
 */

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";

/** Supported theme modes. Anything else falls back to light. */
const MODES = ["light", "dark", "glass"];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: MODES.includes(parsed.mode) ? parsed.mode : "light",
        accent: parsed.accent || "indigo",
      };
    }
  } catch {
    // ignore
  }
  return { mode: "light", accent: "indigo" };
}

export function useSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = settings.mode;
    el.dataset.accent = settings.accent;
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const setMode = (mode) => setSettings((s) => ({ ...s, mode }));
  const setAccent = (accent) => setSettings((s) => ({ ...s, accent }));
  const toggleMode = () =>
    setSettings((s) => ({ ...s, mode: s.mode === "dark" ? "light" : "dark" }));

  return { settings, setMode, setAccent, toggleMode };
}
