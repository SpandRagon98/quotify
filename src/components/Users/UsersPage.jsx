import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { ROLE_LABELS, ASSIGNABLE_ROLES, ROLES } from "../../auth/roles";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UsersPage({ userList, currentEmail, onUpsert, onRemove }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLES.EDITOR);
  const [error, setError] = useState("");

  const add = () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    onUpsert(value, role);
    setEmail("");
    setError("");
  };

  return (
    <div className="screen screen-wide">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Users &amp; Access</h1>
          <p className="screen-sub">Invite teammates by email and assign their role.</p>
        </div>
      </header>

      <div className="card">
        <h3 className="card-title">Add or update a user</h3>
        <div className="user-add-row">
          <div className="form-field user-add-email">
            <span className="form-label">Email</span>
            <input
              className={`control ${error ? "control-error" : ""}`}
              value={email}
              placeholder="teammate@company.com"
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            {error ? <span className="form-error">{error}</span> : null}
          </div>
          <div className="form-field user-add-role">
            <span className="form-label">Role</span>
            <select className="control" value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary user-add-btn" onClick={add}>
            <UserPlus size={16} /> Add user
          </button>
        </div>
        <div className="role-legend">
          <AlertCircle size={14} />
          <span>
            <strong>Admin</strong>: full access · <strong>Editor</strong>: everything except
            deleting records · <strong>Doc Viewer</strong>: Doc View only.
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Members</h3>
        <div className="user-list">
          <AnimatePresence initial={false}>
            {userList.map((u) => (
              <motion.div
                key={u.email}
                className="user-row"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
                <div className="user-row-main">
                  <span className="user-email">
                    {u.email}
                    {u.email === currentEmail && <span className="user-you">you</span>}
                  </span>
                </div>
                <div className="user-row-actions">
                  {u.owner ? (
                    <span className="user-owner-badge"><ShieldCheck size={13} /> Owner</span>
                  ) : (
                    <>
                      <select
                        className="control user-role-select"
                        value={u.role}
                        onChange={(e) => onUpsert(u.email, e.target.value)}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <button
                        className="icon-btn icon-btn-danger"
                        title="Remove user"
                        onClick={() => {
                          if (window.confirm(`Remove ${u.email}?`)) onRemove(u.email);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
