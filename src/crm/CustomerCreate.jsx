import { useState } from "react";
import Modal from "../components/common/Modal";
import { rpc } from "./service";
export default function CustomerCreate({ env, onClose, onSaved }) {
  const [values, setValues] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal open title="Add customer" onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await rpc("crm_quick_capture", {
              p_org: env.user.orgId,
              p_data: values,
              p_create_deal: false,
            });
            onSaved(result);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="screen-sub">
          Start with the person. Add a company if they represent a business.
        </p>
        {[
          ["name", "Customer name", "text"],
          ["company_name", "Company (optional)", "text"],
          ["email", "Email", "email"],
          ["phone", "Phone", "tel"],
        ].map(([key, label, type]) => (
          <label className="form-field" key={key}>
            <span className="form-label">
              {label}
              {key === "name" ? " *" : ""}
            </span>
            <input
              autoFocus={key === "name"}
              className="control"
              type={type}
              required={key === "name"}
              maxLength={key === "email" ? 320 : 200}
              value={values[key]}
              onChange={(e) =>
                setValues((old) => ({ ...old, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        {error && <p className="alert alert-error">{error}</p>}
        <div className="crm-form-actions">
          <button
            type="button"
            className="btn btn-soft"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Adding…" : "Add customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
