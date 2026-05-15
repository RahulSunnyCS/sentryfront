import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { ActiveTestFlow } from './active-test-flow';

export const metadata: Metadata = {
  title: 'Active security testing — DAST scan',
  description:
    'Run real attack probes against your verified domain — SQL injection, XSS, API fuzzing, auth bypass. Get CONFIRMED exploitable findings, not guesses. 3 credits, ~8 minutes, replaces a $5,000 manual pentest.',
  alternates: { canonical: '/active-test' },
  openGraph: {
    title: 'Active security testing — DAST scan',
    description:
      'Real attack probes, rate-limited, opt-in, with confirmed proof. Replaces a $5,000 pentest for ~$3.48.',
    url: '/active-test',
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

interface ActiveTestPageProps {
  searchParams?: { domain?: string | string[] };
}

function ActiveComingSoonCard({
  emoji, color, bg, border, title, desc,
}: {
  emoji: string;
  color: string;
  bg: string;
  border: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color,
            background: 'rgba(0,0,0,0.06)',
            border: `1px solid ${border}`,
            borderRadius: 6,
            padding: '3px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          COMING SOON
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', marginBottom: 6, color: 'var(--text)' }}>{title}</div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>{desc}</p>
    </div>
  );
}

export default function ActiveTestPage({ searchParams }: ActiveTestPageProps) {
  const rawDomain = Array.isArray(searchParams?.domain)
    ? searchParams?.domain[0]
    : searchParams?.domain;
  const initialDomain = (rawDomain ?? '').trim();
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">
            <header style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(220,38,38,0.12)',
                  color: '#DC2626',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <span aria-hidden="true" className="pulse-soft">●</span>
                Active security testing
              </div>
              <h1 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>
                We try to break your site. Before attackers do.
              </h1>
              <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
                Five steps. ~8 minutes. CONFIRMED proof of exploit, never speculative. Rate-limited and opt-in —
                we only test what you tell us to.
              </p>
            </header>

            <ActiveTestFlow initialDomain={initialDomain} />

            <div
              style={{
                marginTop: 'var(--space-16)',
                paddingTop: 'var(--space-10)',
                borderTop: '1px solid var(--border)',
              }}
            >
              <h2
                className="text-h3"
                style={{ marginBottom: 8, textAlign: 'center' }}
              >
                Coming soon
              </h2>
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  marginBottom: 'var(--space-8)',
                }}
              >
                More scan modes on the way
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 'var(--space-4)',
                  maxWidth: 680,
                  margin: '0 auto',
                }}
              >
                <ActiveComingSoonCard
                  emoji="🔗"
                  color="#7C3AED"
                  bg="rgba(124,58,237,0.07)"
                  border="rgba(124,58,237,0.20)"
                  title="GitHub Scanning"
                  desc="Connect your repo and catch secrets, vulnerable deps, and anti-patterns on every pull request — no domain verification needed."
                />
                <ActiveComingSoonCard
                  emoji="🧩"
                  color="#0D9488"
                  bg="rgba(13,148,136,0.07)"
                  border="rgba(13,148,136,0.20)"
                  title="Chrome Extension"
                  desc="Get instant security grades and live alerts as you browse, right from your browser toolbar."
                />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
