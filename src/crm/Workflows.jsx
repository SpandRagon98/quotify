import { useState } from "react";
import { useRecords } from "./useRecords";
import { saveWorkflow } from "./service";
import WorkflowForm from "./WorkflowForm";
import { Badge } from "./RecordList";
export default function Workflows({ env }) {
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const rules = useRecords("workflows", env.user.orgId, { page });
  const history = useRecords("workflow_executions", env.user.orgId, {
    page: historyPage,
  });
  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Workflows</h1>
          <p className="screen-sub">
            Simple, server-side CRM rules. Reminders continue when the app is
            closed.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({})}>
          Create workflow
        </button>
      </header>
      {(error || rules.error) && (
        <div className="alert alert-error">{error || rules.error}</div>
      )}
      <div className="card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.rows.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{w.trigger_type.replaceAll("_", " ")}</td>
                <td>
                  <Badge>{w.enabled ? "Enabled" : "Disabled"}</Badge>
                </td>
                <td>
                  <button className="btn btn-soft" onClick={() => setForm(w)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-soft"
                    onClick={async () => {
                      try {
                        await saveWorkflow(
                          env.user.orgId,
                          { enabled: !w.enabled },
                          w.id,
                        );
                        rules.reload();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    {w.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rules.rows.length && !rules.loading && (
          <p className="empty-inline">
            No workflows yet. Start with a task for new website enquiries.
          </p>
        )}
      </div>
      <div className="crm-pagination">
        <span>{rules.count} workflows</span>
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
            disabled={(page + 1) * 25 >= rules.count}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <div className="card crm-table-wrap">
        <h3 className="card-title">Execution history</h3>
        <button className="btn btn-soft" onClick={history.reload}>
          Refresh history
        </button>
        {history.error && <p className="form-error">{history.error}</p>}
        <table className="crm-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Workflow ID</th>
              <th>Result</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {history.rows.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.created_at).toLocaleString()}</td>
                <td>
                  {rules.rows.find((w) => w.id === h.workflow_id)?.name ||
                    h.workflow_id}
                </td>
                <td>
                  <Badge>{h.status}</Badge>
                </td>
                <td>{h.error || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.rows.length && !history.loading && (
          <p className="empty-inline">
            No executions yet. Existing records are not retroactively processed.
          </p>
        )}
      </div>
      <div className="crm-pagination">
        <span>{history.count} executions</span>
        <div>
          <button
            className="btn btn-soft"
            disabled={!historyPage}
            onClick={() => setHistoryPage((n) => n - 1)}
          >
            Previous
          </button>
          <button
            className="btn btn-soft"
            disabled={(historyPage + 1) * 25 >= history.count}
            onClick={() => setHistoryPage((n) => n + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {form && (
        <WorkflowForm
          record={form}
          env={env}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            rules.reload();
            history.reload();
          }}
        />
      )}
    </div>
  );
}
