// Pure mapping adapters. External connectors are explicitly not configured.
export const CONNECTORS = [
  {
    id: "Manual",
    status: "Available",
    description: "Create and review enquiries in Qyrova.",
  },
  {
    id: "CSV",
    status: "Available",
    description: "Preview, map and import a CSV file.",
  },
  {
    id: "Website/API",
    status: "Authenticated endpoint",
    description:
      "The crm_ingest RPC accepts workspace-authorized requests. A public website gateway needs server-side authentication and rate limiting.",
  },
  ...[
    "IndiaMART",
    "TradeIndia",
    "Justdial",
    "Meta/Facebook",
    "WhatsApp",
    "Email",
  ].map((id) => ({
    id,
    status: "Not configured",
    description:
      "Requires a real provider integration and credentials; no API connection is active.",
  })),
];
export const INBOX_MAPPING_FIELDS = [
  "name",
  "company_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "product",
  "city",
  "state",
  "country",
  "notes",
  "source_identifier",
  "source_timestamp",
];
export function mapIncoming(headers, row, mapping) {
  const raw = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]));
  const mapped = Object.fromEntries(
    INBOX_MAPPING_FIELDS.filter((k) => mapping[k]).map((k) => [
      k,
      raw[mapping[k]]?.trim() || null,
    ]),
  );
  if (!mapped.name) throw new Error("Every enquiry needs a mapped name.");
  if (mapped.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email))
    throw new Error(`Invalid email for ${mapped.name}.`);
  if (
    mapped.source_timestamp &&
    Number.isNaN(Date.parse(mapped.source_timestamp))
  )
    throw new Error(`Invalid source timestamp for ${mapped.name}.`);
  return { ...mapped, raw_payload: raw, mapped_fields: mapped };
}
