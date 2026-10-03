import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Search, Clock, ArrowRight } from "lucide-react";
import Modal from "../components/common/Modal";
import { useCRM } from "./context";
import { universalSearch } from "./journeyService";
import { displayName, money } from "./schema";
import { pulse, stageLabel } from "./brain";
import { Skeleton } from "./JourneyUI";
const DESTINATIONS = [
  ["Home", "crm_dashboard", "home today attention follow up"],
  ["Customers", "customers", "customers contacts companies accounts"],
  ["Deals", "opportunities", "deals pipeline opportunities"],
  ["Tasks", "tasks", "tasks activities call meeting"],
  ["Documents", "documents", "documents quotations invoices proposals"],
  ["Reports", "reports", "reports analytics business"],
  ["Settings → Templates", "presets", "templates presets"],
  ["Settings → Team", "users", "users team members"],
  [
    "Settings → Integrations",
    "inbox",
    "integrations telegram website enquiries",
  ],
  ["Settings → Automation", "workflows", "automation workflows"],
  ["Settings → Products & Services", "database", "products services database"],
  ["Settings → Roles & permissions", "permissions", "roles permissions"],
  ["Settings", "settings", "settings appearance theme"],
];
const GROUPS = {
  contacts: "Contacts",
  accounts: "Customers & companies",
  opportunities: "Deals",
  quote_links: "Documents",
  activities: "Tasks",
  leads: "Enquiries",
};
export default function GlobalSearch({
  open,
  onClose,
  go,
  onCreate,
  allowedTabs,
}) {
  const env = useCRM();
  const [query, setQuery] = useState("");
  const [state, setState] = useState({
    results: [],
    loading: false,
    error: "",
    parsed: {},
  });
  const [selected, setSelected] = useState(0);
  const list = useRef(null);
  const recentKey = `qyrova:search:v1:${env.user.orgId}:${env.user.id}`;
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(recentKey) || "[]").slice(0, 5);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((old) => ({ ...old, loading: true, error: "" }));
      try {
        const data = await universalSearch(query, env, controller.signal);
        if (active) setState({ ...data, loading: false, error: "" });
      } catch (error) {
        if (active && !controller.signal.aborted)
          setState({
            results: [],
            parsed: {},
            loading: false,
            error: error.message,
          });
      }
    }, 200);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open, env]);
  const remember = () => {
    if (!query.trim()) return;
    const next = [
      query.trim(),
      ...recent.filter((text) => text !== query.trim()),
    ].slice(0, 5);
    setRecent(next);
    try {
      localStorage.setItem(recentKey, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  const choose = (action) => {
    remember();
    onClose();
    action();
  };
  const tokens = query
    .toLowerCase()
    .replace(/where|are|is|go|to|open|the|\?/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const destinations = DESTINATIONS.filter(
    ([, route, words]) =>
      allowedTabs.includes(route) &&
      (!tokens.length || tokens.some((token) => words.includes(token))),
  );
  const commandEntity = {
    Customer: "leads",
    Company: "accounts",
    Enquiry: "leads",
    Deal: "opportunities",
    Quotation: "quotations",
    Invoice: "quotations",
    Task: "activities",
    Note: "activities",
  };
  const commands = /creat|new|add/.test(query.toLowerCase())
    ? [
        "Customer",
        "Company",
        "Enquiry",
        "Deal",
        "Quotation",
        "Invoice",
        "Task",
        "Note",
      ]
        .filter(
          (item) =>
            env.access[commandEntity[item]]?.create &&
            (!tokens.length ||
              tokens.some((token) => item.toLowerCase().includes(token))),
        )
        .map((item) => ({
          group: "Actions",
          title: `Create ${item.toLowerCase()}`,
          action: () => onCreate(item),
        }))
    : [];
  const results = query.trim().length > 1 ? state.results : [];
  const items = [
    ...commands,
    ...destinations.map(([title, route]) => ({
      group: "Navigation",
      title,
      action: () => go(route),
    })),
    ...results.map(({ entity, record }) => ({
      group: GROUPS[entity],
      title:
        entity === "accounts"
          ? `${record.customer_name} · ${record.name}`
          : displayName(entity, record),
      detail:
        state.parsed.summary && entity === "accounts"
          ? `${stageLabel(record.stage)}. ${pulse(record, undefined, env.journeyRules).reason} Next: ${pulse(record, undefined, env.journeyRules).action}.`
          : entity === "accounts"
            ? [record.customer_email, record.customer_phone]
                .filter(Boolean)
                .join(" · ")
            : entity === "opportunities"
              ? `${record.company_name || ""} · ${money(record.amount, record.currency)} · ${stageLabel(record.stage)}`
              : entity === "contacts"
                ? [record.company_name, record.email, record.phone]
                    .filter(Boolean)
                    .join(" · ")
                : record.status || record.activity_type,
      action: () => go("crm_record", { entity, id: record.id }),
    })),
  ];
  return (
    <Modal open={open} wide title="Search Qyrova" onClose={onClose}>
      <div
        className="global-command"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const next =
              (selected +
                (event.key === "ArrowDown" ? 1 : -1) +
                Math.max(1, items.length)) %
              Math.max(1, items.length);
            setSelected(next);
            list.current
              ?.querySelector(`[data-index="${next}"]`)
              ?.scrollIntoView({ block: "nearest" });
          }
          if (event.key === "Enter" && items[selected]) {
            event.preventDefault();
            choose(items[selected].action);
          }
        }}
      >
        <label className="global-command-input">
          <Search size={21} />
          <input
            autoFocus
            value={query}
            placeholder="Search Qyrova or ask anything…"
            aria-label="Search Qyrova or ask anything"
            aria-controls="qyrova-search-results"
            aria-activedescendant={
              items[selected] ? `search-result-${selected}` : undefined
            }
            role="combobox"
            aria-expanded="true"
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
              setState({
                results: [],
                loading: event.target.value.trim().length > 1,
                error: "",
                parsed: {},
              });
            }}
          />
          <kbd>Esc</kbd>
        </label>
        {!query && recent.length > 0 && (
          <div className="search-recent">
            <small>Recent searches</small>
            {recent.map((text) => (
              <button
                key={text}
                onClick={() => {
                  setQuery(text);
                  setSelected(0);
                }}
              >
                <Clock size={14} />
                {text}
                <ArrowRight size={13} />
              </button>
            ))}
          </div>
        )}
        <div
          id="qyrova-search-results"
          className="global-command-results"
          role="listbox"
          ref={list}
        >
          {items.map((item, index) => (
            <div key={`${item.group}:${item.title}:${index}`}>
              {index === 0 || items[index - 1].group !== item.group ? (
                <h4>{item.group}</h4>
              ) : null}
              <button
                id={`search-result-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === selected}
                className={index === selected ? "selected" : ""}
                onPointerMove={() => setSelected(index)}
                onClick={() => choose(item.action)}
              >
                <span>
                  <strong>{item.title}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
          {state.loading && <Skeleton rows={2} />}
          {state.error && <p className="form-error">{state.error}</p>}
          {state.partial && (
            <p className="form-hint">
              Some categories could not load. Try again to see all results.
            </p>
          )}
          {query.length > 1 && !items.length && !state.loading && (
            <p className="empty-inline">
              No matches. Try a customer name, document number, or “show deals
              over 2 lakh”.
            </p>
          )}
        </div>
        <footer className="search-footer">
          <span>↑ ↓ to select · Enter to open</span>
          <span>Search uses your workspace records</span>
        </footer>
      </div>
    </Modal>
  );
}
