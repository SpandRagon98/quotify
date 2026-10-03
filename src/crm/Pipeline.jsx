import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { STAGES, money } from "./schema";
import { getRecord, saveRecord } from "./service";
import { useQuery } from "./useQuery";
import RecordForm from "./RecordForm";
import { eligibleOwners } from "./helpers";
import RecordList from "./RecordList";
import { JOURNEY, stageLabel, relativeDate } from "./brain";
import { PulseBadge } from "./JourneyUI";
import { useJourney } from "./useJourney";
import Modal from "../components/common/Modal";
function Lane({ stage, env, filters, revision, move, go }) {
  const [page, setPage] = useState(0);
  const result = useJourney("opportunities", env.user.orgId, {
    page,
    query: filters.query,
    filters: {
      stage,
      owner_id: filters.owner,
      source: filters.source,
      currency: filters.currency,
    },
    revision,
  });
  const data = result,
    error = result.error,
    loading = result.loading;
  return (
    <section
      className="crm-lane"
      aria-label={stageLabel(stage)}
      onDragOver={(e) => {
        if (env.access.opportunities?.edit) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        try {
          const payload = JSON.parse(
            e.dataTransfer.getData("application/qyrova-opportunity"),
          );
          move(payload.id, stage);
        } catch {
          /* Ignore unrelated drag data. */
        }
      }}
    >
      <h3>
        {stageLabel(stage)}
        <span>{data?.count || 0}</span>
      </h3>
      {loading && <small>Loading…</small>}
      {error && <p className="form-error">{error}</p>}
      {data?.rows.map((o) => (
        <article
          className="card crm-deal"
          key={o.id}
          draggable={!!env.access.opportunities?.edit}
          onDragStart={(e) =>
            e.dataTransfer.setData(
              "application/qyrova-opportunity",
              JSON.stringify({ id: o.id }),
            )
          }
        >
          <button
            className="crm-record-link"
            onClick={() =>
              go("crm_record", { entity: "opportunities", id: o.id })
            }
          >
            {o.name}
          </button>
          <p>{o.company_name || o.customer_name || "Customer"}</p>
          <strong>{money(o.amount, o.currency)}</strong>
          <small>Last activity: {relativeDate(o.last_activity_at)}</small>
          <small>Close: {o.expected_close_date || "Not scheduled"}</small>
          <small>
            Next:{" "}
            {o.stage === "Won"
              ? "Create invoice"
              : o.stage === "Lost"
                ? "Review history"
                : o.next_title || o.next_step || "Add next step"}
          </small>
          <PulseBadge
            facts={o}
            onAction={(result) =>
              go("crm_record", {
                entity: "opportunities",
                id: o.id,
                action: result.type,
              })
            }
          />
          {env.access.opportunities?.edit && (
            <select
              className="control"
              aria-label={`Stage for ${o.name}`}
              value={o.stage}
              onChange={(e) => move(o.id, e.target.value)}
            >
              {JOURNEY.map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </article>
      ))}
      {!loading && !data?.rows.length && !error && (
        <p className="empty-inline">No deals in this stage.</p>
      )}
      <div className="crm-lane-pages">
        <button
          className="btn btn-soft btn-xs"
          disabled={!page || loading}
          onClick={() => setPage((n) => n - 1)}
        >
          Previous
        </button>
        <button
          className="btn btn-soft btn-xs"
          disabled={(page + 1) * 25 >= (data?.count || 0) || loading}
          onClick={() => setPage((n) => n + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
export default function Pipeline({ env, go }) {
  const [mode, setMode] = useState("board");
  const [filters, setFilters] = useState({
    query: "",
    owner: "",
    source: "",
    currency: "INR",
  });
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lostDeal, setLostDeal] = useState(null);
  const [lostReason, setLostReason] = useState("Price");
  const [lostNote, setLostNote] = useState("");
  const [wonDeal, setWonDeal] = useState(null);
  const [wonActivity, setWonActivity] = useState(null);
  const continueWon = async (kind) => {
    setBusy(true);
    try {
      const deal = await getRecord("opportunities", env.user.orgId, wonDeal);
      const context = {
        account_id: deal.account_id,
        contact_id: deal.contact_id,
        opportunity_id: deal.id,
      };
      if (kind === "Invoice")
        go("quote_wizard", { documentKind: "Invoice", context });
      else
        setWonActivity({
          ...context,
          activity_type: kind,
          title: kind === "Meeting" ? `Kickoff: ${deal.name}` : "",
          due_at: new Date(Date.now() + 86400000).toISOString(),
          owner_id: env.user.id,
        });
      setWonDeal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const metrics = useQuery(
    "crm_metrics",
    {
      p_org: env.user.orgId,
      p_owner: filters.owner || null,
      p_source: filters.source || null,
      p_currency: filters.currency,
      p_query: filters.query || null,
    },
    revision,
  );
  const move = async (id, stage, confirmedReason = null) => {
    if (busy) return;
    if (stage === "Lost" && !confirmedReason) {
      setLostDeal(id);
      setLostReason("Price");
      setLostNote("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveRecord(
        "opportunities",
        env.user.orgId,
        {
          stage,
          ...(stage === "Won"
            ? { next_step: "Create invoice or schedule kickoff" }
            : {}),
          ...(confirmedReason
            ? { lost_reason: confirmedReason, lost_note: lostNote || null }
            : {}),
        },
        id,
      );
      setRevision((n) => n + 1);
      setLostDeal(null);
      if (stage === "Won") setWonDeal(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Deals</h1>
          <p className="screen-sub">
            Move deals by dragging a card or selecting its stage.
          </p>
        </div>
        <div className="head-actions">
          <button
            className="btn btn-soft"
            onClick={() => setMode((m) => (m === "board" ? "table" : "board"))}
          >
            {mode === "board" ? "Table view" : "Kanban view"}
          </button>
          {env.access.opportunities?.create && (
            <button className="btn btn-primary" onClick={() => setForm(true)}>
              <Plus size={16} />
              New deal
            </button>
          )}
        </div>
      </header>
      <div className="crm-kpis">
        {[
          ["Total pipeline", "pipeline"],
          ["Open deals", "open_opportunities"],
          ["Won deal value", "won_value"],
        ].map(([label, key]) => (
          <div className="card" key={key}>
            <small>{label}</small>
            <strong>
              {key === "open_opportunities"
                ? metrics.data?.[key] || 0
                : money(metrics.data?.[key], filters.currency)}
            </strong>
          </div>
        ))}
      </div>
      <div className="crm-toolbar">
        <input
          className="control"
          aria-label="Search pipeline"
          placeholder="Search deals…"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        />
        <select
          className="control"
          aria-label="Pipeline owner"
          value={filters.owner}
          onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
        >
          <option value="">All visible owners</option>
          {eligibleOwners(env).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          className="control"
          placeholder="Source filter"
          aria-label="Pipeline source"
          value={filters.source}
          onChange={(e) =>
            setFilters((f) => ({ ...f, source: e.target.value }))
          }
        />
        <select
          className="control"
          aria-label="Currency"
          value={filters.currency}
          onChange={(e) =>
            setFilters((f) => ({ ...f, currency: e.target.value }))
          }
        >
          {["INR", "USD", "EUR", "GBP"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className="btn btn-soft"
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
      <p className="form-hint">
        Values use the selected currency; there is no automatic FX conversion.
        Open pipeline is a current snapshot. Table view includes its own
        additional filters.
      </p>
      {(error || metrics.error) && (
        <div className="alert alert-error">{error || metrics.error}</div>
      )}
      {mode === "board" ? (
        <div className="crm-board" aria-busy={busy}>
          {STAGES.map((stage) => (
            <Lane
              key={`${stage}:${JSON.stringify(filters)}`}
              {...{ stage, env, filters, revision, move, go }}
            />
          ))}
        </div>
      ) : (
        <RecordList
          entity="opportunities"
          env={env}
          go={go}
          embedded
          key={`${revision}:${JSON.stringify(filters)}`}
          initialQuery={filters.query}
          initialFilters={{
            owner_id: filters.owner,
            source: filters.source,
            currency: filters.currency,
          }}
        />
      )}
      {form && (
        <RecordForm
          entity="opportunities"
          env={env}
          record={{ currency: filters.currency }}
          onClose={() => setForm(false)}
          onSaved={() => {
            setForm(false);
            setRevision((n) => n + 1);
          }}
        />
      )}
      <Modal
        open={!!lostDeal}
        title="What happened?"
        onClose={() => !busy && setLostDeal(null)}
      >
        <div className="lost-reason-options">
          {[
            "Price",
            "Competitor",
            "Timing",
            "No Response",
            "Requirement Changed",
            "Other",
          ].map((reason) => (
            <button
              className={`btn ${lostReason === reason ? "btn-primary" : "btn-soft"}`}
              key={reason}
              onClick={() => setLostReason(reason)}
            >
              {reason}
            </button>
          ))}
        </div>
        <label className="form-field">
          <span className="form-label">Optional note</span>
          <textarea
            className="control"
            rows={3}
            value={lostNote}
            onChange={(e) => setLostNote(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => move(lostDeal, "Lost", lostReason)}
        >
          {busy ? "Saving…" : "Save reason"}
        </button>
      </Modal>
      {wonActivity && (
        <RecordForm
          entity="activities"
          env={env}
          record={wonActivity}
          onClose={() => setWonActivity(null)}
          onSaved={() => {
            setWonActivity(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
      <Modal
        open={!!wonDeal}
        title="Deal won 🎉"
        onClose={() => setWonDeal(null)}
      >
        <p>What would you like to do next?</p>
        <div className="won-actions">
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => continueWon("Invoice")}
          >
            Create invoice
          </button>
          <button
            className="btn btn-soft"
            disabled={busy}
            onClick={() => continueWon("Meeting")}
          >
            Schedule kickoff
          </button>
          <button
            className="btn btn-soft"
            disabled={busy}
            onClick={() => continueWon("Task")}
          >
            Create task
          </button>
          <button className="btn btn-soft" onClick={() => setWonDeal(null)}>
            Nothing for now
          </button>
        </div>
      </Modal>
    </div>
  );
}
