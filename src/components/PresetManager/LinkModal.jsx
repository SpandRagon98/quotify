import { useState } from "react";
import { AlertCircle } from "lucide-react";
import Modal from "../common/Modal";
import { isGoogleSheetUrl, isGoogleDocUrl, extractId } from "../../utils/googleLinks";

/**
 * Modal to paste/update a Google Sheet or Doc URL for a preset.
 * @param {"sheet"|"doc"} kind
 * @param {string} initialUrl
 * @param {(result:{url:string,id:string}) => void} onSave
 */
export default function LinkModal({ open, kind, initialUrl = "", onClose, onSave }) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");

  const isSheet = kind === "sheet";
  const label = isSheet ? "Google Sheet" : "Google Doc";
  const validate = isSheet ? isGoogleSheetUrl : isGoogleDocUrl;
  const example = isSheet
    ? "https://docs.google.com/spreadsheets/d/…"
    : "https://docs.google.com/document/d/…";

  const handleSave = () => {
    const trimmed = url.trim();
    if (!validate(trimmed)) {
      setError(`Please enter a valid ${label} URL.`);
      return;
    }
    onSave({ url: trimmed, id: extractId(trimmed) });
  };

  return (
    <Modal
      open={open}
      title={`Link ${label}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Link</button>
        </>
      }
    >
      <label className="form-field">
        <span className="form-label">{label} URL</span>
        <input
          className={`control ${error ? "control-error" : ""}`}
          value={url}
          placeholder={example}
          autoFocus
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        {error ? (
          <span className="form-error"><AlertCircle size={13} /> {error}</span>
        ) : (
          <span className="form-hint">Paste the share link of your {label}.</span>
        )}
      </label>
    </Modal>
  );
}
