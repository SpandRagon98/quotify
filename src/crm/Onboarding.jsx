import { useEffect, useState } from "react";
import Modal from "../components/common/Modal";
import { supabase } from "../lib/supabaseClient";
import { extractCapture } from "./brain";
import { rpc, saveRecord } from "./service";
export default function Onboarding({ env, go, auto = false }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    business_type: "Services",
    company: "",
    name: "",
    company_name: "",
    email: "",
    phone: "",
    product: "",
    estimated_value: "",
    account_id: "",
    contact_id: "",
    opportunity_id: "",
  });
  const [paste, setPaste] = useState("");
  useEffect(() => {
    let active = true;
    supabase
      .from("app_state")
      .select("data")
      .eq("org_id", env.user.orgId)
      .eq("key", "journey_setup")
      .maybeSingle()
      .then(({ data: record, error: requestError }) => {
        if (!active || requestError) return;
        if (record?.data) {
          setData((old) => ({ ...old, ...record.data }));
          setStep(record.data.completed ? 4 : record.data.step || 0);
        }
        if (auto && !record?.data?.completed) setOpen(true);
      });
    return () => {
      active = false;
    };
  }, [env.user.orgId, auto]);
  const persist = async (next) => {
    const { error: requestError } = await supabase
      .from("app_state")
      .upsert(
        { org_id: env.user.orgId, key: "journey_setup", data: next },
        { onConflict: "org_id,key" },
      );
    if (requestError) throw new Error(requestError.message);
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let next = { ...data, step: step + 1 };
      if (step === 2 && !data.account_id) {
        const result = await rpc("crm_quick_capture", {
          p_org: env.user.orgId,
          p_data: data,
          p_create_deal: false,
        });
        next = { ...next, ...result };
        setData(next);
      }
      if (step === 3 && !data.opportunity_id) {
        const deal = await saveRecord("opportunities", env.user.orgId, {
          owner_id: env.user.id,
          account_id: data.account_id,
          contact_id: data.contact_id,
          name: data.product || `${data.name} enquiry`,
          amount: Number(data.estimated_value || 0),
          next_step: "Confirm requirements and create quotation",
        });
        next = { ...next, opportunity_id: deal.id, completed: true };
        setData(next);
        if (data.lead_id)
          await saveRecord(
            "leads",
            env.user.orgId,
            { opportunity_id: deal.id },
            data.lead_id,
          );
      }
      await persist(next);
      setData(next);
      setStep((old) => old + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn btn-soft" onClick={() => setOpen(true)}>
        Guided workspace setup
      </button>
      <Modal
        open={open}
        title={step < 4 ? `${step + 1} of 4 · Get started` : "You're ready 🎉"}
        onClose={() => !busy && setOpen(false)}
      >
        {step < 4 ? (
          <form onSubmit={submit}>
            {step === 0 && (
              <>
                <h2>What kind of work do you do?</h2>
                <div className="onboarding-types">
                  {[
                    "Freelancer",
                    "Agency",
                    "Consulting",
                    "Products",
                    "Services",
                    "Other",
                  ].map((type) => (
                    <button
                      type="button"
                      className={`btn ${data.business_type === type ? "btn-primary" : "btn-soft"}`}
                      key={type}
                      onClick={() =>
                        setData((old) => ({ ...old, business_type: type }))
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h2>Add your company</h2>
                <label className="form-field">
                  <span className="form-label">Your business name</span>
                  <input
                    autoFocus
                    className="control"
                    required
                    value={data.company}
                    onChange={(e) =>
                      setData((old) => ({ ...old, company: e.target.value }))
                    }
                  />
                </label>
              </>
            )}
            {step === 2 && (
              <>
                <h2>Add your first customer</h2>
                <details>
                  <summary>Paste customer details ✨</summary>
                  <textarea
                    className="control"
                    rows={3}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={async () => {
                      try {
                        const extracted = await extractCapture(paste);
                        setData((old) => ({ ...old, ...extracted }));
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Fill details
                  </button>
                </details>
                {[
                  ["name", "Customer name", "text"],
                  ["company_name", "Customer company (optional)", "text"],
                  ["email", "Email", "email"],
                  ["phone", "Phone", "tel"],
                ].map(([key, label, type]) => (
                  <label className="form-field" key={key}>
                    <span className="form-label">{label}</span>
                    <input
                      className="control"
                      type={type}
                      required={key === "name"}
                      value={data[key]}
                      onChange={(e) =>
                        setData((old) => ({ ...old, [key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </>
            )}
            {step === 3 && (
              <>
                <h2>What are you discussing with them?</h2>
                <label className="form-field">
                  <span className="form-label">Requirement</span>
                  <input
                    className="control"
                    required
                    value={data.product}
                    onChange={(e) =>
                      setData((old) => ({ ...old, product: e.target.value }))
                    }
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Potential value (INR)</span>
                  <input
                    className="control"
                    type="number"
                    min="0"
                    value={data.estimated_value}
                    onChange={(e) =>
                      setData((old) => ({
                        ...old,
                        estimated_value: e.target.value,
                      }))
                    }
                  />
                </label>
              </>
            )}
            {error && <p className="alert alert-error">{error}</p>}
            <div className="crm-form-actions">
              <button
                type="button"
                className="btn btn-soft"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Continue later
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h2>Your customer and deal are ready.</h2>
            <p>Next: create the quotation.</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setOpen(false);
                go("quote_wizard", {
                  context: {
                    account_id: data.account_id,
                    opportunity_id: data.opportunity_id,
                  },
                });
              }}
            >
              Create quotation
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
