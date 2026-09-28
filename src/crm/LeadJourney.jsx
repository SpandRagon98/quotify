import { Check, Circle, MoveRight } from "lucide-react";

const NODES = [
  ["New", "Enquiry captured"],
  ["Contacted", "Conversation started"],
  ["Interested", "Opportunity created automatically"],
  ["Opportunity", "Activities, value and next steps"],
];

export default function LeadJourney({ lead, onMarkInterested }) {
  const current = lead.opportunity_id || lead.converted_opportunity_id
    ? 3
    : Math.max(0, NODES.findIndex(([status]) => status === lead.status));
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
