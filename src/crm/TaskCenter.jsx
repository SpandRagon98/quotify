import { useState } from "react";
import { Plus, Sparkles, Check } from "lucide-react";
import { useJourney } from "./useJourney";
import { taskRank } from "./brain";
import { saveRecord } from "./service";
import { PageHeader, EmptyState, Skeleton } from "./JourneyUI";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";
import { useNow } from "./useNow";
export default function TaskCenter({ env, go }) {
  const [tab, setTab] = useState("Today");
  const [page, setPage] = useState(0);
  const [planned, setPlanned] = useState(false);
  const [form, setForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const now = useNow();
  const data = useJourney("activities", env.user.orgId, {
    page,
    size: 50,
    revision: new Date(now).toDateString(),
    filters: { activity_view: tab, owner_id: env.user.id },
  });
  const [defaultDue] = useState(() =>
    new Date(Date.now() + 3600000).toISOString(),
  );
  const rows = planned
    ? [...data.rows].sort((a, b) => taskRank(b, b, now) - taskRank(a, a, now))
    : data.rows;
  return (
    <div className="screen screen-wide">
      <PageHeader
        title="Tasks"
        subtitle="Make the next customer action easy to finish."
      >
        <button
          className="btn btn-soft"
          onClick={() => setPlanned((old) => !old)}
          aria-pressed={planned}
        >
          <Sparkles size={15} />
          {planned ? "Priority order on" : "Plan my day"}
        </button>
        {env.access.activities?.create && (
          <button className="btn btn-primary" onClick={() => setForm(true)}>
            <Plus size={15} />
            New task
          </button>
        )}
      </PageHeader>
      <div className="crm-tabs">
        {["Today", "Upcoming", "Done", "All activities"].map((name) => (
          <button
            key={name}
            className={`btn ${name === tab ? "btn-primary" : "btn-soft"}`}
            onClick={() => {
              setTab(name);
              setPage(0);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {planned && (
        <p className="form-hint">
          Overdue work first, then urgent tasks, deal value and customer risk.
          No AI required. Ranking applies to this page.
        </p>
      )}
      {tab === "All activities" ? (
        <RecordList entity="activities" env={env} go={go} embedded />
      ) : (
        <>
          {(error || data.error) && (
            <p className="alert alert-error">{error || data.error}</p>
          )}
          {data.loading ? (
            <Skeleton />
          ) : rows.length ? (
            <div className="task-center-list">
              {rows.map((task) => (
                <article key={task.id}>
                  <button
                    className={`task-check ${task.status === "Completed" ? "checked" : ""}`}
                    aria-label={`Complete ${task.title}`}
                    disabled={
                      busy === task.id ||
                      task.status === "Completed" ||
                      !env.access.activities?.edit
                    }
                    onClick={async () => {
                      setBusy(task.id);
                      setError("");
                      try {
                        await saveRecord(
                          "activities",
                          env.user.orgId,
                          { status: "Completed" },
                          task.id,
                        );
                        data.reload();
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {task.status === "Completed" && <Check size={15} />}
                  </button>
                  <button
                    className="task-center-title"
                    onClick={() =>
                      go("crm_record", { entity: "activities", id: task.id })
                    }
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {task.company_name || task.activity_type}
                      {task.opportunity_id && task.amount
                        ? ` · ₹${Number(task.amount).toLocaleString("en-IN")}`
                        : ""}
                    </span>
                  </button>
                  <div className="task-due">
                    <span>
                      {task.due_at
                        ? new Date(task.due_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "No due date"}
                    </span>
                    <small
                      className={
                        task.due_at &&
                        Date.parse(task.due_at) < now &&
                        task.status !== "Completed"
                          ? "form-error"
                          : ""
                      }
                    >
                      {task.priority} priority
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="You're all caught up 🎉"
              text={
                tab === "Done"
                  ? "Completed work will appear here."
                  : "Nothing needs your attention in this view."
              }
              action={env.access.activities?.create ? "Add task" : undefined}
              onAction={() => setForm(true)}
            />
          )}
          <div className="crm-pagination">
            <span>{data.count} tasks</span>
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
                disabled={(page + 1) * 50 >= data.count}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {form && (
        <RecordForm
          env={env}
          entity="activities"
          record={{ due_at: defaultDue }}
          onClose={() => setForm(false)}
          onSaved={() => {
            setForm(false);
            data.reload();
          }}
        />
      )}
    </div>
  );
}
