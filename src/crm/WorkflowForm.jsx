import { useState } from "react";
import Modal from "../components/common/Modal";
import { saveWorkflow } from "./service";
import { STAGES, LEAD_STATUSES, PRIORITIES, ACTIVITY_STATUSES } from "./schema";
const TRIGGERS = [
  "lead_created",
  "lead_updated",
  "lead_assigned",
  "lead_status_changed",
  "opportunity_created",
  "opportunity_stage_changed",
  "activity_overdue",
  "quote_created",
  "quote_status_changed",
  "account_created",
];
const ACTIONS = [
  "assign_owner",
  "create_task",
  "create_follow_up",
  "update_status",
  "update_stage",
  "update_priority",
  "add_tag",
  "notification",
  "internal_note",
];
export default function WorkflowForm({ env, record = {}, onClose, onSaved }) {
  const [name, setName] = useState(record.name || "");
  const [trigger, setTrigger] = useState(record.trigger_type || "lead_created");
  const [enabled, setEnabled] = useState(record.enabled || false);
  const [conditions, setConditions] = useState(record.conditions || []);
  const [actions, setActions] = useState(
    record.actions || [
      { type: "create_task", title: "Contact new enquiry", due_minutes: 30 },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (setter, index, key, value) =>
    setter((old) =>
      old.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveWorkflow(
        env.user.orgId,
        { name, trigger_type: trigger, enabled, conditions, actions },
        record.id,
      );
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={`${record.id ? "Edit" : "Create"} workflow`}
      wide
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="crm-form-grid">
          <label className="form-field">
            <span className="form-label">Name</span>
            <input
              className="control"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-label">Trigger</span>
            <select
              className="control"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="crm-check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled — run on future matching events
        </label>
        <h3>Conditions · all must match (AND)</h3>
        {conditions.map((c, i) => (
          <div className="crm-rule-row" key={i}>
            <select
              className="control"
              aria-label="Condition field"
              value={c.field}
              onChange={(e) =>
                update(setConditions, i, "field", e.target.value)
              }
            >
              {[
                "source",
                "estimated_value",
                "amount",
                "owner_id",
                "status",
                "stage",
                "priority",
                "city",
                "state",
                "tags",
                "product",
              ].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <select
              className="control"
              aria-label="Condition operator"
              value={c.operator}
              onChange={(e) =>
                update(setConditions, i, "operator", e.target.value)
              }
            >
              {["equals", "not_equals", "greater_than", "contains"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            {c.field === "owner_id" ? (
              <select
                className="control"
                required
                value={c.value}
                onChange={(e) =>
                  update(setConditions, i, "value", e.target.value)
                }
              >
                <option value="">Choose owner</option>
                {env.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="control"
                aria-label="Condition value"
                required
                value={c.value}
                onChange={(e) =>
                  update(setConditions, i, "value", e.target.value)
                }
              />
            )}
            <button
              type="button"
              className="btn btn-soft"
              onClick={() =>
                setConditions((old) => old.filter((_, j) => j !== i))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-soft"
          disabled={conditions.length >= 20}
          onClick={() =>
            setConditions((old) => [
              ...old,
              { field: "source", operator: "equals", value: "" },
            ])
          }
        >
          Add condition
        </button>
        <h3>Actions · executed in order</h3>
        {actions.map((a, i) => {
          const choices =
            a.type === "update_stage"
              ? STAGES.filter((s) => s !== "Lost")
              : a.type === "update_priority"
                ? PRIORITIES
                : a.type === "update_status"
                  ? trigger.startsWith("lead_")
                    ? LEAD_STATUSES.filter((s) => s !== "Converted")
                    : trigger === "activity_overdue"
                      ? ACTIVITY_STATUSES
                      : [
                          "Saved",
                          "sent",
                          "viewed",
                          "approved",
                          "declined",
                          "negotiate",
                        ]
                  : null;
          return (
            <div className="crm-rule-action" key={i}>
              <select
                className="control"
                aria-label="Action type"
                value={a.type}
                onChange={(e) =>
                  setActions((old) =>
                    old.map((r, j) =>
                      i === j
                        ? {
                            type: e.target.value,
                            value: "",
                            title: "",
                            due_minutes: 30,
                          }
                        : r,
                    ),
                  )
                }
              >
                {ACTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              {a.type === "assign_owner" ? (
                <select
                  className="control"
                  required
                  value={a.value}
                  onChange={(e) =>
                    update(setActions, i, "value", e.target.value)
                  }
                >
                  <option value="">Choose owner</option>
                  {env.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : a.type === "create_task" || a.type === "create_follow_up" ? (
                <>
                  <input
                    className="control"
                    required
                    placeholder="Activity title"
                    aria-label="Activity title"
                    value={a.title || ""}
                    onChange={(e) =>
                      update(setActions, i, "title", e.target.value)
                    }
                  />
                  <label>
                    Due in minutes
                    <input
                      className="control"
                      type="number"
                      min="0"
                      max="525600"
                      value={a.due_minutes ?? 30}
                      onChange={(e) =>
                        update(
                          setActions,
                          i,
                          "due_minutes",
                          Number(e.target.value),
                        )
                      }
                    />
                  </label>
                </>
              ) : choices ? (
                <select
                  className="control"
                  required
                  value={a.value}
                  onChange={(e) =>
                    update(setActions, i, "value", e.target.value)
                  }
                >
                  <option value="">Choose value</option>
                  {choices.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="control"
                  required
                  placeholder="Tag, notification text or note"
                  aria-label="Action value"
                  value={a.value || ""}
                  onChange={(e) =>
                    update(setActions, i, "value", e.target.value)
                  }
                />
              )}
              <button
                type="button"
                className="btn btn-soft"
                disabled={actions.length === 1}
                onClick={() =>
                  setActions((old) => old.filter((_, j) => j !== i))
                }
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-soft"
          disabled={actions.length >= 10}
          onClick={() =>
            setActions((old) => [
              ...old,
              { type: "create_task", title: "", due_minutes: 30 },
            ])
          }
        >
          Add action
        </button>
        <p className="form-hint">
          Workflow-generated changes are audited but cannot recursively run
          another workflow. Invalid or inapplicable actions roll back together
          and appear in execution history. Email/WhatsApp actions are
          unavailable until secured integrations are configured.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="crm-form-actions">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save workflow"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
