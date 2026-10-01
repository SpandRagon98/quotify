import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCopy, Plus, Send } from "lucide-react";
import Modal from "../components/common/Modal";
import { money } from "./schema";
import { changeOrderUrl, listChangeOrders, saveChangeOrder } from "./service";
import { Badge } from "./RecordList";

const EMPTY = {
  title: "",
  reason: "",
  scope_before: "",
  scope_after: "",
  delta_amount: "",
  delta_days: "",
  customer_email: "",
  currency: "INR",
};

function ChangeOrderForm({ order, context, env, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({ ...EMPTY, ...order, delta_amount: order?.delta_amount ?? "", delta_days: order?.delta_days ?? "" }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (key, value) => setValues((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!values.title.trim() || !values.scope_after.trim()) throw new Error("Title and revised scope are required.");
      const saved = await saveChangeOrder(env.user.orgId, {
        ...context,
        title: values.title.trim(), reason: values.reason.trim() || null,
        scope_before: values.scope_before.trim() || null, scope_after: values.scope_after.trim(),
        delta_amount: Number(values.delta_amount || 0), delta_days: Number(values.delta_days || 0),
        customer_email: values.customer_email.trim() || null, currency: values.currency || "INR",
      }, order?.id);
      onSaved(saved);
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };
  return <Modal open wide title={`${order?.id ? "Edit" : "New"} change order`} onClose={() => !busy && onClose()}>
    <form onSubmit={submit}>
      <p className="form-hint">Record a customer-requested change before work starts. The customer approves the added cost and time from a separate link.</p>
      <div className="crm-form-grid">
        <label className="form-field"><span className="form-label">Change title *</span><input className="control" value={values.title} maxLength="200" onChange={(e) => change("title", e.target.value)} /></label>
        <label className="form-field"><span className="form-label">Customer email *</span><input className="control" type="email" value={values.customer_email} onChange={(e) => change("customer_email", e.target.value)} /></label>
        <label className="form-field crm-full"><span className="form-label">Reason for change</span><textarea className="control" rows="2" value={values.reason} onChange={(e) => change("reason", e.target.value)} /></label>
        <label className="form-field crm-full"><span className="form-label">Previously approved scope</span><textarea className="control" rows="3" value={values.scope_before} onChange={(e) => change("scope_before", e.target.value)} /></label>
        <label className="form-field crm-full"><span className="form-label">Revised scope *</span><textarea className="control" rows="4" value={values.scope_after} onChange={(e) => change("scope_after", e.target.value)} /></label>
        <label className="form-field"><span className="form-label">Additional cost</span><input className="control" min="0" type="number" step="any" value={values.delta_amount} onChange={(e) => change("delta_amount", e.target.value)} /></label>
        <label className="form-field"><span className="form-label">Additional days</span><input className="control" min="0" type="number" value={values.delta_days} onChange={(e) => change("delta_days", e.target.value)} /></label>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="crm-form-actions"><button type="button" className="btn btn-soft" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button></div>
    </form>
  </Modal>;
}

export default function ChangeOrdersPanel({ env, accountId, opportunityId, contactId }) {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const reload = useCallback(() => listChangeOrders(env.user.orgId, { accountId, opportunityId }).then(setOrders).catch((e) => setError(e.message)), [env.user.orgId, accountId, opportunityId]);
  useEffect(() => { reload(); }, [reload]);
  const save = async (payload, id) => saveChangeOrder(env.user.orgId, payload, id);
  const send = async (order) => {
    if (!window.confirm(`Create the customer approval link for ${order.order_number}? Its scope, cost and timeline will be locked after approval.`)) return;
    setBusyId(order.id); setError("");
    try { await save({ status: "Sent for approval" }, order.id); reload(); } catch (e) { setError(e.message); } finally { setBusyId(""); }
  };
  const copy = async (order) => {
    try { await navigator.clipboard.writeText(changeOrderUrl(order.share_token)); setBusyId(order.id); window.setTimeout(() => setBusyId(""), 1200); }
    catch { setError("Copy failed. Select the link from your browser address bar after opening it."); }
  };
  const context = { account_id: accountId, opportunity_id: opportunityId || null, contact_id: contactId || null, owner_id: env.user.id, status: "Draft" };
  return <div className="change-orders-panel">
    <div className="crm-tab-actions"><button className="btn btn-primary" onClick={() => setForm({})}><Plus size={14} />New change order</button></div>
    <p className="form-hint">Approved orders are final. Create a fresh order for any later revision, keeping the customer decision history intact.</p>
    {error && <div className="alert alert-error">{error}</div>}
    {orders.length === 0 ? <div className="empty-state"><p>No change orders yet.</p><small>Use one whenever scope, materials, budget, or timeline changes after approval.</small></div> : <div className="change-order-list">{orders.map((order) => <article key={order.id} className="card change-order-card">
      <div className="change-order-heading"><div><small>{order.order_number}</small><h3>{order.title}</h3></div><Badge>{order.status}</Badge></div>
      <div className="change-order-impact"><span><strong>{money(order.delta_amount, order.currency)}</strong> additional cost</span><span><strong>{order.delta_days}</strong> additional days</span></div>
      <p className="crm-preserve-lines">{order.scope_after}</p>
      {order.customer_name && <p className="form-hint">{order.status} by {order.customer_name}{order.responded_at ? ` · ${new Date(order.responded_at).toLocaleString()}` : ""}{order.customer_response_note ? ` · “${order.customer_response_note}”` : ""}</p>}
      <div className="crm-tab-actions">
        {order.status === "Draft" && <><button className="btn btn-soft" onClick={() => setForm(order)}>Edit</button><button className="btn btn-primary" disabled={busyId === order.id} onClick={() => send(order)}><Send size={14} />Create approval link</button></>}
        {order.status === "Sent for approval" && <button className="btn btn-soft" onClick={() => copy(order)}>{busyId === order.id ? <Check size={14} /> : <ClipboardCopy size={14} />}{busyId === order.id ? "Copied" : "Copy approval link"}</button>}
      </div>
    </article>)}</div>}
    {form && <ChangeOrderForm order={form.id ? form : null} context={context} env={env} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
  </div>;
}
