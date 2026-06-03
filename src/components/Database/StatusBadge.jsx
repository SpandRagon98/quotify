/** Coloured status pill for the Approve / Decline / Negotiate columns. */
const STYLES = {
  approved: { bg: "#2b9a66", label: "Approved" }, // green
  declined: { bg: "#e5484d", label: "Declined" }, // red
  negotiate: { bg: "#b7791f", label: "Negotiate" }, // dark yellow
};

export default function StatusBadge({ value }) {
  const key = String(value || "").trim().toLowerCase();
  const style = STYLES[key];
  if (!style) return <span className="status-empty">—</span>;
  return (
    <span className="status-badge" style={{ background: style.bg }}>
      {style.label}
    </span>
  );
}
