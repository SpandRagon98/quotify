import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { STAGES, money } from "./schema";
import { saveRecord } from "./service";
import { useQuery } from "./useQuery";
import RecordForm from "./RecordForm";
import { eligibleOwners } from "./helpers";
import RecordList from "./RecordList";
function Lane({ stage, env, filters, revision, move, go }) {
  const [page, setPage] = useState(0);
  const { data, error, loading } = useQuery(
    "crm_pipeline",
    {
      p_org: env.user.orgId,
      p_stage: stage,
      p_page: page,
      p_query: filters.query,
      p_owner: filters.owner || null,
      p_source: filters.source || null,
      p_currency: filters.currency,
    },
    revision,
  );
  return (
    <section
      className="crm-lane"
      aria-label={stage}
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
        {stage}
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
          <p>{o.account_name || "Linked account"}</p>
          <strong>{money(o.amount, o.currency)}</strong>
          <small>
            {env.members.find((m) => m.id === o.owner_id)?.name || "Member"} ·{" "}
            {o.age_days} days old
          </small>
          <small>Close: {o.expected_close_date || "Not scheduled"}</small>
          <small>Next: {o.next_activity || "No open activity"}</small>
          {env.access.opportunities?.edit && (
            <select
              className="control"
              aria-label={`Stage for ${o.name}`}
              value={o.stage}
              onChange={(e) => move(o.id, e.target.value)}
            >
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
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
  const move = async (id, stage) => {
    if (busy) return;
    let lostReason = null;
    if (stage === "Lost") {
      lostReason = window.prompt("Why was this opportunity lost?");
      if (!lostReason?.trim()) return;
    }
    if (
      stage === "Won" &&
      !window.confirm(
        "Mark this opportunity as Won? This records won deal value, not a payment.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await saveRecord(
        "opportunities",
        env.user.orgId,
        { stage, ...(lostReason ? { lost_reason: lostReason } : {}) },
        id,
      );
      setRevision((n) => n + 1);
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
          <h1 className="screen-title">Opportunity pipeline</h1>
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
              New opportunity
            </button>
          )}
        </div>
      </header>
      <div className="crm-kpis">
        {[
          ["Total pipeline", "pipeline"],
          ["Weighted pipeline", "weighted_pipeline"],
          ["Opportunities", "opportunities"],
          ["Won deal value", "won_value"],
          ["Lost deal value", "lost_value"],
        ].map(([label, key]) => (
          <div className="card" key={key}>
            <small>{label}</small>
            <strong>
              {key === "opportunities"
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
    </div>
  );
}
