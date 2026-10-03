import { useState } from "react";
import Modal from "../components/common/Modal";
import { extractCapture } from "./brain";
import { dispatchSalesAutomation, rpc } from "./service";
export default function QuickCapture({ env, go, onClose }) {
  const [text, setText] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open wide title="Quick capture" onClose={() => !busy && onClose()}>
      <p className="screen-sub">
        Paste the customer's message. Review the details, then create the
        customer and deal together.
      </p>
      <textarea
        className="control"
        rows={5}
        maxLength={2000}
        aria-label="Customer message"
        placeholder="Hi, this is Rahul from Acme Industries. We need analytics consulting for 3 months. Budget ₹5 lakh. Can we meet next Thursday?"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {!data ? (
        <button
          className="btn btn-primary capture-extract"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setData(await extractCapture(text));
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Review details
        </button>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await rpc("crm_quick_capture", {
                p_org: env.user.orgId,
                p_data: data,
              });
              dispatchSalesAutomation(env.user.orgId).catch(() => {});
              onClose();
              go("crm_record", { entity: "accounts", id: result.account_id });
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="crm-form-grid capture-fields">
            {[
              ["name", "Customer name", "text"],
              ["company_name", "Company", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "tel"],
              ["product", "Requirement", "text"],
              ["estimated_value", "Potential value (INR)", "number"],
              ["timeline", "Timeline", "text"],
              ["next_action", "Suggested next action", "text"],
            ].map(([key, label, type]) => (
              <label className="form-field" key={key}>
                <span className="form-label">
                  {label}
                  {key === "name" ? " *" : ""}
                </span>
                <input
                  className="control"
                  type={type}
                  min={type === "number" ? 0 : undefined}
                  required={key === "name"}
                  value={data[key]}
                  onChange={(event) =>
                    setData((old) => ({ ...old, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <p className="form-hint">
            Extracted details are suggestions. Check the name, budget and timing
            before saving.
          </p>
          <div className="crm-form-actions">
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => setData(null)}
            >
              Edit message
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create customer & deal"}
            </button>
          </div>
        </form>
      )}
      {error && <p className="alert alert-error">{error}</p>}
    </Modal>
  );
}
