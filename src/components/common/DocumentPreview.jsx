import { useRef, useState } from "react";
import { Upload, X, Copy, Check } from "lucide-react";
import Logo from "./Logo";
import { APP } from "../../config/appConfig";
import { formatFieldValue } from "../../utils/fieldFormatters";
import { computeCalculatedValues, formatCalculated } from "../../utils/formula";

/**
 * Document-style preview of a quotation/preset. Presentational — the company
 * logo + description are controlled by the parent (so they can also be sent to
 * the formatted Google Doc generator).
 *
 * - mode "data"     → shows entered values (used in Review).
 * - mode "template" → shows {{Field Name}} placeholders (used in Doc View).
 *
 * Theme-aware (glassmorphic), responsive. One table row per preset field; long
 * values wrap and grow the row.
 */
export default function DocumentPreview({
  preset,
  values,
  quotationId,
  mode = "data",
  logo = "",
  description = "",
  onLogoChange,
  onLogoClear,
  onDescriptionChange,
}) {
  const [copied, setCopied] = useState("");
  const fileRef = useRef(null);

  const isTemplate = mode === "template" || !values;
  const calc = isTemplate ? {} : computeCalculatedValues(preset, values);

  const cellValue = (field) => {
    if (isTemplate) return `{{${field.label}}}`;
    if (field.calculated) return formatCalculated(calc[field.id], field);
    return formatFieldValue(field, values[field.id]);
  };

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Please choose an image under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLogoChange?.(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(token);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      // clipboard may be blocked
    }
  };

  return (
    <div className="doc-paper">
      <div className="doc-paper-head">
        <div className="doc-brand">
          <span className="doc-brand-mark"><Logo size={28} /></span>
          <span className="doc-brand-name">{APP.name}</span>
        </div>

        <div className="doc-logo-slot">
          <button className="btn btn-soft btn-xs doc-upload-btn" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {logo ? "Change logo" : "Upload Logo"}
          </button>
          {logo ? (
            <div className="doc-company-logo">
              <img src={logo} alt="Company logo" />
              <button className="doc-logo-remove" title="Remove logo" onClick={() => onLogoClear?.()}>
                <X size={14} />
              </button>
            </div>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickLogo} />
        </div>
      </div>

      {/* Editable company description (shown above quotation number) */}
      <textarea
        className="doc-description"
        value={description}
        rows={2}
        placeholder="Company description (editable) — appears in the generated document…"
        onChange={(e) => onDescriptionChange?.(e.target.value)}
      />

      <div className="doc-quote-no">
        Quotation No.{" "}
        <strong>{quotationId || (isTemplate ? "{{Quotation ID}}" : "Generated on save")}</strong>
        <span className="doc-quote-preset">{preset.name}</span>
      </div>

      <table className="doc-table">
        <thead>
          <tr>
            <th className="doc-col-field">Field Name</th>
            <th className="doc-col-value">{isTemplate ? "Placeholder" : "Value"}</th>
          </tr>
        </thead>
        <tbody>
          {preset.fields.map((field) => {
            const value = cellValue(field);
            return (
              <tr key={field.id}>
                <td className="doc-field">{field.label}</td>
                <td className="doc-value">
                  {isTemplate ? (
                    <button
                      className="doc-token"
                      title={`Copy ${value}`}
                      onClick={() => copyToken(value)}
                    >
                      <code>{value}</code>
                      {copied === value ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  ) : (
                    value
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
