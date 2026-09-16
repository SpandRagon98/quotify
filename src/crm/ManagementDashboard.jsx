import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { money, STAGES } from "./schema";
import { useQuery } from "./useQuery";
import { eligibleOwners, periodBounds } from "./helpers";
function Bars({ rows, label, value, format = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[value] || 0)));
  return (
    <div className="crm-bars">
      {rows.map((row, i) => (
        <div key={i}>
          <div>
            <span>{row[label]}</span>
            <strong>{format(row[value])}</strong>
          </div>
          <span className="crm-bar-track">
            <span
              style={{ width: `${(Number(row[value] || 0) / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
      {!rows.length && (
        <p className="empty-inline">No records for this selection.</p>
      )}
    </div>
  );
}
export default function ManagementDashboard({ env, go, reports = false }) {
  const [filters, setFilters] = useState({
    period: "This month",
    from: "",
    to: "",
    owner: "",
    team: "",
    source: "",
    stage: "",
    currency: "INR",
  });
  const [revision, setRevision] = useState(0);
  const bounds = periodBounds(filters.period, filters.from, filters.to);
  const { data, loading, error } = useQuery(
    "crm_metrics",
    {
      p_org: env.user.orgId,
      ...bounds,
      p_owner: filters.owner || null,
      p_team: filters.team || null,
      p_source: filters.source || null,
      p_stage: filters.stage || null,
      p_currency: filters.currency,
    },
    revision,
  );
  const change = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const kpis = [
    ["Total leads", "leads"],
    ["New leads", "new_leads"],
    ["Qualified / converted", "qualified_leads"],
    ["Conversion rate", "conversion_rate"],
    ["Open opportunities", "open_opportunities"],
    ["Pipeline value", "pipeline"],
    ["Weighted pipeline", "weighted_pipeline"],
    ["Won deal value", "won_value"],
    ["Lost deal value", "lost_value"],
    ["Activities due today", "activities_today"],
    ["Overdue activities", "overdue_activities"],
  ];
  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">
            {reports ? "CRM reports" : "Management dashboard"}
          </h1>
          <p className="screen-sub">
            Your enquiries, deals and follow-ups, in focus.
          </p>
        </div>
        <button
          className="btn btn-soft"
          disabled={loading}
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>
      <div className="crm-toolbar">
        <select
          className="control"
          aria-label="Timeframe"
          value={filters.period}
          onChange={(e) => change("period", e.target.value)}
        >
          {[
            "This month",
            "Last month",
            "This quarter",
            "This year",
            "Custom range",
            "All time",
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {filters.period === "Custom range" && (
          <>
            <input
              className="control"
              type="date"
              aria-label="Range start"
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
            <input
              className="control"
              type="date"
              aria-label="Range end"
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </>
        )}
        <select
          className="control"
          aria-label="Salesperson"
          value={filters.owner}
          onChange={(e) => change("owner", e.target.value)}
        >
          <option value="">All visible salespeople</option>
          {eligibleOwners(env).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          className="control"
          aria-label="Team"
          value={filters.team}
          onChange={(e) => change("team", e.target.value)}
        >
          <option value="">All visible teams</option>
          {env.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className="control"
          aria-label="Lead source"
          placeholder="Lead source"
          value={filters.source}
          onChange={(e) => change("source", e.target.value)}
        />
        <select
          className="control"
          aria-label="Opportunity stage"
          value={filters.stage}
          onChange={(e) => change("stage", e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="control"
          aria-label="Dashboard currency"
          value={filters.currency}
          onChange={(e) => change("currency", e.target.value)}
        >
          {["INR", "USD", "EUR", "GBP"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="form-hint">Updating metrics…</p>}
      <p className="form-hint">
        {data?.period_note ||
          "Metrics are calculated on the server and limited to records you can access."}
      </p>
      <div className="crm-kpis">
        {kpis.map(([label, key]) => (
          <div className="card" key={key}>
            <small>{label}</small>
            <strong>
              {[
                "pipeline",
                "weighted_pipeline",
                "won_value",
                "lost_value",
              ].includes(key)
                ? money(data?.[key], filters.currency)
                : key === "conversion_rate"
                  ? `${data?.[key] || 0}%`
                  : data?.[key] || 0}
            </strong>
          </div>
        ))}
      </div>
      <div className="crm-charts">
        <div className="card">
          <h3 className="card-title">Pipeline by stage · value and count</h3>
          <Bars
            rows={STAGES.map((stage) => {
              const row = data?.pipeline_by_stage?.find(
                (r) => r.stage === stage,
              );
              return {
                label: `${stage} · ${row?.count || 0}`,
                value: row?.value || 0,
              };
            })}
            label="label"
            value="value"
            format={(v) => money(v, filters.currency)}
          />
        </div>
        <div className="card">
          <h3 className="card-title">Lead source performance</h3>
          <Bars
            rows={(data?.sources || []).map((s) => ({
              ...s,
              label: `${s.source} · ${s.converted} converted`,
            }))}
            label="label"
            value="leads"
          />
        </div>
        <div className="card">
          <h3 className="card-title">Won / lost by month</h3>
          <Bars
            rows={(data?.won_lost || []).map((s) => ({
              ...s,
              label: `${s.month} · ${s.stage}`,
            }))}
            label="label"
            value="value"
            format={(v) => money(v, filters.currency)}
          />
        </div>
        <div className="card">
          <h3 className="card-title">Conversion funnel</h3>
          <Bars
            rows={Object.entries(data?.funnel || {}).map(([label, value]) => ({
              label,
              value,
            }))}
            label="label"
            value="value"
          />
          <p className="form-hint">
            A process summary, not a strict cohort funnel: quotations and closed
            deals use their own date rules.
          </p>
        </div>
      </div>
      <div className="card crm-table-wrap">
        <h3 className="card-title">Salesperson performance</h3>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Salesperson</th>
              <th>Opportunities</th>
              <th>Open pipeline</th>
              <th>Won deal value</th>
              <th>Activities</th>
            </tr>
          </thead>
          <tbody>
            {data?.salespeople?.map((s) => (
              <tr key={s.owner_id}>
                <td>
                  {env.members.find((m) => m.id === s.owner_id)?.name ||
                    "Member"}
                </td>
                <td>{s.opportunities}</td>
                <td>{money(s.pipeline, filters.currency)}</td>
                <td>{money(s.won_value, filters.currency)}</td>
                <td>{s.activities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="crm-charts">
        <div className="card">
          <h3 className="card-title">Upcoming closures · next 30 days</h3>
          {data?.upcoming_closures?.map((o) => (
            <button
              className="crm-action-record"
              key={o.id}
              onClick={() =>
                go("crm_record", { entity: "opportunities", id: o.id })
              }
            >
              <strong>{o.name}</strong>
              <span>
                {o.expected_close_date} · {money(o.amount, o.currency)}
              </span>
            </button>
          ))}
          {!data?.upcoming_closures?.length && (
            <p className="empty-inline">No upcoming closures.</p>
          )}
        </div>
        <div className="card">
          <h3 className="card-title">Overdue follow-ups</h3>
          {data?.overdue?.map((a) => (
            <button
              className="crm-action-record"
              key={a.id}
              onClick={() =>
                go("crm_record", { entity: "activities", id: a.id })
              }
            >
              <strong>{a.title}</strong>
              <span>{new Date(a.due_at).toLocaleString()}</span>
            </button>
          ))}
          {!data?.overdue?.length && (
            <p className="empty-inline">No overdue activities.</p>
          )}
        </div>
      </div>
    </div>
  );
}
