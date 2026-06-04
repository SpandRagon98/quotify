/** Dependency-free SVG donut chart for status distribution. */
export default function DonutChart({ segments, total, size = 168, stroke = 20 }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const center = size / 2;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      {total > 0 &&
        segments.map((s, i) => {
          if (!s.value) return null;
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          );
          offset += len;
          return el;
        })}
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="donut-total">
        {total}
      </text>
      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="donut-sub">
        Total
      </text>
    </svg>
  );
}
