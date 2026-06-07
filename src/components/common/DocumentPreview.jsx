import { Fragment, useRef, useState } from "react";
import { Upload, X, Copy, Check, EyeOff, RotateCcw, Plus, Image as ImageIcon } from "lucide-react";
import Logo from "./Logo";
import { APP } from "../../config/appConfig";
import { formatFieldValue } from "../../utils/fieldFormatters";
import { computeCalculatedValues, formatCalculated } from "../../utils/formula";
import { buildDocPlaceholderMap, replaceDocPlaceholders } from "../../utils/docPlaceholders";
import { flattenFields, getSubfields, subColumnLabel } from "../../utils/subfields";

function makePicker(onPick) {
  return (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.8 * 1024 * 1024) {
      alert("Please choose an image under 1.8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onPick?.(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  };
}

/**
 * Native Qyrova document. `editMeta` enables logo/banner/description editing
 * (Review + Doc View); `editFields` enables hiding fields + extra content
 * (Doc View). With both false it renders a clean read-only document (for the
 * PDF / email attachment) with placeholders replaced.
 */
export default function DocumentPreview({
  preset,
  values,
  quotationId,
  mode = "data",
  logo = "",
  banner = "",
  description = "",
  hiddenFields = [],
  extraContent = [],
  editMeta = false,
  editFields = false,
  onLogoChange,
  onLogoClear,
  onBannerChange,
  onBannerClear,
  onDescriptionChange,
  onToggleField,
  onAddExtra,
  onUpdateExtra,
  onRemoveExtra,
}) {
  const [copied, setCopied] = useState("");
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const isTemplate = mode === "template" || !values;
  const calc = isTemplate ? {} : computeCalculatedValues(preset, values);
  const placeholderMap = buildDocPlaceholderMap(preset, values, quotationId);

  // All hidden leaves (parent fields + subfields) for the restore panel.
  const hiddenLeaves = flattenFields(preset.fields).filter((l) =>
    hiddenFields.includes(l.valueId)
  );

  const cellValue = (field, columnLabel) => {
    if (isTemplate) return `{{${columnLabel}}}`;
    if (field.calculated) return formatCalculated(calc[field.id], field);
    return formatFieldValue(field, values[field.id]);
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

  const renderedDescription = isTemplate ? description : replaceDocPlaceholders(description, placeholderMap);

  return (
    <div className="doc-paper">
      {/* Logo row */}
      <div className="doc-paper-head">
        <div className="doc-brand">
          <span className="doc-brand-mark"><Logo size={17} /></span>
          <span className="doc-brand-name">{APP.name}</span>
        </div>

        <div className="doc-logo-slot">
          {logo ? (
            <div className="doc-company-logo">
              <img src={logo} alt="Company logo" />
              {editMeta && (
                <button className="doc-logo-remove" title="Remove logo" onClick={() => onLogoClear?.()}>
                  <X size={12} />
                </button>
              )}
            </div>
          ) : null}
          {editMeta && (
            <>
              <button className="btn btn-soft btn-xs doc-upload-btn" onClick={() => logoInputRef.current?.click()}>
                <Upload size={14} /> {logo ? "Change logo" : "Upload Logo"}
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={makePicker(onLogoChange)} />
            </>
          )}
        </div>
      </div>

      {/* Optional full-width banner (between logo row and description) */}
      {banner ? (
        <div className="doc-banner">
          <img src={banner} alt="Banner" />
          {editMeta && (
            <button className="doc-banner-remove" title="Remove banner" onClick={() => onBannerClear?.()}>
              <X size={14} />
            </button>
          )}
        </div>
      ) : editMeta ? (
        <div className="doc-banner-add">
          <button className="btn btn-soft btn-xs" onClick={() => bannerInputRef.current?.click()}>
            <ImageIcon size={14} /> Add banner
          </button>
          <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={makePicker(onBannerChange)} />
        </div>
      ) : null}

      {/* Company description (placeholders supported) */}
      {editMeta ? (
        <textarea
          className="doc-description"
          value={description}
          rows={2}
          placeholder="Company description — supports {{Customer Name}}, {{Quotation Number}}…"
          onChange={(e) => onDescriptionChange?.(e.target.value)}
        />
      ) : renderedDescription ? (
        <p className="doc-description-text">{renderedDescription}</p>
      ) : null}

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
            if (hiddenFields.includes(field.id)) return null; // parent hidden → hide its subfields too
            const value = cellValue(field, field.label);
            const subs = getSubfields(field);
            return (
              <Fragment key={field.id}>
                <tr>
                  <td className="doc-field">{field.label}</td>
                  <td className="doc-value">
                    <span className="doc-value-inner">
                      {isTemplate ? (
                        <button className="doc-token" title={`Copy ${value}`} onClick={() => copyToken(value)}>
                          <code>{value}</code>
                          {copied === value ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      ) : (
                        value
                      )}
                    </span>
                    {editFields && (
                      <button className="doc-hide-btn" title="Hide from document" onClick={() => onToggleField?.(field.id)}>
                        <EyeOff size={14} />
                      </button>
                    )}
                  </td>
                </tr>

                {subs.map((sub) => {
                  if (hiddenFields.includes(sub.id)) return null;
                  const colLabel = subColumnLabel(field, sub);
                  const subVal = cellValue(sub, colLabel);
                  return (
                    <tr key={sub.id} className="doc-subrow">
                      <td className="doc-field doc-subfield">
                        <span className="doc-sub-bullet">•</span>
                        {sub.label}
                      </td>
                      <td className="doc-value doc-subvalue">
                        <span className="doc-value-inner">
                          {isTemplate ? (
                            <button className="doc-token" title={`Copy ${subVal}`} onClick={() => copyToken(subVal)}>
                              <code>{subVal}</code>
                              {copied === subVal ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          ) : (
                            subVal
                          )}
                        </span>
                        {editFields && (
                          <button className="doc-hide-btn" title="Hide from document" onClick={() => onToggleField?.(sub.id)}>
                            <EyeOff size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Restore hidden fields / subfields (Doc View edit) */}
      {editFields && hiddenLeaves.length > 0 && (
        <div className="doc-hidden-panel">
          <span className="doc-hidden-label">Hidden fields</span>
          <div className="doc-hidden-list">
            {hiddenLeaves.map((l) => (
              <button key={l.valueId} className="doc-restore-chip" onClick={() => onToggleField?.(l.valueId)}>
                <RotateCcw size={12} /> {l.columnLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extra custom content */}
      {(extraContent.length > 0 || editFields) && (
        <div className="doc-extra">
          {(editFields ? extraContent : extraContent.filter((x) => x.label || x.value)).map((item) =>
            editFields ? (
              <div className="doc-extra-edit" key={item.id}>
                <input
                  className="control"
                  value={item.label}
                  placeholder="Label (e.g. Terms, Address, Notes)"
                  onChange={(e) => onUpdateExtra?.(item.id, { label: e.target.value })}
                />
                <textarea
                  className="control"
                  rows={2}
                  value={item.value}
                  placeholder="Content — text, number, address, notes…"
                  onChange={(e) => onUpdateExtra?.(item.id, { value: e.target.value })}
                />
                <button className="icon-btn icon-btn-danger" title="Remove" onClick={() => onRemoveExtra?.(item.id)}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="doc-extra-item" key={item.id}>
                {item.label ? <div className="doc-extra-title">{item.label}</div> : null}
                <div className="doc-extra-value">{replaceDocPlaceholders(item.value, placeholderMap)}</div>
              </div>
            )
          )}
          {editFields && (
            <button className="btn btn-soft btn-xs doc-extra-add" onClick={() => onAddExtra?.()}>
              <Plus size={14} /> Add content
            </button>
          )}
        </div>
      )}
    </div>
  );
}
