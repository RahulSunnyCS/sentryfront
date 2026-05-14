import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { CheckoutButton } from '@/components/checkout-button';

export const metadata: Metadata = {
  title: 'Pricing — One free scan a week, pay for active testing',
  description:
    'Free tier: 1 fully-unlocked passive scan a week. Verify ($9): one active DAST scan. Active Pack ($29): 5 DAST scans. Monitor ($15/mo): unlimited passive scans + regression alerts.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'VibeSafe Pricing — Free passive scanning, pay for proof',
    description:
      'Passive scans are free with login. Active DAST testing (real attack probes) starts at $9. Monitoring at $15/mo per domain.',
    url: '/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeSafe Pricing — Free passive scanning, pay for proof',
    description:
      'Passive scans are free with login. Active DAST testing (real attack probes) starts at $9. Monitoring at $15/mo per domain.',
  },
};

interface Tier {
  name: string;
  desc: string;
  price: number;
  cadence: string;
  badge?: string;
  badgeColor?: string;
  featured: boolean;
  btnLabel: string;
  features: string[];
  tier: 'one-shot' | 'pro' | 'studio';
}

const PRICING_TIERS: Tier[] = [
  {
    name: 'Verify',
    desc: 'Confirm one finding is real',
    price: 9,
    cadence: 'one-time',
    featured: false,
    btnLabel: 'Buy Verify — $9',
    features: ['1 active DAST scan on a verified domain', 'Real SQLi / XSS / auth-bypass probes', 'Scan history retention', 'No subscription'],
    tier: 'one-shot',
  },
  {
    name: 'Active Pack',
    desc: 'Best value for AI builders',
    price: 29,
    cadence: 'one-time',
    featured: true,
    btnLabel: 'Buy Active Pack — $29',
    features: ['5 active DAST scans', 'Credits never expire', 'Priority scan queue', 'Scan history + PDF export'],
    tier: 'pro',
    badge: 'Most popular',
    badgeColor: 'var(--accent)',
  },
  {
    name: 'Monitor',
    desc: 'Continuous coverage per domain',
    price: 15,
    cadence: 'per month',
    featured: false,
    btnLabel: 'Subscribe — $15/mo',
    features: ['Unlimited passive scans on the domain', 'Daily auto-scan with regression alerts', 'Scan diff + email/Slack notifications', 'Cancel anytime'],
    tier: 'studio',
  },
];

const FAQS = [
  { q: 'Is the free tier really fully unlocked?', a: 'Yes. One passive scan per week, all findings shown, all AI fix prompts visible, PDF export available. The weekly quota is the only limit — there is no "X findings hidden" banner or paywall inside the report.' },
  { q: 'What counts against the weekly quota?', a: 'Each completed passive scan you start while signed in. Anonymous scans run on a separate IP-based rate limit (10/hour). You need to sign in to view the report.' },
  { q: 'What is an active DAST scan?', a: 'Real attack probes (SQL injection, XSS, auth bypass, API fuzzing) sent against a verified domain. Rate-limited, opt-in, identifies itself with an X-Scanner header. Replaces a $5,000 manual pentest for $9.' },
  { q: 'Why charge for active testing but not passive?', a: 'Passive scanning is HTTP + pattern matching — near-zero marginal cost. Active testing burns real compute and requires domain verification. We charge for the expensive thing.' },
  { q: 'Can I get a refund?', a: 'Yes. 30-day money-back guarantee on Verify and Active Pack. Monitor subscriptions are pro-rated.' },
  { q: 'What about teams?', a: 'Team tier (multi-domain, RBAC, audit log, SAML) is on the roadmap. Email sales@vibesafe.app to get on the early list.' },
];

