export function parseCsv(text) {
  if (text.length > 2 * 1024 * 1024) throw new Error("CSV must be under 2 MB.");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV contains an unfinished quoted value.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2)
    throw new Error("CSV requires a header and at least one enquiry.");
  const headers = rows
    .shift()
    .map((h, i) => h.trim().replace(/^\uFEFF/, "") || `Column ${i + 1}`);
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV headers must be unique.");
  if (rows.length > 1000)
    throw new Error("Import up to 1,000 enquiries per file.");
  if (rows.some((r) => r.length !== headers.length))
    throw new Error(
      "CSV rows must have the same number of columns as the header.",
    );
  return { headers, rows };
}
export function csvText(records) {
  const keys = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const escape = (value) => {
    let s =
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    keys.map(escape).join(","),
    ...records.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\r\n");
}
export function downloadCsv(records, name) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csvText(records)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `qyrova-${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
