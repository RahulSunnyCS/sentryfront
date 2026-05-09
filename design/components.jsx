// VibeSafe — Shared UI Components

// === Icons ===
const Icons = {
  Check: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  CheckCircle: ({ size = 18, color = '#059669' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.12"></circle>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5"></circle>
      <polyline points="8 12 11 15 16 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"></polyline>
    </svg>
  ),
  AlertCircle: ({ size = 18, color = '#E11D48' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.12"></circle>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5"></circle>
      <line x1="12" y1="8" x2="12" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round"></line>
      <circle cx="12" cy="16.5" r="1" fill={color}></circle>
    </svg>
  ),
  Spinner: ({ size = 18, color = 'var(--accent)' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" opacity="0.2"></circle>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  ),
  ChevronDown: ({ size = 18, color = 'currentColor', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  ),
  Copy: ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  ),
  ArrowRight: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  ),
  Shield: ({ size = 24, color = 'var(--accent)' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" fill={color} opacity="0.1" stroke={color} strokeWidth="1.5"></path>
      <polyline points="9 12 11 14 15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></polyline>
    </svg>
  ),
  ExternalLink: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  ),
  Search: ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  Globe: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  ),
  FileText: ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
  ),
  Clock: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
};
window.Icons = Icons;

// === Severity Badge ===
function SeverityBadge({ severity, size = 'md' }) {
  const config = SEVERITY_CONFIG[severity];
  const sizes = {
    sm: { fontSize: 10, padding: '2px 6px', fontWeight: 600 },
    md: { fontSize: 11, padding: '3px 8px', fontWeight: 700 },
    lg: { fontSize: 12, padding: '4px 10px', fontWeight: 700 },
  };
  const s = sizes[size] || sizes.md;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      padding: s.padding,
      borderRadius: 4,
      backgroundColor: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font)',
    }}>{severity}</span>
  );
}
window.SeverityBadge = SeverityBadge;

// === Grade Displays ===

// Ring variant
function GradeRing({ grade, size = 160, animated = true }) {
  const config = GRADE_CONFIG[grade];
  const r = (size / 2) - 12;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = React.useState(animated ? circ : circ * (1 - config.fill));

  React.useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setOffset(circ * (1 - config.fill)), 100);
      return () => clearTimeout(timer);
    }
  }, [grade, animated]);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" opacity="0.5"></circle>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={config.color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: animated ? 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }}
        ></circle>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.36, fontWeight: 800, color: config.color, lineHeight: 1 }}>{grade}</span>
        <span style={{ fontSize: size * 0.09, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{config.label}</span>
      </div>
    </div>
  );
}
window.GradeRing = GradeRing;

// Shield variant
function GradeShield({ grade, size = 160 }) {
  const config = GRADE_CONFIG[grade];
  const s = size;
  return (
    <div style={{ position: 'relative', width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={s * 0.75} height={s * 0.88} viewBox="0 0 60 70" fill="none">
        <path d="M30 2L56 16v20c0 18-11 28-26 32C15 64 4 54 4 36V16L30 2z" fill={config.color} opacity="0.1" stroke={config.color} strokeWidth="2"></path>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', paddingBottom: 4,
      }}>
        <span style={{ fontSize: s * 0.32, fontWeight: 800, color: config.color, lineHeight: 1 }}>{grade}</span>
        <span style={{ fontSize: s * 0.085, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{config.label}</span>
      </div>
    </div>
  );
}
window.GradeShield = GradeShield;

// Large letter variant
function GradeLetter({ grade, size = 160 }) {
  const config = GRADE_CONFIG[grade];
  return (
    <div style={{
      width: size, height: size, borderRadius: size, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', backgroundColor: config.bg,
      border: `3px solid ${config.color}`,
    }}>
      <span style={{ fontSize: size * 0.42, fontWeight: 800, color: config.color, lineHeight: 1 }}>{grade}</span>
      <span style={{ fontSize: size * 0.09, fontWeight: 600, color: config.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{config.label}</span>
    </div>
  );
}
window.GradeLetter = GradeLetter;

// === Severity Summary Bar ===
function SeveritySummary({ summary }) {
  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const total = order.reduce((s, k) => s + (summary[k] || 0), 0);
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {order.map(sev => {
        const count = summary[sev] || 0;
        if (count === 0) return null;
        const config = SEVERITY_CONFIG[sev];
        return (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: config.color }}></div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{count}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{sev.toLowerCase()}</span>
          </div>
        );
      })}
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 4 }}>{total} total</div>
    </div>
  );
}
window.SeveritySummary = SeveritySummary;

// === Copy Button ===
function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
      background: copied ? 'var(--accent)' : 'var(--surface)', cursor: 'pointer',
      fontSize: 13, fontWeight: 500, color: copied ? '#fff' : 'var(--text-secondary)',
      fontFamily: 'var(--font)', transition: 'all 0.2s',
    }}>
      {copied ? <Icons.Check size={14} color="#fff" /> : <Icons.Copy size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
window.CopyButton = CopyButton;
