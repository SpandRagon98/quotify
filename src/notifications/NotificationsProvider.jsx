import { useEffect, useRef } from "react";
import { NotificationsContext, useNotificationsStore } from "./useNotifications";
import { cloudEnabled, onCloudAuth } from "../lib/cloudStore";
import { listTrackedQuotes } from "../lib/quoteTracking";

// DB statuses worth notifying about, with the label shown on the bell pill.
const DB_STATUS_LABEL = {
  viewed: "Viewed",
  approved: "Accepted",
  declined: "Declined",
  negotiate: "Changes requested",
  expired: "Expired",
};

const POLL_MS = 45000;

/**
 * Provides the persistent notification store and — in cloud mode — watches the
 * tracked_quotes table for real status changes (viewed / accepted / declined /
 * changes / expired), firing notifications on actual DB transitions instead of
 * diffing spreadsheet columns. Polls on an interval and on tab focus.
 */
export default function NotificationsProvider({ children }) {
  const store = useNotificationsStore();
  const addNotificationRef = useRef(store.addNotification);
  useEffect(() => {
    addNotificationRef.current = store.addNotification;
  }, [store.addNotification]);

  useEffect(() => {
    if (!cloudEnabled()) return undefined;

    let orgId = null;
    let timer = null;
    const baseline = new Map(); // quoteId -> last seen status
    let seeded = false;

    const poll = async () => {
      if (!orgId) return;
      const rows = await listTrackedQuotes();
      const firstPass = !seeded;
      rows.forEach((q) => {
        const prev = baseline.get(q.id);
        baseline.set(q.id, q.status);
        if (firstPass) return; // seed silently on the first poll
        if (prev !== undefined && prev !== q.status && DB_STATUS_LABEL[q.status]) {
          addNotificationRef.current({
            id: `tq-${q.id}-${q.status}-${q.updated_at || ""}`,
            quotationId: q.quotation_id || "(untitled)",
            customer: q.recipient_email || "",
            status: DB_STATUS_LABEL[q.status],
            presetName: q.preset_name || "",
            time: q.updated_at || new Date().toISOString(),
          });
        }
      });
      seeded = true;
    };

    const start = () => {
      if (timer) return;
      poll();
      timer = setInterval(poll, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onFocus = () => poll();

    const off = onCloudAuth(({ orgId: id }) => {
      orgId = id;
      if (id) {
        start();
      } else {
        stop();
        baseline.clear();
        seeded = false;
      }
    });

    window.addEventListener("focus", onFocus);
    return () => {
      off();
      stop();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <NotificationsContext.Provider value={store}>
      {children}
    </NotificationsContext.Provider>
  );
}
