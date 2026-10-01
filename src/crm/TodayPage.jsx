import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, RefreshCw, Send, UserRound } from "lucide-react";
import { dispatchSalesAutomation, getToday, saveRecord } from "./service";
import { Badge } from "./RecordList";
import { money } from "./schema";

const actionTarget = (item) =>
  item.opportunity_id ? ["opportunities", item.opportunity_id] : item.lead_id ? ["leads", item.lead_id] : item.account_id ? ["accounts", item.account_id] : ["activities", item.id];

function ListCard({ title, icon: Icon, items, empty, children }) {
  return <section className="card today-card"><header><span className="today-card-icon"><Icon size={17} /></span><div><h2 className="card-title">{title}</h2><small>{items?.length || 0} in focus</small></div></header>{children || (items?.length ? <div className="today-items">{items.map((item) => <article key={item.id}>{item}</article>)}</div> : <p className="empty-inline">{empty}</p>)}</section>;
}

export default function TodayPage({ env, go }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyLead, setBusyLead] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await getToday(env.user.orgId)); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [env.user.orgId]);
  useEffect(() => { load(); }, [load]);
  const members = useMemo(() => new Map(env.members.map((member) => [member.id, member.name])), [env.members]);
  const markInterested = async (lead) => {
    setBusyLead(lead.id);
    try { await saveRecord("leads", env.user.orgId, { status: "Interested" }, lead.id); dispatchSalesAutomation(env.user.orgId).catch(() => {}); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyLead(""); }
  };
  const open = (entity, id) => go("crm_record", { entity, id });
  return <div className="screen screen-wide today-screen">
    <header className="screen-head"><div><h1 className="screen-title">Today</h1><p className="screen-sub">One place for the next customer action, not a collection of CRM tables.</p></div><button className="btn btn-soft" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} />Refresh</button></header>
    {error && <div className="alert alert-error">{error}</div>}
    {loading && !data ? <div className="empty-inline">Loading today’s work…</div> : <>
      <div className="today-summary"><span><strong>{data?.new_leads?.length || 0}</strong> new enquiries</span><span><strong>{data?.my_work?.length || 0}</strong> due today</span><span><strong>{data?.overdue?.length || 0}</strong> overdue</span><span><strong>{data?.waiting_approvals?.length || 0}</strong> approvals waiting</span></div>
      <div className="today-grid">
        <ListCard title="New enquiries needing a response" icon={UserRound} items={data?.new_leads} empty="No new enquiries right now.">{data?.new_leads?.length ? <div className="today-items">{data.new_leads.map((lead) => <article key={lead.id}><div><strong>{lead.name}</strong><small>{[lead.company_name, lead.email || lead.phone, lead.lead_temperature].filter(Boolean).join(" · ")}</small></div><div className="today-actions"><button className="btn btn-soft btn-xs" onClick={() => open("leads", lead.id)}>Open</button><button className="btn btn-primary btn-xs" disabled={busyLead === lead.id} onClick={() => markInterested(lead)}>{busyLead === lead.id ? "Saving…" : "Interested"}</button></div></article>)}</div> : <p className="empty-inline">No new enquiries right now.</p>}</ListCard>
        <ListCard title="My calls, meetings and tasks" icon={CalendarDays} items={data?.my_work} empty="Your work is clear for today.">{data?.my_work?.length ? <div className="today-items">{data.my_work.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.activity_type} · {item.due_at ? new Date(item.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No time"}</small></div><button className="btn btn-soft btn-xs" onClick={() => open(...actionTarget(item))}>Open</button></article>)}</div> : <p className="empty-inline">Your work is clear for today.</p>}</ListCard>
        <ListCard title="Waiting for customer approval" icon={CheckCircle2} items={data?.waiting_approvals} empty="No approvals are waiting.">{data?.waiting_approvals?.length ? <div className="today-items">{data.waiting_approvals.map((item) => <article key={item.id}><div><strong>{item.order_number} · {item.title}</strong><small>{item.customer_email || "Customer email missing"} · {money(item.delta_amount, item.currency)}</small></div><button className="btn btn-soft btn-xs" onClick={() => open("opportunities", item.opportunity_id)}>Open</button></article>)}</div> : <p className="empty-inline">No approvals are waiting.</p>}</ListCard>
        <ListCard title="Deals needing movement" icon={ArrowRight} items={data?.stalled_deals} empty="Every open deal has a next action.">{data?.stalled_deals?.length ? <div className="today-items">{data.stalled_deals.map((deal) => <article key={deal.id}><div><strong>{deal.name}</strong><small>{deal.stage} · {money(deal.amount, deal.currency)} · no next step</small></div><button className="btn btn-soft btn-xs" onClick={() => open("opportunities", deal.id)}>Plan next step</button></article>)}</div> : <p className="empty-inline">Every open deal has a next action.</p>}</ListCard>
        <ListCard title="Overdue follow-ups" icon={Clock3} items={data?.overdue} empty="Nothing is overdue.">{data?.overdue?.length ? <div className="today-items">{data.overdue.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.due_at ? new Date(item.due_at).toLocaleString() : "No date"} · {members.get(item.owner_id) || "Member"}</small></div><button className="btn btn-soft btn-xs" onClick={() => open(...actionTarget(item))}>Resolve</button></article>)}</div> : <p className="empty-inline">Nothing is overdue.</p>}</ListCard>
        <ListCard title="Site visits, delivery and handover" icon={Send} items={data?.upcoming_delivery} empty="No delivery milestones in the next 7 days.">{data?.upcoming_delivery?.length ? <div className="today-items">{data.upcoming_delivery.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.activity_type} · {new Date(item.due_at).toLocaleString()}</small></div><button className="btn btn-soft btn-xs" onClick={() => open(...actionTarget(item))}>Open</button></article>)}</div> : <p className="empty-inline">No delivery milestones in the next 7 days.</p>}</ListCard>
      </div>
      <section className="card today-team"><h2 className="card-title">Team activity snapshot</h2><div>{data?.team_snapshot?.map((row) => <article key={row.owner_id}><strong>{members.get(row.owner_id) || "Member"}</strong><span><Badge>{row.due_today || 0} due</Badge><Badge>{row.overdue || 0} overdue</Badge><Badge>{row.completed_today || 0} completed</Badge></span></article>)}</div>{!data?.team_snapshot?.length && <p className="empty-inline">No team activity yet.</p>}</section>
    </>}
  </div>;
}
