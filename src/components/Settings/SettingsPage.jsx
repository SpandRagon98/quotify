import { useRef, useState } from "react";
import { Sun, Moon, Check, Upload, User as UserIcon, Save } from "lucide-react";
import { ACCENTS } from "../../config/appConfig";

export default function SettingsPage({ settings, setMode, setAccent, user, onUpdateProfile }) {
  const [name, setName] = useState(user.name || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const pickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Please choose an image under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    onUpdateProfile({ name: name.trim() || user.email, avatar });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Settings</h1>
          <p className="screen-sub">Personalise the look of Qyrova and manage your profile.</p>
        </div>
      </header>

      <div className="card">
        <h3 className="card-title">Appearance</h3>

        <div className="settings-block">
          <div className="settings-label">Theme mode</div>
          <div className="mode-toggle">
            <button
              className={`mode-pill ${settings.mode === "light" ? "is-active" : ""}`}
              onClick={() => setMode("light")}
            >
              <Sun size={16} /> Light
            </button>
            <button
              className={`mode-pill ${settings.mode === "dark" ? "is-active" : ""}`}
              onClick={() => setMode("dark")}
            >
              <Moon size={16} /> Dark
            </button>
          </div>
        </div>

        <div className="settings-block">
          <div className="settings-label">Accent color</div>
          <div className="accent-grid">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                className={`accent-swatch ${settings.accent === a.value ? "is-active" : ""}`}
                style={{ background: a.color }}
                title={a.label}
                onClick={() => setAccent(a.value)}
              >
                {settings.accent === a.value && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Profile</h3>
        <div className="profile-row">
          <div className="profile-avatar">
            {avatar ? <img src={avatar} alt="avatar" /> : <UserIcon size={28} />}
          </div>
          <div className="profile-avatar-actions">
            <button className="btn btn-soft" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Upload image
            </button>
            {avatar && (
              <button className="btn btn-ghost btn-xs" onClick={() => setAvatar("")}>
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">Display name</span>
            <input className="control" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">Email</span>
            <input className="control" value={user.email} disabled />
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveProfile}>
            {saved ? <Check size={18} /> : <Save size={18} />} {saved ? "Saved" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
