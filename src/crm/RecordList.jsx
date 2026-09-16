import { useState } from "react";
import RecordFilters from "./RecordFilters";
import {
  Plus,
  Download,
  Archive,
  Pencil,
  Check,
  Phone,
  Calendar,
} from "lucide-react";
import { ENTITIES, labelFor, money, activityStatus } from "./schema";
import { archiveRecords, rpc, saveRecord } from "./service";
import { useRecords } from "./useRecords";
import RecordForm from "./RecordForm";
import { downloadCsv } from "./csv";
export function Badge({ children }) {
  return (
    <span
      className={`crm-badge crm-badge-${String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      {children || "—"}
    </span>
  );
}
export function Cell({ entity, row, column, env }) {
  const value = row[column];
  if (column === "owner_id")
    return env.members.find((m) => m.id === value)?.name || "Member";
  if (column === "account_id") return row.account?.name || "Linked account";
  if (column === "status")
    return (
      <Badge>{entity === "activities" ? activityStatus(row) : value}</Badge>
    );
  if (column === "stage" || column === "priority")
    return <Badge>{value}</Badge>;
  if (column === "amount" || column === "estimated_value")
    return money(value, row.currency || "INR");
  if (column.endsWith("_at") || column === "expected_close_date")
    return value
      ? new Date(value).toLocaleString(
          undefined,
          column === "expected_close_date"
            ? { dateStyle: "medium" }
            : { dateStyle: "medium", timeStyle: "short" },
        )
      : "—";
  if (column === "probability") return `${value}%`;
  return value ?? "—";
}
export default function RecordList({
  entity,
  env,
  go,
  related = {},
  embedded = false,
  initialRecord = {},
  onCreateQuote,
  initialQuery = "",
  initialFilters = {},
}) {
  const definition = ENTITIES[entity];
  const cap =
    env.access[entity === "quote_links" ? "quotations" : entity] || {};
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState(
    entity === "activities" && !embedded
      ? { activity_view: "Today", owner_id: env.user.id }
      : initialFilters,
  );
  const [sort, setSort] = useState("created_at");
  const [ascending, setAscending] = useState(false);
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const data = useRecords(entity, env.user.orgId, {
    page,
    query,
    filters,
    sort,
    ascending,
    related,
  });
  const filter = (key, value) => {
    setPage(0);
    setSelected([]);
    setFilters((old) => ({ ...old, [key]: value }));
  };
  const action = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      data.reload();
      setSelected([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const archive = (ids) => {
    if (
      window.confirm(
        `Archive ${ids.length} record(s)? Historical related data will be kept.`,
      )
    )
      action(() => archiveRecords(entity, env.user.orgId, ids));
  };
  const createActivity = (row, type) =>
    setForm({
      entity: "activities",
      record: {
        activity_type: type,
        title: `${type}: ${row.name || row.title}`,
        owner_id: row.owner_id,
        ...(entity === "leads"
          ? { lead_id: row.id }
          : entity === "accounts"
            ? { account_id: row.id }
            : entity === "opportunities"
              ? {
                  account_id: row.account_id,
                  opportunity_id: row.id,
                  contact_id: row.contact_id,
                }
              : { account_id: row.account_id, contact_id: row.id }),
      },
    });
  const table = (
    <>
      <RecordFilters
        {...{
          entity,
          definition,
          query,
          setQuery,
          setPage,
          setSelected,
          filters,
          filter,
          env,
          data,
          setFilters,
          related,
        }}
      />
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {data.error && (
        <div className="alert alert-error" role="alert">
          {data.error}
          <button className="btn btn-soft" onClick={data.reload}>
            Retry
          </button>
        </div>
      )}
      {selected.length > 0 && (
        <div className="crm-bulk">
          <span>{selected.length} selected</span>
          {cap.delete && (
            <button
              className="btn btn-soft"
              disabled={busy}
              onClick={() => archive(selected)}
            >
              <Archive size={14} />
              Archive selected
            </button>
          )}
          {cap.export && (
            <button
              className="btn btn-soft"
              disabled={busy}
              onClick={() =>
                action(async () =>
                  downloadCsv(
                    await rpc("crm_export", {
                      p_org: env.user.orgId,
                      p_entity: entity,
                      p_ids: selected,
                    }),
                    entity,
                  ),
                )
              }
            >
              <Download size={14} />
              Export selected
            </button>
          )}
        </div>
      )}
      <div className="card crm-table-wrap" aria-busy={data.loading}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select current page"
                  checked={
                    data.rows.length > 0 && selected.length === data.rows.length
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? data.rows.map((r) => r.id) : [],
                    )
                  }
                />
              </th>
              {definition.columns.map((c) => (
                <th key={c}>
                  <button
                    onClick={() => {
                      setSort(c);
                      setAscending(sort === c ? !ascending : true);
                      setPage(0);
                    }}
                  >
                    {labelFor(c)}
                    {sort === c ? (ascending ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row[definition.label]}`}
                    checked={selected.includes(row.id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, row.id]
                          : old.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                {definition.columns.map((column, index) => (
                  <td key={column}>
                    {index === 0 ? (
                      <button
                        className="crm-record-link"
                        onClick={() => go("crm_record", { entity, id: row.id })}
                      >
                        <Cell {...{ entity, row, column, env }} />
                      </button>
                    ) : (
                      <Cell {...{ entity, row, column, env }} />
                    )}
                  </td>
                ))}
                <td>
                  <div className="crm-row-actions">
                    {cap.edit && entity !== "quote_links" && (
                      <button
                        className="icon-btn"
                        title="Edit"
                        onClick={() => setForm({ entity, record: row })}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {env.access.activities?.create &&
                      [
                        "leads",
                        "accounts",
                        "contacts",
                        "opportunities",
                      ].includes(entity) && (
                        <>
                          <button
                            className="icon-btn"
                            title="Log call"
                            onClick={() => createActivity(row, "Call")}
                          >
                            <Phone size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Create task / meeting"
                            onClick={() => createActivity(row, "Task")}
                          >
                            <Calendar size={14} />
                          </button>
                        </>
                      )}
                    {entity === "activities" &&
                      cap.edit &&
                      !["Completed", "Cancelled"].includes(row.status) && (
                        <button
                          className="icon-btn"
                          title="Complete with outcome"
                          onClick={() =>
                            setForm({
                              entity,
                              record: { ...row, status: "Completed" },
                            })
                          }
                        >
                          <Check size={14} />
                        </button>
                      )}
                    {entity === "inbox" && cap.edit && row.status === "New" && (
                      <>
                        <button
                          className="btn btn-soft btn-xs"
                          onClick={() =>
                            go("crm_record", { entity, id: row.id })
                          }
                        >
                          Review / accept
                        </button>
                        <button
                          className="btn btn-soft btn-xs"
                          onClick={() =>
                            action(() =>
                              saveRecord(
                                "inbox",
                                env.user.orgId,
                                { status: "Rejected" },
                                row.id,
                              ),
                            )
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {cap.delete && (
                      <button
                        className="icon-btn icon-btn-danger"
                        title="Archive"
                        disabled={busy}
                        onClick={() => archive([row.id])}
                      >
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.loading && !data.error && data.rows.length === 0 && (
          <div className="empty-state">
            <p>No {definition.title.toLowerCase()} match this view.</p>
            <small>
              Clear filters or create your first{" "}
              {definition.singular.toLowerCase()}.
            </small>
          </div>
        )}
        {data.loading && <div className="empty-inline">Loading…</div>}
      </div>
      <div className="crm-pagination">
        <span>
          {data.count} records · Page {page + 1} of{" "}
          {Math.max(1, Math.ceil(data.count / 25))}
        </span>
        <div>
          <button
            className="btn btn-soft"
            disabled={page === 0 || data.loading}
            onClick={() => {
              setPage((n) => n - 1);
              setSelected([]);
            }}
          >
            Previous
          </button>
          <button
            className="btn btn-soft"
            disabled={(page + 1) * 25 >= data.count || data.loading}
            onClick={() => {
              setPage((n) => n + 1);
              setSelected([]);
            }}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div className={embedded ? "crm-embedded" : "screen screen-wide"}>
      {!embedded && (
        <header className="screen-head">
          <div>
            <h1 className="screen-title">{definition.title}</h1>
            <p className="screen-sub">
              {entity === "activities"
                ? "Your calls, tasks and follow-ups, in one place."
                : "Workspace records, filtered securely on the server."}
            </p>
          </div>
          {cap.create && entity !== "quote_links" && (
            <button
              className="btn btn-primary"
              onClick={() => setForm({ entity, record: initialRecord })}
            >
              <Plus size={16} />
              New {definition.singular.toLowerCase()}
            </button>
          )}
        </header>
      )}
      {embedded && (
        <div className="crm-tab-actions">
          {cap.create && entity !== "quote_links" && (
            <button
              className="btn btn-primary"
              onClick={() =>
                setForm({ entity, record: { ...related, ...initialRecord } })
              }
            >
              <Plus size={14} />
              Add {definition.singular.toLowerCase()}
            </button>
          )}
          {entity === "quote_links" && cap.create && onCreateQuote && (
            <button className="btn btn-primary" onClick={onCreateQuote}>
              Create quotation
            </button>
          )}
        </div>
      )}
      {table}
      {form && (
        <RecordForm
          key={`${form.entity}:${form.record.id || "new"}`}
          entity={form.entity}
          record={form.record}
          env={env}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            data.reload();
            env.refresh?.();
          }}
        />
      )}
    </div>
  );
}
