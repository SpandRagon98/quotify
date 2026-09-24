import { findAccountByName, getRecord, rpc, saveRecord } from "./service";
import { leadFormFields, leadPayload } from "./leadForm";

export const LEAD_ID_HEADER = "Lead ID";
export const LEAD_STATUS_HEADER = "Lead status";
export const LEAD_STATUS_OPTIONS = ["New", "In Progress", "Accept", "Reject"];

async function ExcelJS() {
  const module = await import("exceljs");
  return module.default || module;
}

function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if (value.text != null) return String(value.text);
    if (value.result != null) return cellText(value.result);
    if (value.hyperlink != null) return String(value.text || value.hyperlink);
  }
  return String(value).trim();
}

function columnLetter(index) {
  let value = index;
  let output = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function download(buffer, filename) {
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadLeadExcelTemplate(config) {
  const Excel = await ExcelJS();
  const workbook = new Excel.Workbook();
  workbook.creator = "Qyrova CRM";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });
  const lists = workbook.addWorksheet("Lists");
  lists.state = "veryHidden";
  const fields = leadFormFields(config);
  const headers = [LEAD_ID_HEADER, ...fields.map((field) => field.label), LEAD_STATUS_HEADER];
  sheet.addRow(headers);
  sheet.autoFilter = { from: "A1", to: `${columnLetter(headers.length)}1` };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3B4D" } };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.getRow(1).height = 24;
  sheet.getColumn(1).width = 38;
  sheet.getColumn(1).hidden = true;
  fields.forEach((field, index) => {
    const column = index + 2;
    sheet.getColumn(column).width = Math.min(36, Math.max(16, field.label.length + 5));
    if (field.type === "textarea") sheet.getColumn(column).width = 42;
    if (field.required) {
      sheet.getCell(1, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9D174D" } };
      sheet.getCell(1, column).note = "Required for a new lead";
    }
  });
  const statusColumn = headers.length;
  sheet.getColumn(statusColumn).width = 18;
  sheet.getCell(1, statusColumn).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9D174D" } };
  sheet.getCell(1, statusColumn).note = "Required for every imported row. Accept creates or reuses the account, creates the contact, and creates an opportunity. Reject marks the lead Unqualified. In Progress marks it Contacted.";
  lists.getColumn(1).width = 18;
  LEAD_STATUS_OPTIONS.forEach((status, index) => lists.getCell(index + 1, 1).value = status);
  sheet.dataValidations.add(`${columnLetter(statusColumn)}2:${columnLetter(statusColumn)}1001`, {
    type: "list",
    allowBlank: true,
    formulae: ["'Lists'!$A$1:$A$4"],
    showErrorMessage: true,
    errorTitle: "Choose a lead status",
    error: "Use the dropdown: New, In Progress, Accept, or Reject.",
  });
  let listColumn = 2;
  fields.forEach((field, index) => {
    if (field.type !== "select" || field.options.length === 0) return;
    field.options.forEach((option, optionIndex) => lists.getCell(optionIndex + 1, listColumn).value = option);
    sheet.dataValidations.add(`${columnLetter(index + 2)}2:${columnLetter(index + 2)}1001`, {
      type: "list",
      allowBlank: !field.required,
      formulae: [`'Lists'!$${columnLetter(listColumn)}$1:$${columnLetter(listColumn)}$${field.options.length}`],
      showErrorMessage: true,
    });
    listColumn += 1;
  });
  const guide = workbook.addWorksheet("Instructions");
  guide.columns = [{ width: 28 }, { width: 95 }];
  guide.addRows([
    ["Qyrova lead import", "Use the Leads sheet to add new leads or update an exported lead."],
    ["New lead", "Leave Lead ID blank. Name and Company are required."],
    ["Update a lead", "Enter its Lead ID, change only the values you want to update, then choose a Lead status."],
    ["Accept", "Converts the lead: Qyrova reuses a same-named account when available, then creates the account/contact relationship and opportunity."],
    ["Reject", "Keeps the lead record and changes its CRM status to Unqualified."],
    ["In Progress", "Keeps the lead record and changes its CRM status to Contacted."],
  ]);
  guide.getColumn(1).font = { bold: true };
  guide.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3B4D" } };
  guide.eachRow((row) => row.alignment = { vertical: "top", wrapText: true });
  const buffer = await workbook.xlsx.writeBuffer();
  download(buffer, "qyrova-lead-import-template.xlsx");
}

export async function readLeadExcel(file, config) {
  const Excel = await ExcelJS();
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("Leads") || workbook.worksheets[0];
  if (!sheet) throw new Error("This workbook does not contain a Leads sheet.");
  const headers = sheet.getRow(1).values.slice(1).map(cellText);
  const expected = [LEAD_ID_HEADER, ...leadFormFields(config).map((field) => field.label), LEAD_STATUS_HEADER];
  const unknown = headers.filter((header) => header && !expected.includes(header));
  if (unknown.length) throw new Error(`This file has unrecognized column(s): ${unknown.join(", ")}. Download a fresh template after changing the form.`);
  for (const header of [LEAD_ID_HEADER, "Name", "Company", LEAD_STATUS_HEADER])
    if (!headers.includes(header)) throw new Error(`Missing required column: ${header}. Download a fresh template after changing the form.`);
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index + 1]));
  const fields = leadFormFields(config);
  const rows = [];
  const errors = [];
  for (let number = 2; number <= sheet.actualRowCount; number += 1) {
    const row = sheet.getRow(number);
    const cells = Object.fromEntries(headers.map((header) => [header, cellText(row.getCell(headerIndex[header]).value)]));
    if (!Object.values(cells).some(Boolean)) continue;
    const values = Object.fromEntries(fields.map((field) => [field.key, cells[field.label]]));
    const leadId = cells[LEAD_ID_HEADER];
    const leadStatus = cells[LEAD_STATUS_HEADER];
    const invalidStatus = leadStatus && !LEAD_STATUS_OPTIONS.some((option) => option.toLowerCase() === leadStatus.toLowerCase());
    if (!leadStatus) errors.push(`Row ${number}: choose a Lead status from the dropdown.`);
    if (invalidStatus) errors.push(`Row ${number}: Lead status must be New, In Progress, Accept, or Reject.`);
    if (!leadId && (!values.name || !values.company_name)) errors.push(`Row ${number}: Name and Company are required for a new lead.`);
    rows.push({ number, leadId, leadStatus, values });
  }
  if (rows.length === 0) throw new Error("There are no lead rows to import.");
  if (rows.length > 250) throw new Error("Import up to 250 rows at a time.");
  return { rows, errors };
}

