import { useState } from "react";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "../auth/roles";
import { rpc } from "./service";
export default function TeamMembers({ env, permissionsOnly = false }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("sales_user");
  const [team, setTeam] = useState("");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const action = async (fn) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      env.refresh();
      setMessage(
        "Workspace access updated. Members should reopen Qyrova to refresh their role.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">
            {permissionsOnly ? "Roles & permissions" : "Team members"}
          </h1>
          <p className="screen-sub">
            One workspace membership system, enforced by database permissions.
          </p>
        </div>
      </header>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      {!permissionsOnly && (
        <>
          <div className="card">
            <h3 className="card-title">Add an existing Qyrova user</h3>
            <p className="form-hint">
              The person must sign up first. This grants workspace membership;
              it does not send an invitation email or change their personal
              workspace. They can switch workspaces in the sidebar.
            </p>
            <form
              className="crm-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                action(() =>
                  rpc("crm_set_member", {
                    p_org: env.user.orgId,
                    p_email: email,
                    p_role: role,
                    p_team: team || null,
                  }),
                );
              }}
            >
              <input
                className="control"
                type="email"
                required
                placeholder="Member email"
                aria-label="Member email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select
                className="control"
                value={role}
                aria-label="Member role"
                onChange={(e) => setRole(e.target.value)}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <select
                className="control"
                value={team}
                aria-label="Member team"
                onChange={(e) => setTeam(e.target.value)}
              >
                <option value="">No team</option>
                {env.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" disabled={busy}>
                Add / update member
              </button>
            </form>
          </div>
          <div className="card crm-table-wrap">
            <h3 className="card-title">Members</h3>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Name / email</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {env.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.name}
                      <small className="crm-block">{m.email}</small>
                    </td>
                    <td>{ROLE_LABELS[m.role]}</td>
                    <td>
                      {env.teams.find((t) => t.id === m.team_id)?.name ||
                        "No team"}
                    </td>
                    <td>
                      {m.role !== "owner" && m.id !== env.user.id && (
                        <button
                          className="btn btn-soft"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${m.name} from this workspace? Reassign their records first.`,
                              )
                            )
                              action(() =>
                                rpc("crm_set_member", {
                                  p_org: env.user.orgId,
                                  p_email: m.email,
                                  p_role: m.role,
                                  p_remove: true,
                                }),
                              );
                          }}
                        >
                          Remove membership
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3 className="card-title">Teams</h3>
            <form
              className="crm-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                action(() =>
                  rpc("crm_create_team", {
                    p_org: env.user.orgId,
                    p_name: teamName,
                  }),
                );
              }}
            >
              <input
                className="control"
                required
                maxLength={120}
                placeholder="Team name"
                aria-label="Team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <button className="btn btn-primary" disabled={busy}>
                Create team
              </button>
            </form>
            <p>{env.teams.map((t) => t.name).join(" · ") || "No teams yet."}</p>
          </div>
        </>
      )}
      <div className="card crm-table-wrap">
        <h3 className="card-title">Default permission policy</h3>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Visibility / CRM operations</th>
              <th>Administration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Owner / Admin</td>
              <td>All workspace records; create, edit, archive, export.</td>
              <td>
                Members, teams, workflows and configuration. Cannot change the
                Owner or own access.
              </td>
            </tr>
            <tr>
              <td>Editor (existing)</td>
              <td>All records; create, edit, export, no archive.</td>
              <td>No members / workflows.</td>
            </tr>
            <tr>
              <td>Sales Manager</td>
              <td>
                Own and same-team records; create, edit, archive, export. A
                manager without a team sees their own records only.
              </td>
              <td>Reports; no membership / workflow administration.</td>
            </tr>
            <tr>
              <td>Sales User</td>
              <td>
                Assigned / owned records; create, edit, export, no archive.
              </td>
              <td>Own-scoped reports.</td>
            </tr>
            <tr>
              <td>Finance</td>
              <td>
                Commercial customer/deal view and quotation/document operations.
              </td>
              <td>No lead/activity/workflow administration.</td>
            </tr>
            <tr>
              <td>Viewer</td>
              <td>
                Workspace-wide read-only; no mutations or export endpoint
                access.
              </td>
              <td>No administration.</td>
            </tr>
            <tr>
              <td>Doc Viewer (existing)</td>
              <td>Documents only.</td>
              <td>No CRM.</td>
            </tr>
          </tbody>
        </table>
        <p className="form-hint">
          Reading records inherently allows copying visible information; an
          export permission cannot prevent that. Google integrations retain
          their existing external sharing rules.
        </p>
      </div>
    </div>
  );
}
