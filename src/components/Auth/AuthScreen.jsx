import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { APP } from "../../config/appConfig";
import Logo from "../common/Logo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    if (error) setError("");
    if (notice) setNotice("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(form.email.trim())) return setError("Please enter a valid email address.");
    if (!form.password) return setError("Please enter your password.");

    if (isSignup) {
      if (!form.name.trim()) return setError("Please enter your name.");
      if (form.password.length < 6) return setError("Password must be at least 6 characters.");
      if (form.password !== form.confirm) return setError("Passwords do not match.");
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Works for both sync (local) and async (Supabase) auth implementations.
      const res = isSignup
        ? await onSignup({ name: form.name.trim(), email: form.email.trim(), password: form.password })
        : await onLogin({ email: form.email.trim(), password: form.password });

      if (!res?.ok) {
        setError(res?.error || "Something went wrong. Please try again.");
      } else if (res.needsVerification) {
        setNotice("Account created. Check your email to confirm your address, then log in.");
        setMode("login");
        setForm((f) => ({ ...f, password: "", confirm: "" }));
      }
      // On success with a session, the app re-renders to the dashboard automatically.
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
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
          <span className="auth-logo"><Logo size={26} /></span>
          <div>
            <div className="auth-brand-name">{APP.name}</div>
            <div className="auth-brand-tag">{APP.tagline}</div>
          </div>
        </div>

        <h1 className="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {isSignup ? "Sign up to get started." : "Sign in to continue to Qyrova."}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            className="auth-fields"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {isSignup && (
              <Field icon={User} label="Name" value={form.name} type="text"
                placeholder="Jane Doe" onChange={(v) => set({ name: v })} />
            )}
            <Field icon={Mail} label="Email" value={form.email} type="email"
              placeholder="you@company.com" onChange={(v) => set({ email: v })} />
            <Field icon={Lock} label="Password" value={form.password} type="password"
              placeholder="••••••••" onChange={(v) => set({ password: v })} />
            {isSignup && (
              <Field icon={Lock} label="Confirm password" value={form.confirm} type="password"
                placeholder="••••••••" onChange={(v) => set({ confirm: v })} />
            )}
          </motion.div>
        </AnimatePresence>

        {error ? <div className="auth-error"><AlertCircle size={15} /> {error}</div> : null}
        {notice ? <div className="auth-notice"><CheckCircle2 size={15} /> {notice}</div> : null}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? (
            <><Loader2 size={18} className="spin" /> Please wait…</>
          ) : isSignup ? (
            <><UserPlus size={18} /> Sign up</>
          ) : (
            <><LogIn size={18} /> Log in</>
          )}
        </button>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to Qyrova?"}{" "}
          <button type="button" className="auth-link" onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }}>
            {isSignup ? "Log in" : "Create an account"}
          </button>
        </p>
      </motion.form>
    </div>
  );
}

function Field({ icon: Icon, label, value, type, placeholder, onChange }) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <div className="auth-input">
        <Icon size={16} />
        <input
          className="auth-input-field"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}