function statusAction(value) {
  const normalized = String(value || "New").trim().toLowerCase();
  if (normalized === "accept") return { convert: true };
  if (normalized === "reject") return { status: "Unqualified" };
  if (normalized === "in progress") return { status: "Contacted" };
  return { status: "New" };
}

export async function importLeadRows(rows, config, env, onProgress) {
  const result = { created: 0, updated: 0, accepted: 0, rejected: 0, inProgress: 0, errors: [] };
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    onProgress?.(index + 1, rows.length);
    try {
      const existing = row.leadId ? await getRecord("leads", env.user.orgId, row.leadId) : null;
      const patch = leadPayload(row.values, config);
      const action = statusAction(row.leadStatus);
      if (existing?.converted_at && !action.convert)
        throw new Error("This lead is already converted and its status cannot be changed.");
      if (!existing && (!patch.name || !patch.company_name))
        throw new Error("Name and Company are required for a new lead.");
      const payload = {
        ...(existing ? {} : { owner_id: env.user.id, source: "Excel import", stage: "Enquiry", priority: "Normal" }),
        ...patch,
        custom_fields: { ...(existing?.custom_fields || {}), ...(patch.custom_fields || {}) },
        ...(action.status ? { status: action.status } : {}),
      };
      const lead = await saveRecord("leads", env.user.orgId, payload, existing?.id);
      if (existing) result.updated += 1;
      else result.created += 1;
      if (action.convert) {
        const account = await findAccountByName(env.user.orgId, lead.company_name);
        await rpc("crm_convert_lead", {
          p_lead: lead.id,
          p_account: account?.id || null,
          p_create_opportunity: true,
          p_confirm_duplicate: false,
        });
        result.accepted += 1;
      } else if (action.status === "Unqualified") result.rejected += 1;
      else if (action.status === "Contacted") result.inProgress += 1;
    } catch (error) {
      result.errors.push(`Row ${row.number}: ${error.message}`);
    }
  }
  return result;
}
