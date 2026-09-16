import { useState } from "react";
import { useCRM } from "./context";
import { rpc } from "./service";
import { STORAGE_KEYS } from "../config/appConfig";
export default function WorkspaceSwitcher() {
  const env = useCRM();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!env?.workspaces.length) return null;
  return (
    <div className="crm-workspace-switch nav-label">
      <select
        className="control"
        value={env.user.orgId}
        disabled={busy}
        aria-label="Workspace"
        onChange={async (e) => {
          setBusy(true);
          setError("");
          try {
            await rpc("crm_switch_workspace", { p_org: e.target.value });
            [
              STORAGE_KEYS.presets,
              STORAGE_KEYS.companyLogos,
              STORAGE_KEYS.emailTemplates,
              STORAGE_KEYS.docRegistry,
              STORAGE_KEYS.notifications,
              STORAGE_KEYS.notifSeen,
            ].forEach((key) => localStorage.removeItem(key));
            window.location.reload();
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        {env.workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {error && <small className="form-error">{error}</small>}
    </div>
  );
}
