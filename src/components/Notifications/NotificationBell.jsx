import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { useNotifications } from "../../notifications/useNotifications";

const STATUS_CLASS = {
  Approved: "notif-status-approved",
  Declined: "notif-status-declined",
  Negotiated: "notif-status-negotiated",
};

function relativeTime(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(t).toLocaleDateString();
}

export default function NotificationBell({ compact = false }) {
  const { items, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) markAllRead();
  };

  return (
    <div className={`notif ${compact ? "notif-compact" : ""}`} ref={ref}>
      <button
        className="notif-bell"
        onClick={toggle}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        title="Notifications"
      >
        <Bell size={compact ? 18 : 19} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="notif-panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="notif-head">
              <span className="notif-title">Notifications</span>
              <div className="notif-head-actions">
                {items.length > 0 && (
                  <button className="notif-link" onClick={clearAll} title="Clear all">
                    <Trash2 size={13} /> Clear
                  </button>
                )}
                <button className="notif-close" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">
                  <CheckCheck size={22} />
                  <p>You're all caught up.</p>
                  <span>Status changes on your quotations show up here.</span>
                </div>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={`notif-item ${n.read ? "" : "is-unread"}`}>
                    <span className={`notif-dot ${STATUS_CLASS[n.status] || ""}`} />
                    <div className="notif-body">
                      <div className="notif-row1">
                        <span className={`notif-pill ${STATUS_CLASS[n.status] || ""}`}>
                          {n.status}
                        </span>
                        <span className="notif-qid">{n.quotationId}</span>
                      </div>
                      <div className="notif-meta">
                        {n.customer ? <strong>{n.customer}</strong> : <em>No customer name</em>}
                        {n.presetName ? <span> · {n.presetName}</span> : null}
                      </div>
                      <div className="notif-time">{relativeTime(n.time)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="notif-foot">
                <button className="notif-link" onClick={markAllRead}>
                  <Check size={13} /> Mark all as read
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
