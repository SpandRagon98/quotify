import { useEffect, useState } from "react";
import { rpc, saveRecord } from "./service";
export default function InboxReview({ record, env, go, reload }) {
  const [duplicates, setDuplicates] = useState([]);
  const [target, setTarget] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    rpc("crm_duplicates", {
      p_org: env.user.orgId,
      p_email: record.email,
      p_phone: record.phone,
      p_company: record.company_name,
      p_name: record.name,
    })
      .then((rows) => {
        if (active) setDuplicates(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [
    env.user.orgId,
    record.email,
    record.phone,
    record.company_name,
    record.name,
  ]);
  const process = async (status) => {
    setBusy(true);
    setError("");
    try {
      if (status === "Accepted") {
        const id = await rpc("crm_accept_inbox", {
          p_entry: record.id,
          p_merge_lead: target || null,
          p_confirm_merge: confirm,
        });
        go("crm_record", { entity: "leads", id });
      } else {
        await saveRecord("inbox", env.user.orgId, { status }, record.id);
        reload();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (record.status !== "New")
    return (
      <div className="card">
        <p>Processed as {record.status}. Raw enquiry retained.</p>
        {record.lead_id && (
          <button
            className="btn btn-soft"
            onClick={() =>
              go("crm_record", { entity: "leads", id: record.lead_id })
            }
          >
            Open lead
          </button>
        )}
      </div>
    );
  return (
    <div className="card">
      <h3 className="card-title">Review enquiry</h3>
      {duplicates.length > 0 ? (
        <>
          <p>
            {duplicates.length} possible duplicate(s) visible to you. No records
            will be overwritten.
          </p>
          <label className="form-field">
            <span className="form-label">Merge target</span>
            <select
              className="control"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Create a separate lead</option>
              {duplicates.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.company_name} · {l.email || l.phone}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-check">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I reviewed these matches and confirm this merge / separate lead.
          </label>
        </>
      ) : (
        <p>
          No matching email, phone or company/contact combination was found in
          your accessible leads.
        </p>
      )}
      <div className="crm-form-actions">
        <button
          className="btn btn-primary"
          disabled={busy || (!confirm && !!target)}
          onClick={() => process("Accepted")}
        >
          {target ? "Confirm merge" : "Accept & create lead"}
        </button>
        <button
          className="btn btn-soft"
          disabled={busy}
          onClick={() => process("Rejected")}
        >
          Reject
        </button>
        <button
          className="btn btn-soft"
          disabled={busy}
          onClick={() => process("Spam")}
        >
          Mark spam
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <details>
        <summary>Original source payload (retained)</summary>
        <pre className="crm-json">
          {JSON.stringify(record.raw_payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
