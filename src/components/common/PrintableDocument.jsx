import Logo from "./Logo";
import { APP } from "../../config/appConfig";
import { formatFieldValue } from "../../utils/fieldFormatters";
import { computeCalculatedValues, formatCalculated } from "../../utils/formula";

/**
 * Read-only, print-optimized rendering of the native Qyrova document.
 * Mounted into a portal and only visible during printing (see .print-area in
 * global.css). Uses the browser's own renderer, so the saved PDF matches the
 * in-app preview (on a clean solid background — no glass blur, which doesn't
 * print well anyway).
 */
export default function PrintableDocument({ preset, values, quotationId, logo, description }) {
  const calc = computeCalculatedValues(preset, values);
  const cell = (f) =>
    f.calculated ? formatCalculated(calc[f.id], f) : formatFieldValue(f, values[f.id]);

  return (
    <div className="print-doc">
      <div className="print-doc-head">
        <div className="print-brand">
          <span className="print-brand-mark"><Logo size={26} /></span>
          <span className="print-brand-name">{APP.name}</span>
        </div>
        {logo ? <img className="print-company-logo" src={logo} alt="" /> : null}
      </div>

      {description ? <p className="print-desc">{description}</p> : null}

      <div className="print-quote-no">
        Quotation No. <strong>{quotationId || "—"}</strong>
        <span className="print-preset">{preset.name}</span>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>Field Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {preset.fields.map((f) => (
            <tr key={f.id}>
              <td className="print-field">{f.label}</td>
              <td className="print-value">{cell(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
