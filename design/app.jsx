// VibeSafe — Main App

function App() {
  const [screen, setScreen] = React.useState('landing');
  const [scanUrl, setScanUrl] = React.useState('');
  const { tweaks: t, setTweak } = useTweaks(TWEAK_DEFAULTS);

  // Determine which scan data to show
  const scanData = t.sampleScan === 'good' ? GOOD_SCAN : BAD_SCAN;

  // Apply accent theme
  React.useEffect(() => {
    const theme = ACCENT_THEMES[t.accent] || ACCENT_THEMES.teal;
    const r = document.documentElement;
    r.style.setProperty('--accent', theme.main);
    r.style.setProperty('--accent-light', theme.light);
    r.style.setProperty('--accent-dark', theme.dark);
  }, [t.accent]);

  const handleScan = (url) => {
    setScanUrl(url);
    setScreen('scanning');
  };

  const handleScanComplete = () => {
    setScreen('report');
  };

  const handleNewScan = () => {
    setScreen('landing');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Nav bar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        backgroundColor: 'rgba(250, 250, 248, 0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <button onClick={handleNewScan} style={{
          display: 'flex', alignItems: 'center', gap: 8, border: 'none',
          background: 'none', cursor: 'pointer', padding: 0,
        }}>
          <Icons.Shield size={24} color="var(--accent)" />
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', fontFamily: 'var(--font)' }}>
            VibeSafe
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {screen === 'report' && (
            <>
              <button onClick={handleNewScan} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                New scan
              </button>
              <button style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                backgroundColor: 'var(--accent)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: '#fff',
                fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Icons.ExternalLink size={13} color="#fff" />
                Share
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Screen content */}
      <div style={{ paddingTop: 56 }} key={screen}>
        {screen === 'landing' && (
          <LandingPage onScan={handleScan} accent={t.accent} />
        )}
        {screen === 'scanning' && (
          <ScanningPage
            scanUrl={scanUrl || scanData.url}
            scanData={scanData}
            onComplete={handleScanComplete}
          />
        )}
        {screen === 'report' && (
          <ReportPage
            scanData={scanData}
            gradeStyle={t.gradeStyle}
            cardStyle={t.cardStyle}
            onNewScan={handleNewScan}
          />
        )}
      </div>

      {/* Tweaks Panel */}
      <TweaksPanel>
        <TweakSection label="Visual Direction">
          <TweakRadio label="Accent"
            value={t.accent}
            options={['teal', 'indigo', 'violet']}
            onChange={v => setTweak('accent', v)}
          />
          <TweakRadio label="Grade display"
            value={t.gradeStyle}
            options={['ring', 'shield', 'letter']}
            onChange={v => setTweak('gradeStyle', v)}
          />
          <TweakSelect label="Card style"
            value={t.cardStyle}
            options={['elevated', 'bordered', 'flat']}
            onChange={v => setTweak('cardStyle', v)}
          />
        </TweakSection>
        <TweakSection label="Demo Data">
          <TweakRadio label="Sample scan"
            value={t.sampleScan}
            options={['bad', 'good']}
            onChange={v => { setTweak('sampleScan', v); if (screen !== 'report') setScreen('report'); }}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
