import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Logo from "../common/Logo";
import { supabase } from "../../lib/supabaseClient";
import { money } from "../../crm/schema";
import "../../crm/crm.css";

export default function ChangeOrderApprovalPage({ token }) {
  const [order, setOrder] = useState(null); const [state, setState] = useState("loading");
  const [name, setName] = useState(""); const [note, setNote] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  useEffect(() => { let active = true; supabase.rpc("crm_change_order_public", { p_token: token }).then(({ data, error: requestError }) => { if (!active) return; if (requestError || !data) { setState("missing"); return; } setOrder(data); setState("ready"); }); return () => { active = false; }; }, [token]);
  const respond = async (decision) => { if (name.trim().length < 2) { setError("Please type your full name to confirm."); return; } setBusy(decision); setError(""); const { data, error: requestError } = await supabase.rpc("crm_respond_change_order", { p_token: token, p_decision: decision, p_customer_name: name.trim(), p_note: note.trim() || null }); if (requestError) setError(requestError.message); else setOrder((old) => ({ ...old, status: data.status, customer_name: name.trim(), customer_response_note: note.trim(), responded_at: data.responded_at })); setBusy(""); };
  return <div className="change-order-public"><header><span><Logo size={24} />Qyrova</span><small>Customer approval</small></header><main>
    {state === "loading" && <div className="empty-inline"><Loader2 className="spin" size={20} />Loading change order…</div>}
    {state === "missing" && <div className="card empty-state"><XCircle size={26} /><p>This approval link is unavailable.</p><small>It may have been cancelled, replaced, or entered incorrectly.</small></div>}
    {state === "ready" && order && <div className="card change-order-approval-card"><small>{order.order_number}</small><h1>{order.title}</h1>{order.reason && <p className="form-hint">Reason: {order.reason}</p>}
      {order.scope_before && <section><small>Previously approved scope</small><p>{order.scope_before}</p></section>}<section><small>Revised scope</small><p>{order.scope_after}</p></section>
      <div className="change-order-impact"><span><strong>{money(order.delta_amount, order.currency)}</strong> additional cost</span><span><strong>{order.delta_days}</strong> additional days</span></div>
      {["Approved", "Rejected"].includes(order.status) ? <div className={`change-order-decision ${order.status === "Approved" ? "approved" : "rejected"}`}>{order.status === "Approved" ? <CheckCircle2 /> : <XCircle />}<div><strong>{order.status}</strong><p>{order.customer_name ? `Confirmed by ${order.customer_name}.` : "Your decision has been recorded."}</p></div></div> : <><p className="form-hint">Please review the impact carefully. Your decision will be recorded and shared with the project team.</p><label className="form-field"><span className="form-label">Your full name *</span><input className="control" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="form-field"><span className="form-label">Note for the project team (optional)</span><textarea className="control" rows="3" value={note} onChange={(e) => setNote(e.target.value)} /></label>{error && <div className="alert alert-error">{error}</div>}<div className="crm-form-actions"><button className="btn btn-soft" disabled={Boolean(busy)} onClick={() => respond("Rejected")}>{busy === "Rejected" ? "Sending…" : "Reject change"}</button><button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => respond("Approved")}>{busy === "Approved" ? "Sending…" : "Approve change"}</button></div></>}
    </div>}
  </main></div>;
}
