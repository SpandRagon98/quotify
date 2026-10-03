import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useJourney } from "./useJourney";
import { PageHeader, EmptyState, PulseBadge, Skeleton } from "./JourneyUI";
import { pulse, relativeDate, stageLabel } from "./brain";
import { money } from "./schema";
import RecordList from "./RecordList";
export default function Customers({ env, go }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState("customers");
  const data = useJourney("accounts", env.user.orgId, { query, page });
  return (
    <div className="screen screen-wide">
      <PageHeader
        title="Customers"
        subtitle="Every conversation, deal and next step in one place."
      >
        <button
          className="btn btn-primary"
          disabled={!env.access.leads?.create}
          onClick={() => go("create", { kind: "Customer" })}
        >
          <Plus size={15} />
          Add customer
        </button>
      </PageHeader>
      <div className="crm-tabs">
        {[
          ["customers", "Customers"],
          ["leads", "Enquiries"],
          ["contacts", "All contacts"],
          ["accounts", "Companies & personal accounts"],
        ]
          .filter(([key]) => key === "customers" || env.access[key]?.view)
          .map(([key, label]) => (
            <button
              className={`btn ${mode === key ? "btn-primary" : "btn-soft"}`}
              key={key}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
      </div>
      {mode !== "customers" ? (
        <RecordList entity={mode} env={env} go={go} embedded />
      ) : (
        <>
          <label className="journey-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Find a customer, company, email or phone…"
              aria-label="Find customers"
            />
          </label>
          {data.error && <p className="alert alert-error">{data.error}</p>}
          {data.loading ? (
            <Skeleton />
          ) : data.rows.length ? (
            <div className="journey-table-wrap">
              <table className="journey-table">
                <thead>
                  <tr>
                    {[
                      "Customer",
                      "Company",
                      "Last activity",
                      "Stage",
                      "Deal value",
                      "Next step",
                      "Pulse",
                    ].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button
                          className="customer-name-link"
                          onClick={() =>
                            go("crm_record", { entity: "accounts", id: row.id })
                          }
                        >
                          <span className="customer-initial">
                            {row.customer_name?.charAt(0)}
                          </span>
                          <span>
                            <strong>{row.customer_name}</strong>
                            <small>
                              {row.customer_email || row.customer_phone}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>{row.name}</td>
                      <td>{relativeDate(row.last_activity_at)}</td>
                      <td>{stageLabel(row.stage)}</td>
                      <td>{money(row.amount, row.currency)}</td>
                      <td>
                        <button
                          className="crm-record-link"
                          onClick={() =>
                            go("crm_record", {
                              entity: "accounts",
                              id: row.id,
                              action: pulse(row, undefined, env.journeyRules)
                                .type,
                            })
                          }
                        >
                          {row.next_title ||
                            pulse(row, undefined, env.journeyRules).action}
                        </button>
                      </td>
                      <td>
                        <PulseBadge
                          facts={row}
                          onAction={(result) =>
                            go("crm_record", {
                              entity: "accounts",
                              id: row.id,
                              action: result.type,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={query ? "No customers match" : "Add your first customer"}
              text="Qyrova tracks their conversations, quotations and next steps automatically."
              action={env.access.leads?.create ? "Add customer" : undefined}
              onAction={() => go("create", { kind: "Customer" })}
            />
          )}
          <div className="crm-pagination">
            <span>{data.count} customers</span>
            <div>
              <button
                className="btn btn-soft"
                disabled={!page || data.loading}
                onClick={() => setPage((n) => n - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-soft"
                disabled={(page + 1) * 25 >= data.count || data.loading}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
