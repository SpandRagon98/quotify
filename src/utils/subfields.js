/**
 * Subfield helpers.
 *
 * A field may carry optional `subfields: [{ id, label, type, ... }]`. Subfields
 * are independent manual (or calculated) entries shown indented under their
 * parent in the form and as bullet rows in the native document. In the Google
 * Sheet / Database they become their own columns named "Parent - Sub".
 *
 * Values stay FLAT: both parent and subfield values are keyed by their own
 * unique field id in the same `values` object, so existing save/load logic keeps
 * working — only the column projection changes.
 */

/** Subfields of a field (always an array). */
export function getSubfields(field) {
  return Array.isArray(field?.subfields) ? field.subfields : [];
}

/** Sheet/placeholder column label for a subfield, e.g. "Total Cost - Bed Cost". */
export function subColumnLabel(parent, sub) {
  return `${parent.label} - ${sub.label}`;
}

/**
 * Ordered "leaf" projection of a preset's fields: each parent is emitted, then
 * its subfields, preserving document order. Used for sheet columns, exports,
 * row-mapping, validation and calculations.
 *
 * @returns {{ field:object, parent:(object|null), isSub:boolean, columnLabel:string, valueId:string }[]}
 */
export function flattenFields(fields = []) {
  const out = [];
  fields.forEach((f) => {
    out.push({ field: f, parent: null, isSub: false, columnLabel: f.label, valueId: f.id });
    getSubfields(f).forEach((s) => {
      out.push({
        field: s,
        parent: f,
        isSub: true,
        columnLabel: subColumnLabel(f, s),
        valueId: s.id,
      });
    });
  });
  return out;
}

/** Just the leaf field objects (parents + subfields) in document order. */
export function leafFields(fields = []) {
  return flattenFields(fields).map((l) => l.field);
}
