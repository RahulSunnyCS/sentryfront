// VibeSafe — Landing + Scanning Screens

// === Landing Page ===
function LandingPage({ onScan, accent }) {
  const [url, setUrl] = React.useState('');
  const inputRef = React.useRef(null);

  const handleScan = () => {
    const target = url.trim() || 'taskflow.app';
    onScan(target);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  const features = [
    { title: '15 security checks', desc: 'Secrets, headers, CORS, TLS, cookies, exposed paths, and more.' },
    { title: 'Under 90 seconds', desc: 'Full passive scan without touching your codebase or server.' },
    { title: 'AI fix prompts', desc: 'Every finding includes a prompt you can paste into Cursor or Lovable.' },
  ];

  const tools = ['Lovable', 'Bolt', 'v0', 'Cursor', 'Replit'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px 40px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
          borderRadius: 20, backgroundColor: 'var(--accent-light)', marginBottom: 32,
          fontSize: 13, fontWeight: 600, color: 'var(--accent)',
        }}>
          <Icons.Shield size={16} color="var(--accent)" />
          Passive scan — no config required
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.1,
          color: 'var(--text)', maxWidth: 680, marginBottom: 16,
          letterSpacing: '-0.02em', textWrap: 'balance',
        }}>
          Is your AI-built site actually secure?
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2vw, 19px)', color: 'var(--text-secondary)', maxWidth: 540,
          lineHeight: 1.6, marginBottom: 40, textWrap: 'pretty',
        }}>
          Paste a URL. Get a security report in 90 seconds. Every finding comes with a fix you can paste right into your AI coding tool.
        </p>

        {/* URL Input */}
        <div style={{
          display: 'flex', width: '100%', maxWidth: 560, borderRadius: 14,
          border: '2px solid var(--border)', backgroundColor: 'var(--surface)',
          overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
          transition: 'border-color 0.2s',
        }}
        onFocus={() => {}}
        >
          <div style={{ padding: '0 0 0 18px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
            <Icons.Globe size={20} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="taskflow.app"
            style={{
              flex: 1, padding: '16px 12px', border: 'none', outline: 'none',
              fontSize: 16, fontFamily: 'var(--font)', color: 'var(--text)',
              backgroundColor: 'transparent',
            }}
          />
          <button onClick={handleScan} style={{
            padding: '12px 28px', margin: 6, borderRadius: 10, border: 'none',
            backgroundColor: 'var(--accent)', color: '#fff', fontSize: 15,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
            display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={e => e.target.style.backgroundColor = 'var(--accent-dark)'}
          onMouseLeave={e => e.target.style.backgroundColor = 'var(--accent)'}
          >
            Scan
            <Icons.ArrowRight size={16} color="#fff" />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16 }}>
          No CLI. No config files. No security knowledge needed.
        </p>
      </div>

      {/* Features */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 20, maxWidth: 780, width: '100%', margin: '0 auto',
        padding: '0 24px 48px',
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            padding: 24, borderRadius: 12, border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Tools strip */}
      <div style={{
        textAlign: 'center', padding: '32px 24px 56px',
        borderTop: '1px solid var(--border-light)',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16, fontWeight: 500 }}>
          Built for sites made with
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {tools.map(t => (
            <span key={t} style={{
              fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.6,
              letterSpacing: '0.01em',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
window.LandingPage = LandingPage;


// === Scanning Page ===
function ScanningPage({ scanUrl, scanData, onComplete }) {
  const [completedModules, setCompletedModules] = React.useState(0);
  const [activeModule, setActiveModule] = React.useState(0);
  const modules = SCAN_MODULES;
  const total = modules.length;

  React.useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setActiveModule(idx);
      setCompletedModules(idx);
      if (idx >= total) {
        clearInterval(interval);
        setTimeout(() => onComplete(), 1200);
      }
    }, 340);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.round((completedModules / total) * 100);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 520, backgroundColor: 'var(--surface)',
        borderRadius: 16, border: '1px solid var(--border)', padding: '36px 32px',
        boxShadow: 'var(--shadow-lg)',
      }} className="screen-enter">

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <Icons.Globe size={18} color="var(--accent)" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{scanUrl}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {completedModules < total ? 'Scanning in progress...' : 'Analysis complete — preparing report'}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6, borderRadius: 3, backgroundColor: 'var(--border-light)', marginBottom: 28, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3, backgroundColor: 'var(--accent)',
            width: `${progress}%`, transition: 'width 0.3s ease-out',
          }}></div>
        </div>

        {/* Module list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {modules.map((mod, i) => {
            const isDone = i < completedModules;
            const isActive = i === activeModule && !isDone && i < total;
            const isPending = !isDone && !isActive;
            const findCount = scanData.moduleResults[mod.id] || 0;

            return (
              <div key={mod.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                borderRadius: 8, opacity: isPending ? 0.4 : 1,
                backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                transition: 'all 0.3s',
              }}>
                <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                  {isDone ? (
                    findCount > 0
                      ? <Icons.AlertCircle size={18} color={SEVERITY_CONFIG[findCount >= 2 ? 'MEDIUM' : 'HIGH'].color} />
                      : <Icons.CheckCircle size={18} color="#059669" />
                  ) : isActive ? (
                    <Icons.Spinner size={18} />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: 'var(--border)' }}></div>
                  )}
                </div>
                <span style={{
                  flex: 1, fontSize: 14, fontWeight: isDone || isActive ? 500 : 400,
                  color: isPending ? 'var(--text-tertiary)' : 'var(--text)',
                }}>{mod.name}</span>
                {isDone && findCount > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                    padding: '1px 8px', borderRadius: 10,
                    backgroundColor: 'var(--accent-light)',
                  }}>
                    {findCount} found
                  </span>
                )}
                {isDone && findCount === 0 && (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>Clear</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
          {completedModules}/{total} checks completed
        </div>
      </div>
    </div>
  );
}
window.ScanningPage = ScanningPage;
