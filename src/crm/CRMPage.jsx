import { useCRM } from "./context";
import RecordList from "./RecordList";
import RecordDetail from "./RecordDetail";
import Pipeline from "./Pipeline";
import ManagementDashboard from "./ManagementDashboard";
import LeadInbox from "./LeadInbox";
import Workflows from "./Workflows";
import TeamMembers from "./TeamMembers";
export default function CRMPage({ view, go, presets, onCreateQuote }) {
  const env = useCRM();
  if (env.loading)
    return (
      <div className="screen empty-inline">Loading your CRM workspace…</div>
    );
  if (env.error)
    return (
      <div className="screen">
        <div className="alert alert-error">{env.error}</div>
        <button className="btn btn-soft" onClick={env.refresh}>
          Retry
        </button>
        <button className="btn btn-soft" onClick={() => go("dashboard")}>
          Open existing Overview
        </button>
      </div>
    );
  if (view.name === "crm_dashboard" || view.name === "reports")
    return (
      <ManagementDashboard
        env={env}
        go={go}
        reports={view.name === "reports"}
      />
    );
  if (view.name === "crm_record")
    return (
      <RecordDetail
        key={`${view.entity}:${view.id}`}
        entity={view.entity}
        id={view.id}
        env={env}
        go={go}
        presets={presets}
        onCreateQuote={onCreateQuote}
      />
    );
  if (view.name === "opportunities") return <Pipeline env={env} go={go} />;
  if (view.name === "inbox") return <LeadInbox env={env} go={go} />;
  if (view.name === "workflows") return <Workflows env={env} />;
  if (view.name === "users" || view.name === "permissions")
    return (
      <TeamMembers env={env} permissionsOnly={view.name === "permissions"} />
    );
  return <RecordList entity={view.name} env={env} go={go} />;
}
