/**
 * Sample presets seeded on first run (when localStorage is empty).
 * These give the user something to test immediately and serve as examples.
 */

import { newPresetId, newFieldId } from "../utils/idGenerator";

function field(label, type, required, extra = {}) {
  return {
    id: newFieldId(),
    label,
    type,
    required,
    defaultValue: "",
    placeholder: extra.placeholder || "",
    helpText: extra.helpText || "",
    options: extra.options || [],
    textMode: extra.textMode || "any",
  };
}

export function buildDefaultPresets() {
  const now = new Date().toISOString();

  return [
    {
      id: newPresetId(),
      name: "Standard Quotation",
      description: "A general-purpose product quotation.",
      googleSheetUrl: "",
      googleSheetId: "",
      googleDocUrl: "",
      googleDocId: "",
      sheetTabName: "Standard Quotation",
      createdAt: now,
      updatedAt: now,
      fields: [
        field("Customer Name", "text", true, { placeholder: "e.g. Acme Pvt Ltd" }),
        field("Customer Email", "email", false, { placeholder: "name@company.com" }),
        field("Product Name", "text", true),
        field("Quantity", "number", true, { placeholder: "0" }),
        field("Unit Price", "number", true, { placeholder: "0" }),
        field("GST Applicable", "boolean", false),
        field("Quotation Date", "date", true),
        field("Notes", "longtext", false, { placeholder: "Terms, special instructions…" }),
      ],
    },
    {
      id: newPresetId(),
      name: "Service Quotation",
      description: "For service-based engagements.",
      googleSheetUrl: "",
      googleSheetId: "",
      googleDocUrl: "",
      googleDocId: "",
      sheetTabName: "Service Quotation",
      createdAt: now,
      updatedAt: now,
      fields: [
        field("Client Name", "text", true),
        field("Service Type", "dropdown", true, {
          options: ["Consulting", "Installation", "Maintenance", "Support"],
        }),
        field("Service Description", "longtext", true),
        field("Estimated Hours", "number", false),
        field("Service Fee", "number", true),
        field("Include Support", "boolean", false),
        field("Start Date", "date", false),
      ],
    },
  ];
}
