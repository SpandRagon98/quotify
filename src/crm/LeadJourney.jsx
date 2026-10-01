import { Check, Circle, MoveRight } from "lucide-react";

const NODES = [
  ["New", "Respond within 15 minutes"],
  ["Attempted contact", "Try again or use another channel"],
  ["Contacted", "Schedule the discovery conversation"],
  ["Qualified", "Confirm scope, budget, and timeline"],
  ["Interested", "Create the opportunity and schedule a site visit"],
  ["Opportunity", "Prepare the proposal and progress delivery"],
];

export default function LeadJourney({ lead, onMarkInterested }) {
  const statusIndex = {
    New: 0,
    "Attempted Contact": 1,
    Contacted: 2,
    Qualified: 3,
    Interested: 4,
    Converted: 5,
  };
  const current = lead.opportunity_id || lead.converted_opportunity_id
    ? 5
    : (statusIndex[lead.status] ?? 0);
  return <section className="lead-journey card">
    <div><h3 className="card-title">Lead journey</h3><p className="form-hint">A lead becomes an opportunity only when the customer is interested.</p></div>
    <div className="lead-journey-nodes">
      {NODES.map(([status, caption], index) => <div key={status} className={index <= current ? "is-complete" : ""}>
        <span>{index < current ? <Check size={14} /> : index === current ? <Circle size={14} /> : index + 1}</span>
        <strong>{status}</strong><small>{caption}</small>
        {index < NODES.length - 1 && <MoveRight className="lead-journey-arrow" size={16} />}
      </div>)}
    </div>
    {lead.status !== "Interested" && !lead.opportunity_id && !lead.converted_opportunity_id && (
      <button className="btn btn-primary" onClick={onMarkInterested}>Mark customer interested</button>
    )}
  </section>;
}
