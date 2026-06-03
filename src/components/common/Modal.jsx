import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/** Generic animated modal with backdrop + Escape-to-close. */
export default function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
            className="modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3>{title}</h3>
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
