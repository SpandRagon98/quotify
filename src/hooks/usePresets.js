/**
 * Preset persistence via localStorage.
 * Encapsulated in a hook so it can later be swapped for an API-backed store
 * without touching the components that consume it.
 */

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";
import { buildDefaultPresets } from "../data/defaultPresets";

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.presets);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Could not read presets from storage:", err);
  }
  // First run (or corrupt data): seed sample presets.
  const seeded = buildDefaultPresets();
  try {
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(seeded));
  } catch (err) {
    console.warn("Could not seed presets:", err);
  }
  return seeded;
}

export function usePresets() {
  const [presets, setPresets] = useState(loadPresets);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets));
    } catch (err) {
      console.warn("Could not persist presets:", err);
    }
  }, [presets]);

  const savePreset = useCallback((preset) => {
    const stamped = { ...preset, updatedAt: new Date().toISOString() };
    setPresets((prev) => {
      const exists = prev.some((p) => p.id === stamped.id);
      return exists
        ? prev.map((p) => (p.id === stamped.id ? stamped : p))
        : [...prev, stamped];
    });
    return stamped;
  }, []);

  const deletePreset = useCallback((id) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const getPreset = useCallback(
    (id) => presets.find((p) => p.id === id) || null,
    [presets]
  );

  return { presets, savePreset, deletePreset, getPreset };
}
