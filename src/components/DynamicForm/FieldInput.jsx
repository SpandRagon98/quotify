import { memo } from "react";
import { isInputAllowed } from "../../utils/validation";

/**
 * Renders the correct control for a field type, with live input filtering.
 * `onChange(fieldId, value)` is called so a single stable parent callback can be
 * reused across every input — memoized so only the edited field re-renders.
 */
function FieldInput({ field, value, error, onChange, compact = false }) {
  const emit = (next) => onChange(field.id, next);
  const handle = (next) => {
    if (isInputAllowed(field, String(next))) emit(next);
  };

  const common = {
    className: `control ${error ? "control-error" : ""}`,
    placeholder: field.placeholder || "",
  };

  let control;
  switch (field.type) {
    case "longtext":
      control = (
        <textarea
          {...common}
          rows={4}
          value={value ?? ""}
          onChange={(e) => emit(e.target.value)}
        />
      );
      break;

    case "boolean":
      control = (
        <label className="switch">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => emit(e.target.checked)}
          />
          <span className="switch-track"><span className="switch-thumb" /></span>
          <span className="switch-text">{value ? "Yes" : "No"}</span>
        </label>
      );
      break;

    case "date":
      control = (
        <input
          {...common}
          type="date"
          value={value ?? ""}
          onChange={(e) => emit(e.target.value)}
        />
      );
      break;

    case "dropdown":
      control = (
        <select
          {...common}
          value={value ?? ""}
          onChange={(e) => emit(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
      break;

    case "number":
      control = (
        <input
          {...common}
          type="text"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => handle(e.target.value)}
        />
      );
      break;

    case "email":
      control = (
        <input
          {...common}
          type="email"
          value={value ?? ""}
          onChange={(e) => emit(e.target.value)}
        />
      );
      break;

    case "phone":
      control = (
        <input
          {...common}
          type="tel"
          value={value ?? ""}
          onChange={(e) => handle(e.target.value)}
        />
      );
      break;

    default: // text
      control = (
        <input
          {...common}
          type="text"
          value={value ?? ""}
          onChange={(e) => handle(e.target.value)}
        />
      );
  }

  return (
    <div
      className={`form-field ${field.type === "longtext" ? "form-field-wide" : ""} ${
        compact ? "form-field-compact" : ""
      }`}
    >
      <span className="form-label">
        {field.label}
        {field.required && <span className="req">*</span>}
      </span>
      {control}
      {error ? <span className="form-error">{error}</span> : null}
    </div>
  );
}

export default memo(FieldInput);
