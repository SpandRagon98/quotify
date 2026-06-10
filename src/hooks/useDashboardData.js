/**
 * Aggregates quotation metrics across every preset that has a linked Google
 * Sheet — the SAME source the Database tab reads. Computes totals, status counts
 * (Approved / Declined / Negotiated / Pending), and the latest quotation.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchPresetData, presetSheetId } from "../services/quotationService";
import { METADATA_COLUMNS } from "../config/appConfig";
import { useNotifications } from "../notifications/useNotifications";
import { trackedStatusByQuotation } from "../lib/quoteTracking";
import { resolveDecision } from "../utils/approvalStatus";

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

    const [results, trackedMap] = await Promise.all([
      Promise.allSettled(
        linked.map((p) => fetchPresetData(p).then((d) => ({ preset: p, ...d })))
      ),
      // Public approvals live in Supabase; overlay them onto the sheet rows so
      // the metrics reflect the latest decision (key: Quotation ID).
      trackedStatusByQuotation().catch(() => ({})),
    ]);

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
        const qid = qi !== -1 ? String(row[qi] ?? "").trim() : "";
        const decision = resolveDecision({
          sheetApproval: ai !== -1 ? row[ai] : "",
          sheetDecline: di !== -1 ? row[di] : "",
          sheetNegotiate: ni !== -1 ? row[ni] : "",
          trackedStatus: trackedMap[qid]?.status,
        });
        if (decision === "approved") agg.approved++;
        else if (decision === "declined") agg.declined++;
        else if (decision === "negotiate") agg.negotiated++;
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
