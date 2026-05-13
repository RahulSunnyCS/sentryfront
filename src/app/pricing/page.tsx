import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { CheckoutButton } from '@/components/checkout-button';

export const metadata: Metadata = {
  title: 'Pricing — Pay only for what you scan',
  description:
    'Start free with 3 scans every month. Buy credits ($9 for 5 / $29 for 25 / $59 for 75 / $99 for 200) that never expire. Add 24/7 monitoring for $15/month per domain. 30-day refund guarantee.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'VibeSafe Pricing — From $9',
    description:
      'Buy credits. Use anytime. Each scan replaces $3,200+ of traditional audit work — for under $1.80.',
    url: '/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeSafe Pricing — From $9',
    description:
      'Buy credits. Use anytime. Each scan replaces $3,200+ of traditional audit work — for under $1.80.',
  },
};

const WHAT_IS_INCLUDED = [
  {
    emoji: '🛡️',
    title: 'Security (15 modules)',
    items: ['700+ secret patterns (Gitleaks)', 'Missing security headers', 'XSS & CORS vulnerabilities', 'Subdomain takeover detection'],
  },
  {
    emoji: '⚖️',
    title: 'Compliance',
    items: ['GDPR compliance checks', 'WCAG 2.2 Level AA', 'Cookie consent verification', 'Privacy policy detection'],
  },
  {
    emoji: '⚡',
    title: 'Performance',
    items: ['Core Web Vitals (LCP, FCP, CLS)', 'Lighthouse integration', 'Image optimization checks', 'Render-blocking resources'],
  },
  {
    emoji: '🤖',
    title: 'AI Features',
    items: ['AI-powered explanations', 'Fix prompts for Cursor/v0/Bolt', 'Plain English impact analysis', 'Context-aware remediation'],
  },
];

interface Tier {
  name: string;
  desc: string;
  price: number;
  scans: number;
  perScan: string;
  badge?: string;
  badgeColor?: string;
  featured: boolean;
  btnLabel: string;
  features: string[];
  saveBadge?: string;
  tier: 'one-shot' | 'pro' | 'studio';
}

const PRICING_TIERS: Tier[] = [
  { name: 'Starter',  desc: 'Perfect to try it out',   price: 9,  scans: 5,   perScan: '$1.80 per scan · 3 active tests',  featured: false, btnLabel: 'Try it risk-free',     features: ['5 comprehensive scans',  'Never expires', 'All features included'], tier: 'one-shot' },
  { name: 'Growth',   desc: 'Best for most projects',  price: 29, scans: 25,  perScan: '$1.16 per scan · 8 active tests',  featured: true,  btnLabel: 'Buy Credits — Save $16', features: ['25 comprehensive scans', 'Never expires', 'All features included'], tier: 'pro',        badge: 'Most Popular', badgeColor: 'var(--accent)', saveBadge: 'SAVE 36%' },
  { name: 'Pro',      desc: 'For power users',         price: 59, scans: 75,  perScan: '$0.79 per scan · 25 active tests', featured: false, btnLabel: 'Buy Credits',           features: ['75 comprehensive scans', 'Never expires', 'All features included'], tier: 'studio',     saveBadge: 'SAVE 56%' },
  { name: 'Business', desc: 'For agencies & teams',    price: 99, scans: 200, perScan: '$0.50 per scan · 66 active tests', featured: false, btnLabel: 'Buy Credits',           features: ['200 comprehensive scans', 'Never expires', 'Priority support'],   tier: 'studio',     badge: 'Best Value', badgeColor: 'linear-gradient(135deg, #F59E0B, #D97706)', saveBadge: 'SAVE 72%' },
];

const FAQS = [
  { q: 'Do credits expire?',  a: 'No. Credits never expire and can be used across any number of domains.' },
  { q: 'What counts as one scan?', a: 'One passive scan of a single URL. It runs all security, performance, accessibility and SEO checks simultaneously.' },
  { q: 'What is an active test?', a: '3 credits buys one active DAST scan that sends real attack probes (SQL injection, XSS, API fuzzing) against your verified domain.' },
  { q: 'Is there a free trial?', a: 'Yes — every account gets 3 free scans per month, forever. No credit card needed to start.' },
  { q: 'Can I get a refund?', a: 'Yes. If you are not satisfied, we offer a 30-day money-back guarantee on any credit pack.' },
  { q: 'Do you offer team / volume discounts?', a: 'The Business pack already includes 72% off list price. For 500+ scans/month or single-tenant deployments, email sales@vibesafe.app.' },
];

