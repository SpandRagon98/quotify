import { useState } from "react";
import { ArrowRight, Activity, Plus } from "lucide-react";
import Modal from "../components/common/Modal";
import { JOURNEY, pulse } from "./brain";
import { money } from "./schema";
import { useCRM } from "./context";
import { useNow } from "./useNow";
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="screen-head">
      <div>
        <h1 className="screen-title">{title}</h1>
        <p className="screen-sub">{subtitle}</p>
      </div>
      <div className="head-actions">{children}</div>
    </header>
  );
}
export function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="journey-empty">
      <span>
        <Plus size={22} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="btn btn-primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
export function Skeleton({ rows = 4 }) {
  return (
    <div className="journey-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}
export function PulseBadge({ facts, onAction, rules }) {
  const [open, setOpen] = useState(false);
  const env = useCRM();
  const now = useNow();
  const result = pulse(facts, now, rules || env.journeyRules);
  return (
    <>
      <button
        className={`pulse-badge pulse-${result.level.toLowerCase().replaceAll(" ", "-")}`}
        onClick={() => setOpen(true)}
        title={result.reason}
      >
        <span />
        {result.level}
      </button>
      <Modal open={open} title="Qyrova Pulse" onClose={() => setOpen(false)}>
        <div className="pulse-explanation">
          <Activity size={25} />
          <h3>{result.level}</h3>
          <p>{result.reason}</p>
          <dl>
            <div>
              <dt>Deal value</dt>
              <dd>{money(facts.amount, facts.currency)}</dd>
            </div>
            <div>
              <dt>Quote sent</dt>
              <dd>
                {facts.quote_sent_at
                  ? new Date(facts.quote_sent_at).toLocaleDateString()
                  : "Not sent yet"}
              </dd>
            </div>
            <div>
              <dt>Customer response</dt>
              <dd>
                {facts.reply_at
                  ? new Date(facts.reply_at).toLocaleDateString()
                  : "None recorded"}
              </dd>
            </div>
            <div>
              <dt>Last activity</dt>
              <dd>
                {facts.last_activity_at
                  ? new Date(facts.last_activity_at).toLocaleDateString()
                  : "None recorded"}
              </dd>
            </div>
          </dl>
          <strong>Recommended</strong>
          <p>{result.action}</p>
          {onAction && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setOpen(false);
                onAction(result);
              }}
            >
              {result.action}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
export function JourneyStepper({ stage }) {
  const current = JOURNEY.findIndex(([key]) => key === stage);
  return (
    <ol className="journey-stepper" aria-label="Customer journey">
      {JOURNEY.filter(([key]) => key !== "Lost").map(([key, label], i) => (
        <li
          key={key}
          className={i < current ? "complete" : i === current ? "current" : ""}
          aria-current={i === current ? "step" : undefined}
        >
          <span>{i < current ? "✓" : i + 1}</span>
          {label}
        </li>
      ))}
      {stage === "Lost" && <li className="current">Lost</li>}
    </ol>
  );
}
export function NextBestAction({ facts, onAction, rules }) {
  const env = useCRM();
  const now = useNow();
  const result = pulse(facts, now, rules || env.journeyRules);
  return (
    <section className="next-best-action">
      <div className="next-best-heading">
        <Activity size={18} />
        <strong>Qyrova says</strong>
        <PulseBadge facts={facts} rules={rules} onAction={onAction} />
      </div>
      <p>{result.reason}</p>
      <div>
        <span>
          Next: <strong>{result.action}</strong>
        </span>
        <button className="btn btn-primary" onClick={() => onAction(result)}>
          {result.action}
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
