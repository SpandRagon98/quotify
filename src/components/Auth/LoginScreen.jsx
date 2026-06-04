import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, LogIn, Mail } from "lucide-react";
import { APP } from "../../config/appConfig";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    onLogin(value);
  };

  return (
    <div className="auth-shell">
      <motion.form
        className="auth-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="auth-brand">
          <div className="brand-mark"><FileText size={22} strokeWidth={2.5} /></div>
          <div>
            <div className="auth-brand-name">{APP.name}</div>
            <div className="auth-brand-tag">{APP.tagline}</div>
          </div>
        </div>

        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">Enter your email to continue.</p>

        <label className="form-field">
          <span className="form-label">Email</span>
          <div className="auth-input">
            <Mail size={16} />
            <input
              className="auth-input-field"
              type="email"
              value={email}
              autoFocus
              placeholder="you@company.com"
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
            />
          </div>
          {error ? <span className="form-error">{error}</span> : null}
        </label>

        <button className="btn btn-primary auth-submit" type="submit">
          <LogIn size={18} /> Continue
        </button>

        <p className="auth-note">
          Access is granted by the workspace owner. If you can't get in, ask them to add your email.
        </p>
      </motion.form>
    </div>
  );
}
