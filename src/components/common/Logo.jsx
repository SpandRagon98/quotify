/**
 * Qyrova logo — a clean geometric "Q" mark drawn with `currentColor` so it
 * adapts to light/dark themes automatically (no background glow).
 *
 * To use an official logo file instead, drop it in `public/` and swap the <svg>
 * below for an <img src="/qyrova-logo.svg" />.
 */
export default function Logo({ size = 22, withWordmark = false, className = "" }) {
  return (
    <span className={`qyrova-logo ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="15" cy="15" r="8.5" stroke="currentColor" strokeWidth="3" />
        <path d="M19.5 19.5 L26 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {withWordmark && <span className="qyrova-wordmark">Qyrova</span>}
    </span>
  );
}
