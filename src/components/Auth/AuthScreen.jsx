import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle, Loader2, CheckCircle2, ArrowUpRight, FileText, Eye, EyeOff } from "lucide-react";
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
      <section className="auth-story">
        <div className="auth-story-brand"><Logo size={30} /><span>Qyrova.</span><ArrowUpRight size={19} /></div>
        <div className="auth-story-copy"><span className="auth-story-kicker">LESS ADMIN. MORE POSSIBILITY.</span><h2>From first quote<br />to next <em>yes.</em></h2><p>A thoughtful workspace for the details, documents, and decisions that move your business forward.</p></div>
        <div className="auth-document" aria-hidden="true"><div className="auth-document-head"><FileText size={22} /><span>Quotation preview</span><span className="auth-doc-number">01</span></div><h3>Built for your business.</h3><p>Your brand. Your fields. Your next opportunity.</p>{["Project scope", "Services & pricing", "Terms & details"].map((label) => <div className="auth-document-line" key={label}><span>{label}</span><span /></div>)}<div className="auth-document-ready"><CheckCircle2 size={16} />Ready for the next step</div></div>
        <div className="auth-story-foot"><span>Clarity at every step.</span><span>Designed around you ↗</span></div>
      </section>
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

        <span className="screen-eyebrow">YOUR WORKSPACE AWAITS</span>
        <h1 className="auth-title">{isSignup ? "Start something better." : "Welcome back."}</h1>
        <p className="auth-sub">
          {isSignup ? "Create an account and make every quotation count." : "Sign in and pick up where you left off."}
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
  const [showPassword, setShowPassword] = useState(false);
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <div className="auth-input">
        <Icon size={16} />
        <input
          className="auth-input-field"
          aria-label={label}
          type={type === "password" && showPassword ? "text" : type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {type === "password" && <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
      </div>
    </label>
  );
}
