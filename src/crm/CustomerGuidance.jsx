import { useCallback, useEffect, useRef, useState } from "react";
import { useJourney } from "./useJourney";
import { JourneyStepper, NextBestAction } from "./JourneyUI";
import RecordForm from "./RecordForm";
import FollowUp from "./FollowUp";
export default function CustomerGuidance({
  env,
  entity,
  id,
  go,
  onCreateQuote,
  initialAction,
  revision,
  onChanged,
}) {
  const data = useJourney(entity, env.user.orgId, { id, size: 1, revision });
  const [form, setForm] = useState(null);
  const [followup, setFollowup] = useState(false);
  const opened = useRef(false);
  const facts = data.rows[0];
  const act = useCallback(
    (result) => {
      const accountId = entity === "accounts" ? id : facts.account_id;
      const opportunityId =
        entity === "opportunities" ? id : facts.opportunity_id;
      if (result.type === "Invoice" || result.type === "Quotation")
        go("quote_wizard", {
          documentKind: result.type,
          context: { account_id: accountId, opportunity_id: opportunityId },
        });
      else if (result.type === "Follow-up" && env.access.activities?.create)
        setFollowup(true);
      else if (result.type === "History") return;
      else if (result.type === "Task" && facts.next_id)
        go("crm_record", { entity: "activities", id: facts.next_id });
      else if (env.access.activities?.create)
        setForm({
          title: result.action,
          activity_type: result.type === "Call" ? "Call" : "Task",
          account_id: accountId,
          opportunity_id: opportunityId || null,
          contact_id: facts.contact_id || null,
          due_at: new Date(Date.now() + 3600000).toISOString(),
        });
    },
    [entity, id, facts, go, env.access.activities?.create],
  );
  useEffect(() => {
    if (!facts || !initialAction || opened.current) return;
    const timer = setTimeout(() => {
      opened.current = true;
      act({
        type: initialAction,
        action:
          initialAction === "Call"
            ? `Call ${facts.customer_name || facts.name}`
            : initialAction === "Task"
              ? `Next step for ${facts.customer_name || facts.name}`
              : initialAction,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [facts, initialAction, act]);
  if (!facts) return null;
  return (
    <div className="customer-guidance">
      <h2>Where are we?</h2>
      <JourneyStepper stage={facts.stage} />
      <NextBestAction facts={facts} onAction={act} />
      <div className="customer-guidance-actions">
        <button
          className="btn btn-soft"
          disabled={!env.access.activities?.create}
          onClick={() =>
            setForm({
              title: `Call ${facts.customer_name || facts.name}`,
              activity_type: "Call",
              status: "Completed",
              account_id: entity === "accounts" ? id : facts.account_id,
              contact_id: facts.contact_id,
              opportunity_id:
                entity === "opportunities" ? id : facts.opportunity_id,
            })
          }
        >
          Log call
        </button>
        <button
          className="btn btn-soft"
          disabled={!env.access.activities?.create}
          onClick={() =>
            act({
              type: "Task",
              action: `Next step for ${facts.customer_name || facts.name}`,
            })
          }
        >
          Create task
        </button>
        <button
          className="btn btn-soft"
          disabled={!env.access.activities?.create}
          onClick={() =>
            setForm({
              title: `Response from ${facts.customer_name || facts.name}`,
              activity_type: "Email",
              status: "Completed",
              outcome: "Received",
              account_id: entity === "accounts" ? id : facts.account_id,
              opportunity_id:
                entity === "opportunities" ? id : facts.opportunity_id,
            })
          }
        >
          Record response
        </button>
        <button
          className="btn btn-soft"
          disabled={!env.access.quotations?.create}
          onClick={() =>
            onCreateQuote?.({
              account_id: entity === "accounts" ? id : facts.account_id,
              opportunity_id:
                entity === "opportunities" ? id : facts.opportunity_id,
              contact_id: facts.contact_id,
              owner_id: facts.owner_id,
              currency: facts.currency,
            })
          }
        >
          Use custom quotation template
        </button>
      </div>
      {form && (
        <RecordForm
          env={env}
          entity="activities"
          record={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            data.reload();
            onChanged?.();
          }}
        />
      )}
      {followup && (
        <FollowUp
          env={env}
          facts={{
            ...facts,
            account_id: entity === "accounts" ? id : facts.account_id,
            opportunity_id:
              entity === "opportunities" ? id : facts.opportunity_id,
          }}
          onClose={() => setFollowup(false)}
          onSent={() => {
            data.reload();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
