interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
}

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Codifie"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="cdf-hood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <radialGradient id="cdf-glow">
          <stop offset="0%" stopColor="#7DF9FF" />
          <stop offset="60%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M 32 6 C 14 6, 8 18, 8 32 L 8 52 C 8 56, 10 58, 14 58 L 50 58 C 54 58, 56 56, 56 52 L 56 32 C 56 18, 50 6, 32 6 Z"
        fill="url(#cdf-hood)"
      />
      <ellipse cx="32" cy="34" rx="17" ry="15" fill="#000" />
      <circle cx="25" cy="33" r="6" fill="url(#cdf-glow)" />
      <circle cx="39" cy="33" r="6" fill="url(#cdf-glow)" />
      <circle cx="25" cy="33" r="2.4" fill="#7DF9FF" />
      <circle cx="39" cy="33" r="2.4" fill="#7DF9FF" />
    </svg>
  );
}

export function Logo({ size = 22, showWordmark = true, wordmarkColor = 'var(--text)' }: LogoProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          style={{
            fontSize: Math.round(size * 0.82),
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: wordmarkColor,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          Codifie
          <span style={{ color: '#00D4FF', fontWeight: 600, marginLeft: 4 }}>Scan</span>
        </span>
      )}
    </span>
  );
}
