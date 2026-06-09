/**
 * Preset persistence.
 *
 * Local-first: renders instantly from a localStorage cache. When Supabase is
 * configured AND a user is signed in, presets hydrate from / write through to the
 * org's cloud row (multi-tenant, isolated by Row-Level Security). With no backend
 * configured it behaves exactly as before (localStorage only).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";
import { buildDefaultPresets } from "../data/defaultPresets";
import { normalizePreset } from "../utils/googleLinks";
import {
  startCloud,
  cloudEnabled,
  onCloudAuth,
  loadCloudState,
  saveCloudState,
} from "../lib/cloudStore";

const CLOUD_KEY = "presets";

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.presets);
    if (raw) {
      const parsed = JSON.parse(raw);
      // normalizePreset upgrades older shapes so they never crash the UI.
      if (Array.isArray(parsed)) return parsed.map(normalizePreset);
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
  const presetsRef = useRef(presets);
  const hydratedRef = useRef(false);

  // Persist locally on every change; mirror to the cloud once hydrated.
  useEffect(() => {
    presetsRef.current = presets;
    try {
      localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets));
    } catch (err) {
      console.warn("Could not persist presets:", err);
    }
    if (cloudEnabled() && hydratedRef.current) saveCloudState(CLOUD_KEY, presets);
  }, [presets]);

  // Hydrate from the cloud when the signed-in org becomes available.
  useEffect(() => {
    if (!cloudEnabled()) return undefined;
    startCloud();
    const off = onCloudAuth(async ({ orgId }) => {
      if (!orgId) {
        hydratedRef.current = false;
        return;
      }
      const cloud = await loadCloudState(CLOUD_KEY);
      if (cloud === undefined) return; // cloud unavailable → stay local
      if (Array.isArray(cloud)) {
        hydratedRef.current = true;
        setPresets(cloud.map(normalizePreset));
      } else {
        // No cloud row yet → migrate the current local presets up (one-time).
        await saveCloudState(CLOUD_KEY, presetsRef.current);
        hydratedRef.current = true;
      }
    });
    return off;
  }, []);

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
