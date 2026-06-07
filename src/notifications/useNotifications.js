/**
 * Notification store (context). Detects when a quotation's status changes to
 * Approved / Declined / Negotiated by diffing the linked Google Sheet data
 * against a persisted baseline, and records a persistent notification.
 *
 * Detection happens whenever a tab fetches sheet data (Dashboard/Database/Email)
 * — there's no real-time backend, so the app notices changes on the next read.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { STORAGE_KEYS } from "../config/appConfig";

const STATUS_LABEL = { Approved: "Approved", Declined: "Declined", Negotiate: "Negotiated" };

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return fallback;
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

const NotificationsContext = createContext({
  items: [],
  unreadCount: 0,
  ingest: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function useNotificationsStore() {
  const [items, setItems] = useState(() => load(STORAGE_KEYS.notifications, []));
  const seenRef = useRef(load(STORAGE_KEYS.notifSeen, {}));

  const ingest = useCallback((presetName, headers, rows) => {
    if (!Array.isArray(headers) || !Array.isArray(rows)) return;
    const at = headers.indexOf("Approval");
    const dt = headers.indexOf("Decline");
    const nt = headers.indexOf("Negotiate");
    const qi = headers.indexOf("Quotation ID");
    const ui = headers.indexOf("Last Updated At");
    const nameCol = headers.findIndex((h) => /customer\s*name|client\s*name|^name$/i.test(h));
    if (qi === -1 || (at === -1 && dt === -1 && nt === -1)) return;

    const seen = seenRef.current;
    const nextSeen = { ...seen };
    const fresh = [];

    rows.forEach((row) => {
      const qid = String(row[qi] ?? "").trim();
      if (!qid) return;
      const a = at !== -1 && String(row[at] ?? "").trim();
      const d = dt !== -1 && String(row[dt] ?? "").trim();
      const n = nt !== -1 && String(row[nt] ?? "").trim();
      const status = a ? "Approved" : d ? "Declined" : n ? "Negotiate" : "";
      const prev = seen[qid];
      if (prev === undefined) {
        nextSeen[qid] = status; // seed baseline silently (no notification)
        return;
      }
      if (status && status !== prev) {
        fresh.push({
          id: `${qid}-${status}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          quotationId: qid,
          customer: nameCol !== -1 ? String(row[nameCol] ?? "") : "",
          status: STATUS_LABEL[status] || status,
          presetName: presetName || "",
          time: ui !== -1 && row[ui] ? row[ui] : new Date().toISOString(),
          read: false,
        });
      }
      nextSeen[qid] = status;
    });

    seenRef.current = nextSeen;
    save(STORAGE_KEYS.notifSeen, nextSeen);

    if (fresh.length) {
      setItems((prev) => {
        const next = [...fresh, ...prev].slice(0, 60);
        save(STORAGE_KEYS.notifications, next);
        return next;
      });
    }
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((i) => ({ ...i, read: true }));
      save(STORAGE_KEYS.notifications, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    save(STORAGE_KEYS.notifications, []);
  }, []);

  const unreadCount = items.reduce((n, i) => n + (i.read ? 0 : 1), 0);

  return { items, unreadCount, ingest, markAllRead, clearAll };
}

export { NotificationsContext };