const PRICING_LD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'VibeSafe Active Testing & Monitoring',
  description: 'Active DAST testing and continuous passive monitoring for AI-built sites.',
  brand: { '@type': 'Brand', name: 'VibeSafe' },
  offers: PRICING_TIERS.map((t) => ({
    '@type': 'Offer',
    name: `${t.name} — $${t.price} ${t.cadence}`,
    price: t.price.toFixed(2),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `https://vibesafe.app/pricing#${t.name.toLowerCase().replace(/\s+/g, '-')}`,
  })),
};

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">

            {/* Header */}
            <header style={{ textAlign: 'center', marginBottom: 'var(--space-16)' }}>
              <div className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>Pricing</div>
              <h1 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
                Passive scanning is free. Pay only to prove findings are real.
              </h1>
              <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
                One full passive scan a week is free (sign-in required). Pay for active DAST testing or continuous monitoring.
              </p>
            </header>

            {/* Free Tier */}
            <section
              aria-label="Free tier"
              id="free"
              style={{
                maxWidth: 800,
                margin: '0 auto var(--space-12)',
                background: 'var(--surface)',
                border: '2px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'clamp(24px, 4vw, 32px)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-4)',
                }}
              >
                Free · No card required
              </div>
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
                1 full passive scan every week
              </h2>
              <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', maxWidth: 560, marginInline: 'auto' }}>
                All findings shown. All AI fix prompts visible. PDF export included. The weekly quota is the only limit — no hidden findings, no Pro Lock.
              </p>
              <a href="/" className="btn-primary">Run a free scan</a>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-4)' }}>
                Need a second scan in the same week? Upgrade below.
              </p>
            </section>

            {/* Value prop strip */}
            <section
              aria-label="What's included"
              style={{
                maxWidth: 800,
                margin: '0 auto var(--space-16)',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(13,148,136,0.07), rgba(20,184,166,0.02))',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
              }}
            >
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Every passive scan includes:
              </div>
              <ul
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 'var(--space-4)',
                  flexWrap: 'wrap',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text-secondary)',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                }}
              >
                <li>Security <strong style={{ color: 'var(--text)' }}>(15 modules)</strong></li>
                <li>Performance <strong style={{ color: 'var(--text)' }}>(Core Web Vitals)</strong></li>
                <li>Accessibility <strong style={{ color: 'var(--text)' }}>(WCAG 2.2 AA)</strong></li>
                <li>SEO <strong style={{ color: 'var(--text)' }}>(crawlability + meta)</strong></li>
              </ul>
            </section>

            {/* Paid tiers anchor */}
            <section aria-label="Paid tiers" style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
              <h2 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>Pay to prove it&apos;s exploitable</h2>
              <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                Active DAST testing sends real attack probes against a verified domain. Replaces a manual pentest at 0.2% of the cost.
              </p>
            </section>

            {/* Pricing cards */}
            <section
              aria-label="Pricing tiers"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 'var(--space-5)',
                maxWidth: 1000,
                margin: '0 auto var(--space-20)',
              }}
            >
              {PRICING_TIERS.map((t) => (
                <PricingCard key={t.name} {...t} />
              ))}
            </section>

            {/* FAQ */}
            <section aria-labelledby="pricing-faq-heading" style={{ maxWidth: 720, margin: '0 auto' }}>
              <h2 id="pricing-faq-heading" className="text-h2" style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
                Common questions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {FAQS.map((f, i) => (
                  <details key={f.q} open={i === 0} className="card" style={{ padding: 0 }}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        listStyle: 'none',
                        padding: 'var(--space-5) var(--space-6)',
                        fontWeight: 600,
                        fontSize: 'var(--fs-lg)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-4)',
                      }}
                    >
                      <span>{f.q}</span>
                      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)', fontSize: 20, flexShrink: 0 }}>+</span>
                    </summary>
                    <div
                      style={{
                        padding: '0 var(--space-6) var(--space-5)',
                        fontSize: 'var(--fs-base)',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                      }}
                    >
                      {f.a}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
    </>
  );
}

function PricingCard(t: Tier) {
  return (
    <article
      id={t.name.toLowerCase().replace(/\s+/g, '-')}
      style={{
        background: 'var(--surface)',
        border: `2px solid ${t.featured ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        position: 'relative',
        boxShadow: t.featured ? '0 0 0 4px rgba(13,148,136,0.10)' : 'none',
      }}
    >
      {t.badge && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: t.badgeColor ?? 'var(--accent)',
            color: '#fff',
            padding: '5px 14px',
            borderRadius: 'var(--radius-xl)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          {t.badge}
        </div>
      )}

      <header style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, marginBottom: 4 }}>{t.name}</h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{t.desc}</p>
      </header>

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>${t.price}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{t.cadence}</div>
        </div>
      </div>

      <CheckoutButton tier={t.tier} label={t.btnLabel} featured={t.featured} />

      <ul style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--fs-sm)' }}>
        {t.features.map((feat) => (
          <li key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0, marginTop: 4 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{feat}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
