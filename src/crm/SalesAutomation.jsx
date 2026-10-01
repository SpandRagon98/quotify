import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Mail, RefreshCw, Send, Settings2, Sparkles } from "lucide-react";
import { Badge } from "./RecordList";
import {
  applyAiSuggestion,
  dismissAiSuggestion,
  dispatchSalesAutomation,
  getSalesAutomationSettings,
  listAiSuggestions,
  listSalesQuoteDrafts,
  saveSalesAutomationSettings,
} from "./service";

const DEFAULTS = {
  quotes_enabled: true,
  auto_send_qualified_quotes: false,
  reply_ai_enabled: true,
  quote_subject_template: "Your quotation is ready — {{customer_name}}",
  quote_body_template: "Hello {{customer_name}},\n\nThank you for your interest in {{product}}. We have prepared your quotation for {{amount}}. Reply to this email if you would like to discuss any changes.\n\nRegards,\n{{company_name}}",
};

const short = (value, count = 220) => {
  const text = String(value || "").trim();
  return text.length > count ? `${text.slice(0, count)}…` : text;
};

export default function SalesAutomation({ env }) {
  const [tab, setTab] = useState("quotes");
  const [settings, setSettings] = useState(DEFAULTS);
  const [drafts, setDrafts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canConfigure = Boolean(env.access.workflows?.edit);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [saved, nextDrafts, nextSuggestions] = await Promise.all([
        getSalesAutomationSettings(env.user.orgId),
        listSalesQuoteDrafts(env.user.orgId),
        listAiSuggestions(env.user.orgId),
      ]);
      setSettings({ ...DEFAULTS, ...(saved || {}) });
      setDrafts(nextDrafts);
      setSuggestions(nextSuggestions);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [env.user.orgId]);
  useEffect(() => { reload(); }, [reload]);
  const saveSettings = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await saveSalesAutomationSettings(env.user.orgId, {
        quotes_enabled: Boolean(settings.quotes_enabled),
        auto_send_qualified_quotes: Boolean(settings.auto_send_qualified_quotes),
        reply_ai_enabled: Boolean(settings.reply_ai_enabled),
        quote_subject_template: settings.quote_subject_template.trim(),
        quote_body_template: settings.quote_body_template.trim(),
      });
      setSettings({ ...DEFAULTS, ...saved });
      setNotice("Automation settings saved.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const dispatch = async (draftId = "") => {
    setBusyId(draftId || "all"); setError(""); setNotice("");
    try {
      const result = await dispatchSalesAutomation(env.user.orgId, draftId);
      const sent = result.sent?.length || 0;
      const failed = result.failed?.length || 0;
      setNotice(result.skipped || `${sent} quotation${sent === 1 ? "" : "s"} sent${failed ? `; ${failed} failed` : ""}.`);
      await reload();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  };
  const apply = async (id) => {
    setBusyId(id); setError("");
    try { await applyAiSuggestion(id); setNotice("Suggested next step applied."); await reload(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  };
  const dismiss = async (id) => {
    setBusyId(id); setError("");
    try { await dismissAiSuggestion(id); await reload(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  };
  return (
    <section className="crm-sales-automation">
      <div className="crm-tabs" role="tablist">
        {[['quotes', 'Automated quotes', Send], ['replies', 'Reply review', Sparkles], ['settings', 'Settings', Settings2]].map(([key, label, Icon]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`btn ${tab === key ? "btn-primary" : "btn-soft"}`} onClick={() => setTab(key)}><Icon size={15} />{label}</button>
        ))}
        <button className="btn btn-soft crm-automation-refresh" onClick={reload} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />Refresh</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {tab === "quotes" && (
        <div className="card crm-table-wrap">
          <div className="crm-sales-automation-head"><div><h3 className="card-title">Qualified lead quotations</h3><p className="form-hint">A draft is created from the lead and opportunity as soon as it becomes qualified or interested.</p></div>{canConfigure && <button className="btn btn-primary" onClick={() => dispatch()} disabled={busyId === "all" || !settings.auto_send_qualified_quotes}><Send size={15} />{busyId === "all" ? "Sending…" : "Send ready quotes"}</button>}</div>
          <table className="crm-table"><thead><tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{drafts.map((draft) => <tr key={draft.id}><td><strong>{draft.quote_reference}</strong><br /><small>{short(draft.subject, 70)}</small></td><td>{draft.recipient_email || "Email needed"}</td><td>{new Intl.NumberFormat("en-IN", { style: "currency", currency: draft.currency || "INR", maximumFractionDigits: 0 }).format(Number(draft.amount || 0))}</td><td><Badge>{draft.status}</Badge>{draft.failure_reason && <small className="form-error crm-block">{short(draft.failure_reason, 100)}</small>}</td><td>{new Date(draft.created_at).toLocaleString()}</td><td>{canConfigure && draft.status === "Ready to send" && <button className="btn btn-soft btn-xs" onClick={() => dispatch(draft.id)} disabled={Boolean(busyId)}><Mail size={13} />{busyId === draft.id ? "Sending…" : "Send now"}</button>}</td></tr>)}</tbody></table>
          {!loading && !drafts.length && <p className="empty-inline">No automated quote drafts yet. Qualify a lead or mark it interested to create one.</p>}
        </div>
      )}
      {tab === "replies" && (
        <div className="card crm-table-wrap"><div className="crm-sales-automation-head"><div><h3 className="card-title">Customer reply review</h3><p className="form-hint">Clear replies are handled by rules. Claude Haiku is only used for ambiguous messages, and its suggestion never changes a record until you apply it.</p></div><Bot size={22} /></div>
          <table className="crm-table"><thead><tr><th>Customer reply</th><th>Suggested next step</th><th>Confidence</th><th>Status</th><th /></tr></thead><tbody>{suggestions.map((suggestion) => <tr key={suggestion.id}><td><strong>{suggestion.message?.sender_email || "Customer"}</strong><br /><small>{short(suggestion.message?.subject || "(no subject)", 90)}</small><p className="crm-message-preview">{short(suggestion.message?.body_text, 220)}</p></td><td><strong>{suggestion.summary}</strong><br /><small>{suggestion.recommendation?.action?.replaceAll("_", " ") || "Review"}</small></td><td>{Math.round(Number(suggestion.confidence || 0) * 100)}%<br /><small>{suggestion.source}</small></td><td><Badge>{suggestion.status}</Badge></td><td>{suggestion.status === "Pending" && canConfigure && <div className="crm-row-actions"><button className="btn btn-primary btn-xs" onClick={() => apply(suggestion.id)} disabled={Boolean(busyId)}><Check size={13} />{busyId === suggestion.id ? "Applying…" : "Apply"}</button><button className="btn btn-soft btn-xs" onClick={() => dismiss(suggestion.id)} disabled={Boolean(busyId)}>Dismiss</button></div>}</td></tr>)}</tbody></table>
          {!loading && !suggestions.length && <p className="empty-inline">No customer email replies have been received through the inbound email webhook yet.</p>}
        </div>
      )}
      {tab === "settings" && (<div className="card crm-sales-settings">
        <h3 className="card-title">Sales automation controls</h3><p className="form-hint">Keep automatic sending off until Resend and the Edge Function are configured. Draft creation remains automatic and auditable.</p>
        {canConfigure ? <><label className="crm-check"><input type="checkbox" checked={settings.quotes_enabled} onChange={(event) => setSettings((old) => ({ ...old, quotes_enabled: event.target.checked }))} />Create a quotation draft for qualified or interested leads</label><label className="crm-check"><input type="checkbox" checked={settings.auto_send_qualified_quotes} onChange={(event) => setSettings((old) => ({ ...old, auto_send_qualified_quotes: event.target.checked }))} />Automatically email ready quotation drafts via Resend</label><label className="crm-check"><input type="checkbox" checked={settings.reply_ai_enabled} onChange={(event) => setSettings((old) => ({ ...old, reply_ai_enabled: event.target.checked }))} />Use Claude Haiku only for ambiguous customer replies</label><div className="crm-form-grid"><label className="form-field"><span className="form-label">Quote email subject</span><input className="control" maxLength="300" value={settings.quote_subject_template} onChange={(event) => setSettings((old) => ({ ...old, quote_subject_template: event.target.value }))} /></label><label className="form-field crm-full"><span className="form-label">Quote email message</span><textarea className="control" rows="8" maxLength="10000" value={settings.quote_body_template} onChange={(event) => setSettings((old) => ({ ...old, quote_body_template: event.target.value }))} /></label></div><p className="form-hint">Available placeholders: <code>{'{{customer_name}}'}</code>, <code>{'{{product}}'}</code>, <code>{'{{amount}}'}</code>, <code>{'{{company_name}}'}</code>.</p><button className="btn btn-primary" onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save automation settings"}</button></> : <p className="empty-inline">Only workspace owners and admins can change sales automation settings.</p>}
      </div>)}
    </section>
  );
}