const PRICING_LD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'VibeSafe Scan Credits',
  description: 'Credit packs for VibeSafe security, performance, accessibility, and SEO scans.',
  brand: { '@type': 'Brand', name: 'VibeSafe' },
  offers: PRICING_TIERS.map((t) => ({
    '@type': 'Offer',
    name: `${t.name} — ${t.scans} scans`,
    price: t.price.toFixed(2),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `https://vibesafe.app/pricing#${t.name.toLowerCase()}`,
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
                Pay only for what you scan
              </h1>
              <p className="text-lead" style={{ maxWidth: 600, margin: '0 auto' }}>
                Buy credits, use them anytime. Need 24/7 monitoring? Add it for $15/month per domain.
              </p>
            </header>

            {/* Free Tier */}
            <section
              aria-label="Free tier"
              style={{
                maxWidth: 800,
                margin: '0 auto var(--space-12)',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
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
                <span aria-hidden="true">🎉</span> Forever Free
              </div>
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
                Start with 3 free scans every month
              </h2>
              <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                Perfect for side projects and testing. No credit card required.
              </p>
              <a href="/" className="btn-primary">Get started free</a>
            </section>

            {/* Value prop */}
            <section
              aria-label="Each scan replaces"
              style={{
                maxWidth: 800,
                margin: '0 auto var(--space-12)',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(13,148,136,0.07), rgba(20,184,166,0.02))',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
              }}
            >
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Each scan replaces:
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
                <li>🔒 Security audit <strong style={{ color: 'var(--text)' }}>($2,000)</strong></li>
                <li>⚖️ Compliance review <strong style={{ color: 'var(--text)' }}>($500)</strong></li>
                <li>⚡ Performance audit <strong style={{ color: 'var(--text)' }}>($200)</strong></li>
                <li>🤖 AI fix prompts <strong style={{ color: 'var(--text)' }}>($500)</strong></li>
              </ul>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>
                Total value: <strong style={{ color: 'var(--accent)' }}>$3,200+ per scan</strong> · You save 99%+
              </p>
            </section>

            {/* What's included */}
            <section
              aria-labelledby="included-heading"
              style={{
                background: 'var(--surface)',
                border: '2px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'clamp(24px, 4vw, 48px)',
                marginBottom: 'var(--space-16)',
              }}
            >
              <h2 id="included-heading" className="text-h3" style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                Every scan includes all features
              </h2>
              <p style={{ textAlign: 'center', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-10)', maxWidth: 700, marginInline: 'auto' }}>
                Whether you&apos;re on the Free tier or bought 200 credits, every scan checks the same depth. No feature gating.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 'var(--space-8)',
                  marginBottom: 'var(--space-8)',
                }}
              >
                {WHAT_IS_INCLUDED.map((section) => (
                  <div key={section.title}>
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden="true" style={{ fontSize: 20 }}>{section.emoji}</span>
                      {section.title}
                    </h3>
                    <ul style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 2, listStyle: 'none', padding: 0 }}>
                      {section.items.map((item) => (
                        <li key={item} style={{ position: 'relative', paddingLeft: 20 }}>
                          <span aria-hidden="true" style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', paddingTop: 'var(--space-8)', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <strong style={{ color: 'var(--text)' }}>All tiers get the same depth.</strong> Free = 3 scans/month. Paid = more scans.
                </p>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
                  Plus: Accessibility (♿), SEO (🔍), Code Scanning (💻), Multi-language reports (🌍)
                </p>
              </div>
            </section>

            {/* Audit anchor */}
            <section aria-label="Comparison anchor" style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 24px',
                  marginBottom: 'var(--space-6)',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div className="eyebrow" style={{ color: 'var(--text-tertiary)' }}>Traditional security audit</div>
                  <div style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 800, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                    $3,200
                  </div>
                </div>
                <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
                <div style={{ textAlign: 'left' }}>
                  <div className="eyebrow">VibeSafe</div>
                  <div style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 800, color: 'var(--accent)' }}>
                    From $9
                  </div>
                </div>
              </div>
              <h2 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>Buy Credits · Use Anytime</h2>
              <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                1 credit = 1 passive scan · 3 credits = 1 active security test (DAST)
              </p>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', fontWeight: 600 }}>
                Credits never expire · Use across unlimited domains · 30-day refund guarantee
              </p>
            </section>

            {/* Pricing cards */}
            <section
              aria-label="Pricing tiers"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 'var(--space-5)',
                maxWidth: 1100,
                margin: '0 auto var(--space-20)',
              }}
            >
              {PRICING_TIERS.map((t) => (
                <PricingCard key={t.name} {...t} />
              ))}
            </section>

            {/* Monitoring add-on */}
            <section
              aria-label="24/7 monitoring add-on"
              style={{
                maxWidth: 900,
                margin: '0 auto var(--space-20)',
                background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-secondary) 100%)',
                border: '2px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'clamp(24px, 4vw, 48px)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -14,
                  left: 'clamp(24px, 4vw, 48px)',
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Add-on
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 'var(--space-10)',
                  alignItems: 'center',
                }}
                className="feature-banner"
              >
                <div className="feature-banner__body">
                  <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
                    Need 24/7 monitoring?
                  </h2>
                  <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                    Get daily automatic scans, instant alerts, and compliance reports for any domain.
                  </p>
                  <ul
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--space-4)',
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    {[
                      ['Daily auto-scans', 'Does not use credits'],
                      ['Email + Slack alerts', null],
                      ['Compliance PDF reports', 'Monthly'],
                      ['Regression detection', 'New issues flagged instantly'],
                    ].map(([label, sub]) => (
                      <li key={label as string} style={{ display: 'flex', alignItems: 'start', gap: 10, fontSize: 'var(--fs-base)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>
                          {label}
                          {sub && <><br /><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{sub}</span></>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <aside
                  className="feature-banner__aside"
                  style={{ textAlign: 'center', minWidth: 180 }}
                >
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                    Per domain
                  </div>
                  <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                    $15
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
                    /month
                  </div>
                  <a href="/" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Add monitoring
                  </a>
                </aside>
              </div>
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
      id={t.name.toLowerCase()}
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
          {t.saveBadge && (
            <div style={{ background: '#DCFCE7', color: '#166534', padding: '3px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
              {t.saveBadge}
            </div>
          )}
        </div>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
          {t.scans} scans
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{t.perScan}</div>
      </div>

      <CheckoutButton tier={t.tier} label={t.btnLabel} featured={t.featured} />

      <ul style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--fs-sm)' }}>
        {t.features.map((feat) => (
          <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{feat}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
