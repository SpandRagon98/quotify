import { useState } from "react";
import Modal from "../components/common/Modal";
import RecordList from "./RecordList";
import { parseCsv } from "./csv";
import { CONNECTORS, INBOX_MAPPING_FIELDS, mapIncoming } from "./adapters";
import { rpc } from "./service";
export default function LeadInbox({ env, go }) {
  const [csv, setCsv] = useState(null);
  const [mapping, setMapping] = useState({});
  const [source, setSource] = useState("CSV");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const selectFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose a CSV under 2 MB.");
      const parsed = parseCsv(await file.text());
      setCsv(parsed);
      setMapping(
        Object.fromEntries(
          INBOX_MAPPING_FIELDS.map((k) => [
            k,
            parsed.headers.find(
              (h) => h.toLowerCase().replaceAll(" ", "_") === k,
            ) || "",
          ]),
        ),
      );
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  };
  let preview = [],
    previewError = "";
  if (csv)
    try {
      preview = csv.rows.map((row) => mapIncoming(csv.headers, row, mapping));
    } catch (e) {
      previewError = e.message;
    }
  const submit = async () => {
    if (previewError) return;
    setBusy(true);
    setError("");
    let accepted = 0,
      skipped = 0;
    try {
      for (let i = 0; i < preview.length; i += 100) {
        const result = await rpc("crm_ingest", {
          p_org: env.user.orgId,
          p_source: source,
          p_entries: preview.slice(i, i + 100),
        });
        accepted += result.accepted;
        skipped += result.duplicates_skipped;
        setProgress(
          `${Math.min(i + 100, preview.length)} / ${preview.length} processed`,
        );
      }
      setProgress(
        `${accepted} enquiries imported; ${skipped} repeated source identifiers skipped. Review the inbox before creating leads.`,
      );
      setCsv(null);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(
        `${e.message} ${accepted} already imported; remaining batches were not processed. Re-importing entries with source identifiers is idempotent.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="screen screen-wide crm-inbox-intro">
        <div className="card">
          <h3 className="card-title">Lead sources</h3>
          <div className="crm-connectors">
            {CONNECTORS.map((c) => (
              <div key={c.id}>
                <strong>{c.id}</strong>
                <small>{c.status}</small>
                <p>{c.description}</p>
              </div>
            ))}
          </div>
          {env.access.inbox?.create && (
            <label className="btn btn-soft">
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={selectFile}
              />
            </label>
          )}
          <details>
            <summary>Website / other API setup</summary>
            <p>
              POST to your Supabase project’s{" "}
              <code>/rest/v1/rpc/crm_ingest</code> endpoint with the public
              project API key and an authenticated member’s bearer token. JSON
              body:
            </p>
            <pre className="crm-json">
              {JSON.stringify(
                {
                  p_org: env.user.orgId,
                  p_source: "Website",
                  p_entries: [
                    {
                      name: "Enquiry name",
                      company_name: "Company",
                      email: "contact@example.com",
                      source_identifier: "unique-enquiry-id",
                      raw_payload: {},
                      mapped_fields: {},
                    },
                  ],
                },
                null,
                2,
              )}
            </pre>
            <p>
              Keep authentication on your integration server. Never embed a
              service-role/management key in a public form. No public anonymous
              website collector is enabled.
            </p>
          </details>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {progress && <div className="alert alert-info">{progress}</div>}
      </div>
      <RecordList entity="inbox" env={env} go={go} key={revision} />
      {csv && (
        <Modal
          open
          wide
          title="Review and map CSV enquiries"
          onClose={() => !busy && setCsv(null)}
        >
          <p>
            {csv.rows.length} enquiries. Imports go to the inbox; they do not
            silently merge with existing leads.
          </p>
          <label className="form-field">
            <span className="form-label">Source</span>
            <input
              className="control"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <div className="crm-form-grid">
            {INBOX_MAPPING_FIELDS.map((k) => (
              <label className="form-field" key={k}>
                <span className="form-label">
                  {k.replaceAll("_", " ")}
                  {k === "name" ? " *" : ""}
                </span>
                <select
                  className="control"
                  value={mapping[k] || ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [k]: e.target.value }))
                  }
                >
                  <option value="">Do not import</option>
                  {csv.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <h3>Preview · first 5 rows</h3>
          <pre className="crm-json">
            {JSON.stringify(
              preview.slice(0, 5).map((r) => r.mapped_fields),
              null,
              2,
            )}
          </pre>
          {previewError && (
            <div className="alert alert-error">{previewError}</div>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="crm-form-actions">
            <button
              className="btn btn-soft"
              disabled={busy}
              onClick={() => setCsv(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || !!previewError || !source.trim()}
              onClick={submit}
            >
              {busy ? progress : "Import to Lead Inbox"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
