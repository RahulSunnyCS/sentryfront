'use client';

import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

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

const PRICING_TIERS = [
  {
    name: 'Starter',
    desc: 'Perfect to try it out',
    price: '$9',
    scans: '5 scans',
    perScan: '$1.80 per scan · 3 active tests',
    badge: null,
    featured: false,
    btnLabel: 'Try it risk-free',
    features: ['5 comprehensive scans', 'Never expires', 'All features included'],
    tier: 'one-shot' as const,
  },
  {
    name: 'Growth',
    desc: 'Best for most projects',
    price: '$29',
    scans: '25 scans',
    perScan: '$1.16 per scan · 8 active tests',
    badge: 'Most Popular',
    badgeColor: 'var(--accent)',
    featured: true,
    btnLabel: 'Buy Credits — Save $16',
    features: ['25 comprehensive scans', 'Never expires', 'All features included'],
    saveBadge: 'SAVE 36%',
    tier: 'pro' as const,
  },
  {
    name: 'Pro',
    desc: 'For power users',
    price: '$59',
    scans: '75 scans',
    perScan: '$0.79 per scan · 25 active tests',
    badge: null,
    featured: false,
    btnLabel: 'Buy Credits',
    features: ['75 comprehensive scans', 'Never expires', 'All features included'],
    saveBadge: 'SAVE 56%',
    tier: 'studio' as const,
  },
  {
    name: 'Business',
    desc: 'For agencies & teams',
    price: '$99',
    scans: '200 scans',
    perScan: '$0.50 per scan · 66 active tests',
    badge: 'Best Value',
    badgeColor: 'linear-gradient(135deg, #F59E0B, #D97706)',
    featured: false,
    btnLabel: 'Buy Credits',
    features: ['200 comprehensive scans', 'Never expires', 'Priority support'],
    saveBadge: 'SAVE 72%',
    tier: 'studio' as const,
  },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Pricing
            </div>
            <h1 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, marginBottom: 16 }}>
              Pay only for what you scan
            </h1>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto' }}>
              Buy credits, use them anytime. Need 24/7 monitoring? Add it for $15/month per domain.
            </p>
          </div>

          {/* Free Tier */}
          <div style={{ maxWidth: 800, margin: '0 auto 48px', background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              🎉 Forever Free
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Start with 3 free scans every month</h3>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24 }}>Perfect for side projects and testing. No credit card required.</p>
            <a href="/" style={{
              display: 'inline-block', padding: '12px 28px', background: 'var(--accent)', border: 'none',
              borderRadius: 10, fontSize: 15, fontWeight: 700, color: 'white', textDecoration: 'none',
              transition: 'all 0.2s',
            }}>
              Get Started Free
            </a>
          </div>

          {/* Value Proposition */}
          <div style={{ maxWidth: 800, margin: '0 auto 48px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(13,148,136,0.05), rgba(20,184,166,0.02))', border: '1px solid var(--accent)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 12 }}>Each scan replaces:</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
              <div>🔒 Security audit <strong style={{ color: 'var(--text)' }}>($2,000)</strong></div>
              <div>⚖️ Compliance review <strong style={{ color: 'var(--text)' }}>($500)</strong></div>
              <div>⚡ Performance audit <strong style={{ color: 'var(--text)' }}>($200)</strong></div>
              <div>🤖 AI fix prompts <strong style={{ color: 'var(--text)' }}>($500)</strong></div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 12 }}>
              Total value: <span style={{ fontWeight: 700, color: 'var(--accent)' }}>$3,200+ per scan</span> &bull; You save 99%+
            </div>
          </div>

          {/* What's Included */}
          <div style={{ background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 16, padding: 48, marginBottom: 64 }}>
            <h3 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 16 }}>
              Every scan includes all features
            </h3>
            <p style={{ textAlign: 'center', fontSize: 15, color: 'var(--text-secondary)', marginBottom: 40, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
              Whether you&apos;re on the Free tier or bought 200 credits, every scan checks the same depth. No feature gating.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, marginBottom: 32 }}>
              {WHAT_IS_INCLUDED.map((section) => (
                <div key={section.title}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{section.emoji}</span>
                    {section.title}
                  </h4>
                  <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 2, listStyle: 'none', padding: 0 }}>
                    {section.items.map((item) => (
                      <li key={item} style={{ position: 'relative', paddingLeft: 20 }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', paddingTop: 32, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <strong style={{ color: 'var(--text)' }}>All tiers get the same depth.</strong> Free tier = 3 scans/month. Paid = more scans.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                Plus: Accessibility (♿), SEO (🔍), Code Scanning (💻), Multi-language reports (🌍)
              </p>
            </div>
          </div>

          {/* Audit Anchor */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 28px', marginBottom: 24 }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Traditional security audit</div>
                <div style={{ fontSize: 28, fontWeight: 800, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>$3,200</div>
              </div>
              <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>VibeSafe</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>From $9</div>
              </div>
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Buy Credits &bull; Use Anytime</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>1 credit = 1 passive scan &middot; 3 credits = 1 active security test (DAST)</p>
            <p style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>Credits never expire &bull; Use across unlimited domains &bull; 30-day refund guarantee</p>
          </div>

          {/* Pricing Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto 80px' }}>
            {PRICING_TIERS.map((t) => (
              <PricingCard key={t.name} {...t} />
            ))}
          </div>

          {/* Monitoring Add-On */}
          <div style={{
            maxWidth: 900, margin: '0 auto 80px',
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-secondary) 100%)',
            border: '2px solid var(--accent)', borderRadius: 16, padding: 48, position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -14, left: 48, background: 'var(--accent)', color: 'white', padding: '6px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Add-On
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Need 24/7 Monitoring?</h3>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24 }}>
                  Get daily automatic scans, instant alerts, and compliance reports for any domain.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                  {[
                    ['Daily auto-scans', "(doesn't use credits)"],
                    ['Email + Slack alerts', null],
                    ['Compliance PDF reports', 'Monthly'],
                    ['Regression detection', 'New issues flagged instantly'],
                  ].map(([label, sub]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'start', gap: 10, fontSize: 14 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{label}{sub && <><br /><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</span></>}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 180 }}>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>Per domain</div>
                <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>$15</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>/month</div>
                <a href="/" style={{
                  display: 'block', padding: '12px 24px', background: 'var(--accent)',
                  color: 'white', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  textDecoration: 'none', textAlign: 'center',
                }}>
                  Add Monitoring
                </a>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: 'center', marginBottom: 48 }}>Common questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                { q: 'Do credits expire?', a: 'No. Credits never expire and can be used across any number of domains.' },
                { q: 'What counts as one scan?', a: 'One passive scan of a single URL. It runs all security, performance, accessibility and SEO checks simultaneously.' },
                { q: 'What is an active test?', a: '3 credits buys one active DAST scan that sends real attack probes (SQL injection, XSS, API fuzzing) against your verified domain.' },
                { q: 'Is there a free trial?', a: 'Yes — every account gets 3 free scans per month, forever. No credit card needed to start.' },
                { q: 'Can I get a refund?', a: 'Yes. If you are not satisfied, we offer a 30-day money-back guarantee on any credit pack.' },
              ].map(({ q, a }) => (
                <div key={q} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{q}</h4>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
        <Footer />
      </div>
    </div>
  );
}

interface PricingCardProps {
  name: string;
  desc: string;
  price: string;
  scans: string;
  perScan: string;
  badge: string | null;
  badgeColor?: string;
  featured: boolean;
  btnLabel: string;
  features: string[];
  saveBadge?: string;
  tier: 'one-shot' | 'pro' | 'studio';
}

function PricingCard({ name, desc, price, scans, perScan, badge, badgeColor, featured, btnLabel, features, saveBadge, tier }: PricingCardProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `2px solid ${featured ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 14, padding: 28, position: 'relative',
      boxShadow: featured ? '0 0 0 4px rgba(13,148,136,0.1)' : 'none',
      transition: 'all 0.2s',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: badgeColor ?? 'var(--accent)', color: 'white',
          padding: '5px 14px', borderRadius: 18, fontSize: 10,
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
        }}>
          {badge}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{name}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}>
          <div style={{ fontSize: 38, fontWeight: 800 }}>{price}</div>
          {saveBadge && (
            <div style={{ background: '#DCFCE7', color: '#166534', padding: '3px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
              {saveBadge}
            </div>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>{scans}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{perScan}</div>
      </div>

      <CheckoutButton tier={tier} label={btnLabel} featured={featured} />

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          {features.map((feat) => (
            <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckoutButton({ tier, label, featured }: { tier: 'one-shot' | 'pro' | 'studio'; label: string; featured: boolean }) {
  return (
    <button
      style={{
        width: '100%', padding: 11,
        background: featured ? 'var(--accent)' : 'var(--surface-secondary)',
        border: featured ? 'none' : '1px solid var(--border)',
        borderRadius: 9, fontSize: 14, fontWeight: 700,
        color: featured ? 'white' : 'var(--text)',
        cursor: 'pointer', marginBottom: 20, transition: 'all 0.2s',
      }}
      onClick={async () => {
        try {
          const res = await fetch('/api/v1/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier }),
          });
          const data = await res.json();
          if (data.url) window.location.href = data.url;
        } catch {
          // silently fail
        }
      }}
    >
      {label}
    </button>
  );
}
