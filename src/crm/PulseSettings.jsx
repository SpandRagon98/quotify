import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
export default function PulseSettings({ env }) {
  const [values, setValues] = useState({
    quote_attention_days: 3,
    quote_risk_days: 7,
    enquiry_attention_hours: 24,
    ...env.journeyRules,
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="card pulse-settings">
      <h2 className="card-title">Qyrova Pulse rules</h2>
      <p className="form-hint">
        Choose when a customer needs attention. Every status includes an
        explanation.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setStatus("");
          try {
            if (
              Number(values.quote_risk_days) <=
              Number(values.quote_attention_days)
            )
              throw new Error(
                "At-risk days must be higher than attention days.",
              );
            const { error: requestError } = await supabase
              .from("crm_journey_settings")
              .upsert(
                { org_id: env.user.orgId, ...values },
                { onConflict: "org_id" },
              );
            if (requestError) throw new Error(requestError.message);
            setStatus("Pulse rules saved.");
            env.refresh();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="crm-form-grid">
          {[
            ["quote_attention_days", "Quote needs attention after (days)", 60],
            ["quote_risk_days", "Quote at risk after (days)", 90],
            [
              "enquiry_attention_hours",
              "Uncontacted enquiry after (hours)",
              168,
            ],
          ].map(([key, label, max]) => (
            <label key={key} className="form-field">
              <span className="form-label">{label}</span>
              <input
                className="control"
                required
                type="number"
                min="1"
                max={max}
                value={values[key]}
                onChange={(e) =>
                  setValues((old) => ({
                    ...old,
                    [key]: Number(e.target.value),
                  }))
                }
              />
            </label>
          ))}
        </div>
        {error && <p className="alert alert-error">{error}</p>}
        {status && <p className="alert alert-success">{status}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save Pulse rules"}
        </button>
      </form>
    </section>
  );
}
