import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, CopyCheck } from "lucide-react";
import { fieldsToPlaceholders } from "../../utils/googleLinks";

/** Shows {{Field Name}} placeholders for a preset's fields, with copy buttons. */
export default function PlaceholderPanel({ fields }) {
  const placeholders = fieldsToPlaceholders(fields);
  const [copied, setCopied] = useState("");

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      // Clipboard may be blocked (e.g. insecure context) — fail quietly.
    }
  };

  const copyAll = () =>
    copy(placeholders.map((p) => p.token).join("\n"), "__all__");

  return (
    <div className="placeholder-panel">
      <div className="placeholder-head">
        <div>
          <h3>Google Doc placeholders</h3>
          <p className="form-hint">
            Use these tokens in your linked Google Doc. They map to entered field values.
          </p>
        </div>
        <button
          className="btn btn-soft"
          onClick={copyAll}
          disabled={placeholders.length === 0}
        >
          {copied === "__all__" ? <CopyCheck size={16} /> : <Copy size={16} />}
          Copy all
        </button>
      </div>

      {placeholders.length === 0 ? (
        <div className="empty-inline">Add fields to generate placeholders.</div>
      ) : (
        <div className="placeholder-list">
          <AnimatePresence initial={false}>
            {placeholders.map((p) => (
              <motion.div
                key={p.id}
                className="placeholder-chip"
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <code>{p.token}</code>
                <button
                  className="chip-copy"
                  title={`Copy ${p.token}`}
                  onClick={() => copy(p.token, p.id)}
                >
                  {copied === p.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
