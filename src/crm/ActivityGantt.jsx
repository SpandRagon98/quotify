import { useMemo, useState } from "react";
import { useRecords } from "./useRecords";

const day = 86_400_000;
const dayStart = (value) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date.getTime(); };
const label = (value) => new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function ActivityGantt({ env, opportunityId }) {
  const [initialNow] = useState(() => Date.now());
  const data = useRecords("activities", env.user.orgId, { size: 100, related: { opportunity_id: opportunityId }, sort: "due_at", ascending: true });
  const { starts, origin } = useMemo(() => {
    const planned = data.rows.filter((activity) => activity.due_at);
    const first = planned.length ? Math.min(...planned.map((activity) => dayStart(activity.due_at))) : dayStart(initialNow);
    const last = planned.length ? Math.max(...planned.map((activity) => dayStart(activity.due_at) + Math.max(1, Math.ceil(Number(activity.duration_minutes || 60) / 480)) * day)) : first;
    const total = Math.min(31, Math.max(7, Math.ceil((last - first) / day) + 2));
    return { origin: first, starts: Array.from({ length: total }, (_, index) => first + index * day) };
  }, [data.rows, initialNow]);
  return <section className="card activity-gantt">
    <div><h3 className="card-title">Activity schedule</h3><p className="form-hint">Each activity uses its due time and duration. Add or edit activities to customise this schedule.</p></div>
    {data.error && <p className="form-error">{data.error}</p>}
    <div className="activity-gantt-scroll"><div className="activity-gantt-grid" style={{ gridTemplateColumns: `190px repeat(${starts.length}, minmax(92px, 1fr))` }}>
      <div className="activity-gantt-title">Activity</div>{starts.map((value) => <div key={value} className="activity-gantt-day">{label(value)}</div>)}
      {data.rows.filter((activity) => activity.due_at).map((activity) => {
        const start = Math.max(1, Math.floor((dayStart(activity.due_at) - origin) / day) + 1);
        const span = Math.max(1, Math.ceil(Number(activity.duration_minutes || 60) / 480));
        return <div className="activity-gantt-row" key={activity.id}>
          <div><strong>{activity.title}</strong><small>{activity.activity_type} · {new Date(activity.due_at).toLocaleString()}</small></div>
          <div className="activity-gantt-bar" style={{ gridColumn: `${start + 1} / span ${span}` }} title={`${activity.duration_minutes || 60} minutes`}><span>{activity.status}</span></div>
        </div>;
      })}
    </div></div>
    {!data.loading && !data.rows.some((activity) => activity.due_at) && <p className="empty-inline">No scheduled activities yet. Add a task, call, or meeting with a due time.</p>}
  </section>;
}
