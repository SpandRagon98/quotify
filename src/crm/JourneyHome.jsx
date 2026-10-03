import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { homeSnapshot } from "./journeyService";
import { pulse, pulseRank } from "./brain";
import { money } from "./schema";
import { EmptyState, PageHeader, PulseBadge, Skeleton } from "./JourneyUI";
import Onboarding from "./Onboarding";
export default function JourneyHome({ env, go }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback(async () => {
    setState((old) => ({ ...old, loading: true }));
    try {
      const data = await homeSnapshot(env.user.orgId);
      setState({ loading: false, data, error: "" });
    } catch (e) {
      setState({ loading: false, data: null, error: e.message });
    }
  }, [env.user.orgId]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    const clock = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [load]);
  const { data, error, loading } = state;
  const hour = new Date().getHours();
  const customers = (data?.customers || [])
    .map((facts) => ({
      facts,
      recommendation: pulse(facts, undefined, env.journeyRules),
    }))
    .sort((a, b) => pulseRank(b.recommendation) - pulseRank(a.recommendation));
  const needsAttention = data?.needs_attention || 0;
  return (
    <div className="screen screen-wide journey-home">
      <PageHeader
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${(env.user.name || "there").split(" ")[0]} 👋`}
        subtitle="Here’s what needs your attention today."
      >
        <button
          className="btn btn-soft"
          disabled={loading}
          onClick={load}
          aria-label="Refresh home"
        >
          <RefreshCw size={16} />
        </button>
        <button
          className="btn btn-primary"
          disabled={!env.access.leads?.create}
          onClick={() => go("create", { kind: "Capture" })}
        >
          <Sparkles size={16} />
          Quick capture
        </button>
      </PageHeader>
      {error && <p className="alert alert-error">{error}</p>}
      {loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="journey-kpis">
            {[
              ["Follow-ups due", data?.followups_due || 0, "tasks"],
              ["Quotes awaiting reply", data?.quotes_waiting || 0, "documents"],
              ["Deals needing attention", needsAttention, "opportunities"],
              ["Active pipeline · INR", money(data?.pipeline), "opportunities"],
            ].map(([label, value, destination]) => (
              <button key={label} onClick={() => go(destination)}>
                <span>{label}</span>
                <strong>{value}</strong>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          <div className="journey-day-layout">
            <section>
              <div className="journey-section-head">
                <h2>Your day</h2>
                <span>Customer actions in priority order</span>
              </div>
              {customers.length ? (
                <div className="attention-list">
                  {customers.slice(0, 12).map(({ facts, recommendation }) => (
                    <article key={facts.id}>
                      <div className="customer-initial">
                        {facts.customer_name?.charAt(0)}
                      </div>
                      <div className="attention-identity">
                        <button
                          className="crm-record-link"
                          onClick={() =>
                            go("crm_record", {
                              entity: "accounts",
                              id: facts.id,
                            })
                          }
                        >
                          {facts.customer_name}
                        </button>
                        <small>{facts.name}</small>
                        <p>{recommendation.reason}</p>
                        <span className="attention-next">
                          Next: {recommendation.action}
                        </span>
                      </div>
                      <div className="attention-status">
                        <strong>{money(facts.amount, facts.currency)}</strong>
                        <PulseBadge
                          facts={facts}
                          onAction={(result) =>
                            go("crm_record", {
                              entity: "accounts",
                              id: facts.id,
                              action: result.type,
                            })
                          }
                        />
                        <button
                          className="btn btn-soft"
                          onClick={() =>
                            go("crm_record", {
                              entity: "accounts",
                              id: facts.id,
                              action: recommendation.type,
                            })
                          }
                        >
                          {recommendation.action}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Your next customer starts here"
                  text="Capture an enquiry and Qyrova will guide the conversation, quotation and next step."
                  action={
                    env.access.leads?.create ? "Add first customer" : undefined
                  }
                  onAction={() => go("create", { kind: "Customer" })}
                />
              )}
            </section>
            <aside className="day-agenda">
              <h2>My tasks</h2>
              <p>Calls, meetings and follow-ups due today.</p>
              {data?.tasks?.map((task) => (
                <button
                  key={task.id}
                  onClick={() =>
                    go("crm_record", { entity: "activities", id: task.id })
                  }
                >
                  <span className="agenda-check" />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {new Date(task.due_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {task.activity_type}
                    </small>
                  </span>
                  <ArrowRight size={14} />
                </button>
              ))}
              {!data?.tasks?.length && (
                <p className="agenda-clear">You're all caught up 🎉</p>
              )}
              <button className="btn btn-soft" onClick={() => go("tasks")}>
                Open task center
              </button>
            </aside>
          </div>
          {!customers.length &&
            ["owner", "admin", "editor"].includes(env.user.role) && (
              <Onboarding env={env} go={go} auto />
            )}
        </>
      )}
    </div>
  );
}
