import { motion } from "framer-motion";
import { ShieldAlert, LogOut } from "lucide-react";

export default function NoAccessScreen({ email, onLogout }) {
  return (
    <div className="auth-shell">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="auth-icon-danger"><ShieldAlert size={26} /></div>
        <h1 className="auth-title">No access</h1>
        <p className="auth-sub">
          <strong>{email}</strong> hasn't been granted access to this workspace.
          Please ask the owner or an admin to add your email and assign a role.
        </p>
        <button className="btn btn-soft auth-submit" onClick={onLogout}>
          <LogOut size={18} /> Sign in with a different email
        </button>
      </motion.div>
    </div>
  );
}
