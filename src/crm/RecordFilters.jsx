import { Search, RefreshCw } from "lucide-react";
import { STAGES, LEAD_STATUSES, PRIORITIES } from "./schema";
import { eligibleOwners } from "./helpers";
import { RelationSelect } from "./RecordForm";
export default function RecordFilters({
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
  related = {},
}) {
  return (
    <>
      <div className="crm-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            className="search-input"
            value={query}
            placeholder={`Search ${definition.title.toLowerCase()}…`}
            aria-label={`Search ${entity}`}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
              setSelected([]);
            }}
          />
        </label>
        <select
          className="control"
          aria-label="Owner filter"
          value={filters.owner_id || ""}
          onChange={(e) => filter("owner_id", e.target.value)}
        >
          <option value="">All visible owners</option>
          {eligibleOwners(env).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {entity === "leads" && (
          <select
            className="control"
            aria-label="Status filter"
            value={filters.status || ""}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {entity === "opportunities" && (
          <select
            className="control"
            aria-label="Stage filter"
            value={filters.stage || ""}
            onChange={(e) => filter("stage", e.target.value)}
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {entity === "inbox" && (
          <select
            className="control"
            aria-label="Inbox status"
            value={filters.status || ""}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {["New", "Accepted", "Merged", "Rejected", "Spam"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {entity === "activities" && (
          <select
            className="control"
            aria-label="Activity view"
            value={filters.activity_view || "All"}
            onChange={(e) => filter("activity_view", e.target.value)}
          >
            {["Today", "Upcoming", "Overdue", "Completed", "All"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        <button
          className="btn btn-soft"
          onClick={data.reload}
          disabled={data.loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <details className="crm-filter-details">
        <summary>More filters</summary>
        <div className="crm-filter-grid">
          {["opportunities", "contacts", "activities"].includes(entity) &&
            !related.account_id && (
              <label>
                Account
                <RelationSelect
                  entity="accounts"
                  env={env}
                  value={filters.account_id || ""}
                  onChange={(value) => filter("account_id", value)}
                />
              </label>
            )}
          {entity === "opportunities" && (
            <label>
              Currency
              <select
                className="control"
                value={filters.currency || ""}
                onChange={(e) => filter("currency", e.target.value)}
              >
                <option value="">
                  All currencies (values remain separate)
                </option>
                {["INR", "USD", "EUR", "GBP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          {["leads", "opportunities", "inbox"].includes(entity) && (
            <label>
              Source
              <input
                className="control"
                value={filters.source || ""}
                onChange={(e) => filter("source", e.target.value)}
              />
            </label>
          )}
          {["leads", "activities"].includes(entity) && (
            <label>
              Priority
              <select
                className="control"
                value={filters.priority || ""}
                onChange={(e) => filter("priority", e.target.value)}
              >
                <option value="">Any</option>
                {PRIORITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Created from
            <input
              className="control"
              type="date"
              value={filters.created_from || ""}
              onChange={(e) => filter("created_from", e.target.value)}
            />
          </label>
          <label>
            Created to
            <input
              className="control"
              type="date"
              value={filters.created_to || ""}
              onChange={(e) => filter("created_to", e.target.value)}
            />
          </label>
          {["leads", "opportunities"].includes(entity) && (
            <>
              <label>
                Minimum value
                <input
                  className="control"
                  type="number"
                  min="0"
                  value={filters.min_value || ""}
                  onChange={(e) => filter("min_value", e.target.value)}
                />
              </label>
              <label>
                Maximum value
                <input
                  className="control"
                  type="number"
                  min="0"
                  value={filters.max_value || ""}
                  onChange={(e) => filter("max_value", e.target.value)}
                />
              </label>
            </>
          )}
          {entity !== "quote_links" && (
            <label>
              Tag
              <input
                className="control"
                value={filters.tag || ""}
                onChange={(e) => filter("tag", e.target.value)}
              />
            </label>
          )}
          <button
            className="btn btn-soft"
            onClick={() => {
              setFilters({});
              setPage(0);
              setQuery("");
              setSelected([]);
            }}
          >
            Clear filters
          </button>
        </div>
      </details>
    </>
  );
}
