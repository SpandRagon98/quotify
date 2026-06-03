export default function DetailBox({ label, value }) {
  return (
    <div className="detail-box">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value || "—"}</div>
    </div>
  );
}
