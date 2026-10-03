import { useEffect, useEffectEvent, useId, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/** Generic animated modal with backdrop + Escape-to-close. */
export default function Modal({ open, title, onClose, children, footer, wide = false }) {
  const panel = useRef(null);
  const titleId = useId();
  const close = useEffectEvent(onClose);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => (panel.current?.querySelector('input:not([disabled]),textarea:not([disabled]),select:not([disabled])') || panel.current?.querySelector('button:not([disabled])'))?.focus());
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab") {
        const buttons = [...(panel.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]') || [])].filter((element) => element.offsetParent !== null);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            ref={panel}
            className={`modal ${wide ? "modal-wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.98, y: reduced ? 0 : 6, filter: reduced ? "none" : "blur(3px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1, y: reduced ? 0 : 4 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id={titleId}>{title}</h3>
              <button className="icon-btn" onClick={onClose} title="Close">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-foot">{footer}</div> : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
