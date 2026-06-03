export default function ToggleField({ label, checked, onChange }) {
  return (
    <label className="toggle-card">
      <span className="toggle-label">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
