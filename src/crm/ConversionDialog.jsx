import { useState } from "react";
import Modal from "../components/common/Modal";
import { RelationSelect } from "./RecordForm";
import { rpc } from "./service";
export default function ConversionDialog({ lead, env, onClose, onConverted }) {
  const [mode, setMode] = useState("new");
  const [account, setAccount] = useState("");
  const [opportunity, setOpportunity] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "existing" && !account)
        throw new Error("Select an account.");
      const result = await rpc("crm_convert_lead", {
        p_lead: lead.id,
        p_account: mode === "existing" ? account : null,
        p_create_opportunity: opportunity,
        p_confirm_duplicate: confirm,
      });
      onConverted(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title="Convert lead"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn btn-soft" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Converting…" : "Convert lead"}
          </button>
        </>
      }
    >
      <p>
        Create an account/contact relationship and an optional deal. Existing
        contact matches are reused without overwriting their information.
        Conversion cannot be accidentally run twice.
      </p>
      <label className="form-field">
        <span className="form-label">Account</span>
        <select
          className="control"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="new">
            Create {lead.company_name || "a new company"}
          </option>
          <option value="existing">Use an existing account</option>
        </select>
      </label>
      {mode === "existing" && (
        <RelationSelect
          entity="accounts"
          env={env}
          value={account}
          onChange={setAccount}
        />
      )}
      <label className="crm-check">
        <input
          type="checkbox"
          checked={opportunity}
          onChange={(e) => setOpportunity(e.target.checked)}
        />
        Create opportunity
      </label>
      {mode === "new" && (
        <label className="crm-check">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          I reviewed existing accounts and intentionally want a separate account
          if the company name matches.
        </label>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
