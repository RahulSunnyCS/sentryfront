import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { getCurrentUser, hasTier, isAuthEnabled } from '@/lib/auth/helpers';
import { getUpgradeMessage, isTierGatingEnabled } from '@/lib/tier-gating';
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

// Server-rendered upgrade prompt shown INSTEAD of the DAST wizard for users
// below the required tier. This is the UI half of a two-layer gate; the
// authoritative gate lives in POST /api/v1/active-test/start. Copy for the
// body comes from tier-gating.ts getUpgradeMessage so the gate has a single
// source of truth (no new message-catalog string is introduced — this page
// already renders hardcoded English throughout, so this stays consistent
// with the page's existing pattern).
function ActiveTestUpgradePrompt({ tier }: { tier: string }) {
  return (
    <section
      aria-label="Upgrade required"
      data-testid="active-test-upgrade-prompt"
      style={{
        maxWidth: 640,
        margin: '0 auto',
        background: 'linear-gradient(135deg, rgba(13,148,136,0.10), rgba(124,58,237,0.08))',
        border: '1px solid rgba(13,148,136,0.30)',
        borderRadius: 16,
        padding: 'clamp(28px, 5vw, 40px)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
        Active DAST testing is a paid feature
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
        {getUpgradeMessage(tier) ||
          'Upgrade to confirm exploitability with active DAST testing.'}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/pricing"
          className="btn-primary"
          style={{ padding: '13px 28px', fontSize: 15, fontWeight: 700 }}
        >
          See plans &amp; upgrade
        </Link>
        <Link
          href="/dashboard"
          className="btn-secondary"
          style={{ padding: '13px 28px', fontSize: 15, fontWeight: 600 }}
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}

export default async function ActiveTestPage({ searchParams }: ActiveTestPageProps) {
  const rawDomain = Array.isArray(searchParams?.domain)
    ? searchParams?.domain[0]
    : searchParams?.domain;
  const initialDomain = (rawDomain ?? '').trim();

  // Two-layer tier gate (UI half). When auth + tier gating are both active,
  // a user below the required 'one-shot' tier must NOT see the DAST wizard —
  // they get the upgrade prompt instead. We do NOT replace the existing auth
  // gate (middleware redirects unauthenticated requests on the protected
  // `active-test` segment) or the domain-verification gate (server route) —
  // this ADDS the missing tier gate. When auth or tier gating is disabled,
  // behaviour is byte-identical to before (the wizard renders as before),
  // matching how tier-gating is bypassed everywhere else in the app.
  let showUpgradePrompt = false;
  let currentTier = 'free';
  if (isAuthEnabled() && isTierGatingEnabled()) {
    const user = await getCurrentUser();
    currentTier = user?.tier ?? 'free';
    // The required minimum tier for the paid active-DAST surface is
    // 'one-shot' (per .claude/project/business.md — Verify unlocks 1 active
    // DAST scan; free is blocked). hasTier owns the hierarchy; we never
    // hard-code free<one-shot<pro<studio here.
    if (!hasTier(user, 'one-shot')) {
      showUpgradePrompt = true;
    }
  }

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

            {showUpgradePrompt ? (
              <ActiveTestUpgradePrompt tier={currentTier} />
            ) : (
              <ActiveTestFlow initialDomain={initialDomain} />
            )}

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
