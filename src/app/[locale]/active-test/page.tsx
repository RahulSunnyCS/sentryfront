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
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
