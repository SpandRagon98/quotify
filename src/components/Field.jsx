import { safeNumber } from "../utils/formatters";

export default function Field({ label, value, onChange, type = "text", readOnly = false }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) =>
          onChange(
            type === "number"
              ? e.target.value === ""
                ? ""
                : safeNumber(e.target.value)
              : e.target.value
          )
        }
      />
    </div>
  );
}
