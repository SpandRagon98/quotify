import { useEffect, useState } from "react";
import { listRecords } from "./service";
import { useCRM } from "./context";
import { displayName, ENTITIES } from "./schema";
export default function RecordSearch({ query, onOpenRecord }) {
  const env = useCRM();
  const [state, setState] = useState({ results: [], error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2 || !env?.user.orgId) {
        setState({ results: [], error: "" });
        return;
      }
      const entities = [
        "leads",
        "accounts",
        "contacts",
        "opportunities",
        "quote_links",
      ].filter((e) => env.access[e === "quote_links" ? "quotations" : e]?.view);
      try {
        const result = await Promise.all(
          entities.map(async (entity) => ({
            entity,
            ...(await listRecords(
              entity,
              env.user.orgId,
              { size: 5, query },
              controller.signal,
            )),
          })),
        );
        if (active)
          setState({
            results: result.flatMap((group) =>
              group.rows.map((record) => ({ entity: group.entity, record })),
            ),
            error: "",
          });
      } catch (e) {
        if (active && !controller.signal.aborted)
          setState({ results: [], error: e.message });
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, env?.user.orgId, env?.access]);
  if (query.trim().length < 2) return null;
  return (
    <div className="crm-search-records workspace-command-list">
      <small className="form-hint">
        CRM records · up to 5 matches per type
      </small>
      {state.results.map(({ entity, record }) => (
        <button
          key={`${entity}:${record.id}`}
          onClick={() => onOpenRecord(entity, record.id)}
        >
          <span>{displayName(entity, record)}</span>
          <small>{ENTITIES[entity].singular}</small>
        </button>
      ))}
      {state.error && <p className="form-error">{state.error}</p>}
      {!state.results.length && !state.error && (
        <p className="empty-inline">No matching CRM records.</p>
      )}
    </div>
  );
}
