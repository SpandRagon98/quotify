/**
 * Aggregates quotation metrics across every preset that has a linked Google
 * Sheet — the SAME source the Database tab reads. Computes totals, status counts
 * (Approved / Declined / Negotiated / Pending), and the latest quotation.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchPresetData, presetSheetId } from "../services/quotationService";
import { METADATA_COLUMNS } from "../config/appConfig";
import { useNotifications } from "../notifications/useNotifications";

const EMPTY = { total: 0, approved: 0, declined: 0, negotiated: 0, pending: 0, latest: null };

export function useDashboardData(presets) {
  const [state, setState] = useState("idle"); // idle | loading | loaded | empty | error
  const [error, setError] = useState("");
  const [stats, setStats] = useState(EMPTY);
  const { ingest } = useNotifications();

  const load = useCallback(async () => {
    const linked = presets.filter((p) => presetSheetId(p));
    if (linked.length === 0) {
      setStats(EMPTY);
      setState("empty");
      return;
    }

    setState("loading");
    setError("");

    const results = await Promise.allSettled(
      linked.map((p) => fetchPresetData(p).then((d) => ({ preset: p, ...d })))
    );

    const agg = { ...EMPTY };
    let anyOk = false;
    let firstError = "";

    results.forEach((r) => {
      if (r.status !== "fulfilled") {
        if (!firstError) firstError = r.reason?.message || "Failed to load data";
        return;
      }
      anyOk = true;
      const { preset, headers, rows } = r.value;
      ingest(preset.name, headers, rows);
      const idx = (name) => headers.indexOf(name);
      const ai = idx("Approval");
      const di = idx("Decline");
      const ni = idx("Negotiate");
      const qi = idx(METADATA_COLUMNS[0]); // Quotation ID
      const ci = idx(METADATA_COLUMNS[2]); // Created At

      rows.forEach((row) => {
        agg.total++;
        const a = ai !== -1 && String(row[ai] ?? "").trim();
        const d = di !== -1 && String(row[di] ?? "").trim();
        const n = ni !== -1 && String(row[ni] ?? "").trim();
        if (a) agg.approved++;
        else if (d) agg.declined++;
        else if (n) agg.negotiated++;
        else agg.pending++;

        const created = ci !== -1 ? row[ci] : "";
        if (created && (!agg.latest || String(created) > String(agg.latest.createdAt))) {
          agg.latest = {
            quotationId: qi !== -1 ? String(row[qi] ?? "") : "",
            presetName: preset.name,
            createdAt: created,
          };
        }
      });
    });

    setStats(agg);
    if (!anyOk && firstError) {
      setError(firstError);
      setState("error");
    } else {
      setError(firstError); // partial-failure note (some presets loaded)
      setState(agg.total > 0 ? "loaded" : "empty");
    }
  }, [presets, ingest]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { state, error, stats, reload: load };
}
