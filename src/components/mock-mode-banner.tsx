// Shown only when NEXT_PUBLIC_API_URL is not configured.
// In production with a real backend this component is never rendered.
export function MockModeBanner() {
  return (
    <div style={{
      backgroundColor: '#FFF7ED', borderBottom: '1px solid #FED7AA',
      padding: '8px 24px', textAlign: 'center',
      fontSize: 13, color: '#92400E',
    }}>
      <strong>Demo mode</strong> — no backend configured. Showing fixture data.
      Set <code style={{ fontFamily: 'var(--mono)', backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: 3 }}>NEXT_PUBLIC_API_URL</code> to connect a real scan engine.
    </div>
  );
}
