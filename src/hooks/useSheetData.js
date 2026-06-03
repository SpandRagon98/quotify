/**
 * Shared Google Sheet loading for the Database and Email tabs.
 * Owns the selected preset + fetch lifecycle so both screens reuse one source.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchPresetData } from "../services/quotationService";

export function useSheetData(presets, initialPresetId) {
  const [presetId, setPresetId] = useState(initialPresetId || presets[0]?.id || "");
  const [data, setData] = useState({ headers: [], rows: [] });
  const [state, setState] = useState("idle"); // idle | loading | loaded | error | empty
  const [error, setError] = useState("");

  const preset = presets.find((p) => p.id === presetId) || null;
  const isLinked = Boolean(preset?.googleSheetUrl);

  const reload = useCallback(async () => {
    if (!preset) return;
    if (!preset.googleSheetUrl) {
      setState("idle");
      return;
    }
    setState("loading");
    setError("");
    try {
      const result = await fetchPresetData(preset);
      setData({ headers: result.headers || [], rows: result.rows || [] });
      setState((result.rows || []).length ? "loaded" : "empty");
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }, [preset]);

  // Auto-load when the active preset changes. Fetching a sheet is a legitimate
  // effect→external-system sync; reload() flips a loading flag internally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { presetId, setPresetId, preset, isLinked, data, state, error, reload };
}
