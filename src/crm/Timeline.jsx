import { useState } from "react";
import { useRecords } from "./useRecords";
import { JOURNEY } from "./brain";
function friendly(text = "") {
  let result = text.replaceAll("opportunities", "deals").replaceAll("opportunity", "deal").replaceAll("quote links", "document").replaceAll("activities", "activity").replaceAll("contacts", "contact").replaceAll("account created", "company created").replaceAll("lead updated", "enquiry updated");
  for(const [stage, label] of JOURNEY) result = result.replaceAll(stage, label);
  return result;
}
export default function Timeline({ env, related }) {
  const [page, setPage] = useState(0);
  const data = useRecords("events", env.user.orgId, { page, related });
  return (
    <div className="card crm-timeline">
      <h3 className="card-title">Timeline</h3>
      {data.error && <p className="form-error">{data.error}</p>}
      {data.loading && <p>Loading history…</p>}
      {data.rows.map((event) => (
        <article key={event.id}>
          <span className="crm-timeline-dot" />
          <div>
            <strong>{friendly(event.title)}</strong>
            {event.detail && (
              <p className="crm-preserve-lines">{friendly(event.detail)}</p>
            )}
            <small>
              {new Date(event.created_at).toLocaleString()} ·{" "}
              {env.members.find((m) => m.id === event.actor_id)?.name ||
                "System / public quotation response"}
            </small>
          </div>
        </article>
      ))}
      {!data.loading && !data.rows.length && (
        <p className="empty-inline">No activity history yet.</p>
      )}
      <div className="crm-pagination">
        <span>{data.count} events</span>
        <div>
          <button
            className="btn btn-soft"
            disabled={!page}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <button
            className="btn btn-soft"
            disabled={(page + 1) * 25 >= data.count}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
