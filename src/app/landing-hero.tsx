'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconShield, IconGlobe, IconArrowRight } from '@/components/icons';
import { createScan } from '@/lib/api';

/* ─────────────────────────────────────────────────────────────
   Data
   ───────────────────────────────────────────────────────────── */

const TRUST_ITEMS = [
  'No login required',
  'Stripe-secured',
  '30-day refund guarantee',
  'No security expertise needed',
];

const HERO_FINDINGS = [
  { status: 'Protected', title: 'Stripe account secured', sub: 'Secret key removed from JS bundle' },
  { status: 'Protected', title: 'Security headers hardened', sub: 'Enterprise-grade protection enabled' },
  { status: 'Confirmed', title: 'GDPR compliance verified', sub: "Your users' data is protected" },
];

const CATEGORIES: Array<{ label: string; color?: string; bg?: string }> = [
  { label: '🛡️ Security' },
  { label: '⚖️ Compliance' },
  { label: '⚡ Performance' },
  { label: '♿ Accessibility' },
  { label: '🔍 SEO' },
  { label: '🔴 Active Testing', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  { label: '📋 Code Scanning', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
];

const STEPS = [
  {
    n: '01',
    title: 'Paste your URL',
    desc: 'Drop in any public URL — staging, production, or that thing you shipped last night. No CLI, no DNS setup, no agent install.',
  },
  {
    n: '02',
    title: 'We scan 31 checks in parallel',
    desc: 'Security headers, secrets in JS bundles, TLS configuration, GDPR & WCAG compliance, Core Web Vitals, SEO meta — all under 90 seconds.',
  },
  {
    n: '03',
    title: 'Get fixes you can paste',
    desc: 'Every finding ships with a copy-ready prompt for Cursor, v0, Bolt, Lovable, or Replit. Apply the fix, re-scan, ship.',
  },
];

const STATS = [
  { value: '4,247', label: 'sites scanned this week', tone: 'accent' as const },
  { value: '700+',  label: 'secret patterns detected' },
  { value: '90s',   label: 'average scan time' },
  { value: '$3,200', label: 'audit cost replaced per scan' },
];

const FEATURE_CARDS = [
  {
    emoji: '🛡️',
    title: 'Security Scanning',
    desc: '15 security modules detect exposed secrets (700+ patterns), missing headers, XSS, CORS issues, and vulnerable dependencies.',
    tags: '✓ Gitleaks  ✓ Subdomain takeover  ✓ SSL/TLS',
  },
  {
    emoji: '💻',
    title: 'Code Scanning (CI/CD)',
    desc: 'Catch secrets before deployment with GitHub Actions, GitLab CI, or Bitbucket Pipelines integration.',
    tags: '✓ GitHub  ✓ GitLab  ✓ Bitbucket  ✓ PR comments',
  },
  {
    emoji: '⚖️',
    title: 'Compliance Checks',
    desc: 'GDPR, WCAG 2.2 Level AA, cookie consent, privacy policy detection — stay legally compliant.',
    tags: '✓ GDPR  ✓ WCAG 2.2 AA  ✓ Cookie consent',
  },
  {
    emoji: '⚡',
    title: 'Performance Audits',
    desc: 'Core Web Vitals, Lighthouse scores, image optimization, render-blocking resources, and more.',
    tags: '✓ LCP, FCP, CLS  ✓ Lighthouse  ✓ Mobile perf',
  },
  {
    emoji: '♿',
    title: 'Accessibility',
    desc: 'WCAG 2.2 checks, color contrast, keyboard navigation, screen-reader compatibility.',
    tags: '✓ Color contrast  ✓ Keyboard nav  ✓ ARIA',
  },
  {
    emoji: '🤖',
    title: 'AI Fix Prompts',
    desc: 'Every finding includes a ready-to-paste fix prompt for Cursor, v0, Bolt, Lovable, or Replit.',
    tags: '✓ Cursor  ✓ v0  ✓ Bolt  ✓ Lovable',
  },
];

const COMPARISON: Array<{ feature: string; vibesafe: string; manual: string; competitor: string }> = [
  { feature: 'Time to first report',    vibesafe: '90 seconds',     manual: '2–4 weeks',       competitor: '4–24 hours' },
  { feature: 'Starting price',          vibesafe: '$9',             manual: '$3,200+',         competitor: '$99/mo'    },
  { feature: 'AI fix prompts',          vibesafe: 'Every finding',  manual: 'None',            competitor: 'None'      },
  { feature: 'Active DAST probes',      vibesafe: '$3.48',          manual: '$5,000',          competitor: '$499'      },
  { feature: 'Setup required',          vibesafe: 'Paste a URL',    manual: 'Procurement',     competitor: 'Agent install' },
  { feature: 'Cursor / Lovable native', vibesafe: 'Yes',            manual: 'No',              competitor: 'No'        },
];

const TESTIMONIALS = [
  {
    quote: 'Caught a Stripe live key in my Lovable export before launch. Worth ten years of subscription fees.',
    name: 'Maya Chen',
    role: 'Indie founder · taskflow.app',
  },
  {
    quote: 'We replaced a quarterly $4,000 pentest with VibeSafe on every deploy. Findings come with fixes — we just paste them into Cursor.',
    name: 'Daniel R.',
    role: 'CTO · 12-person SaaS',
  },
  {
    quote: 'The AI prompts genuinely fix the issues. I went from F to A in one afternoon without reading a single OWASP doc.',
    name: 'Jasmine O.',
    role: 'Solo dev · shipped on Bolt',
  },
];

const FAQS = [
  {
    q: 'Do I need to install anything?',
    a: 'No. VibeSafe is a passive black-box scanner — paste a URL and we hit it from the outside, just like a real attacker would. No CLI, no agent, no SDK, no code changes.',
  },
  {
    q: 'Will scanning my site break anything?',
    a: 'Passive scans are read-only — they only fetch public URLs your browser already fetches. Active DAST tests are opt-in, rate-limited to 1 request per second, identify themselves with an X-Scanner header, and require you to verify ownership of the domain first.',
  },
  {
    q: 'Is this useful for AI-built sites specifically?',
    a: 'Yes — AI coding tools love to inline secrets, ship sourcemaps, and skip security headers. Our scanner is tuned for the patterns we see in Lovable, Bolt, v0, Cursor, and Replit exports. Every finding includes an AI fix prompt you can paste straight back into the same tool.',
  },
  {
    q: 'What does each scan check?',
    a: '15 security modules (secrets, headers, TLS, cookies, CORS, sourcemaps, mixed content, subdomain takeover, third-party scripts, DNS/email, exposed dev interfaces, error disclosure, robots/sitemap, caching, sensitive paths), 6 performance modules (Core Web Vitals, resources, network, JS, server response, mobile), 5 accessibility modules (contrast, keyboard, screen-reader, semantic HTML, forms), and 5 SEO modules (meta tags, social, structured data, crawlability, mobile SEO).',
  },
  {
    q: 'How is this different from Lighthouse or Snyk?',
    a: 'Lighthouse only measures performance and surface-level SEO. Snyk needs your source code and focuses on dependencies. VibeSafe runs against your live URL, covers security + compliance + performance + a11y + SEO in one report, and writes the fix for you. Think of it as Lighthouse + OWASP ZAP + Gitleaks + a developer-grade AI assistant, in a 90-second pass.',
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Credits roll over indefinitely and work across any number of domains. If you decide it isn\'t for you within 30 days, we\'ll refund any unused credits.',
  },
];

const TOOLS = ['Lovable', 'Bolt', 'v0', 'Cursor', 'Replit'];

/* ─────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────── */

export function LandingHero() {
  return (
    <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
      <HeroSection />
      <ToolsStrip />
      <HowItWorksSection />
      <StatsSection />
      <FeaturesSection />
      <ComparisonSection />
      <TestimonialsSection />
      <ChromeExtensionSection />
      <FAQSection />
      <FinalCTASection />

      {/* FAQPage JSON-LD for rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero
   ───────────────────────────────────────────────────────────── */

function HeroSection() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    const target = url.trim() || 'taskflow.app';
    setError(null);
    setLoading(true);
    try {
      const { id } = await createScan(target);
      router.push(`/scan/${id}?url=${encodeURIComponent(target)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start scan. Please try again.');
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        paddingTop: 'clamp(64px, 10vw, 96px)',
        paddingBottom: 'clamp(40px, 6vw, 56px)',
        textAlign: 'center',
      }}
    >
      <div
        className="container-narrow"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <span className="pill pill-accent" style={{ marginBottom: 'var(--space-8)' }}>
          <IconShield size={16} color="var(--accent)" />
          Enterprise-grade security · Starting at $9
        </span>

        <h1 id="hero-heading" className="text-hero" style={{ marginBottom: 'var(--space-4)' }}>
          Your AI-built site is now
          <br />
          technically solid
        </h1>

        <p
          className="text-lead"
          style={{ maxWidth: 560, marginInline: 'auto', marginBottom: 'var(--space-10)' }}
        >
          Paste a URL. Know in 90 seconds if your site is enterprise-ready. Every finding comes with
          the exact AI prompt to fix it in Cursor, v0, or Lovable.
        </p>

        <form
          className="url-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleScan();
          }}
          role="search"
          aria-label="Scan a website"
        >
          <IconGlobe size={20} />
          <label htmlFor="hero-url" className="sr-only">
            Website URL
          </label>
          <input
            id="hero-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="taskflow.app"
            disabled={loading}
          />
          <button type="submit" disabled={loading} aria-label="Start free scan">
            {loading ? 'Starting…' : 'Scan Free'}
            {!loading && <IconArrowRight size={16} color="#fff" />}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            style={{ marginTop: 'var(--space-3)', fontSize: 'var(--fs-sm)', color: '#E11D48', maxWidth: 560 }}
          >
            {error}
          </p>
        )}

        {/* Live counter */}
        <p
          aria-live="polite"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 'var(--space-4)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            aria-hidden="true"
            className="pulse-dot"
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }}
          />
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>4,247</strong>{' '}
            sites scanned this week ·{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>2,847</strong>{' '}
            developers upgraded
          </span>
        </p>

        {/* Trust row */}
        <ul
          aria-label="Trust signals"
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3) var(--space-5)',
            listStyle: 'none',
            margin: 'var(--space-10) 0 0',
            padding: 0,
          }}
        >
          {TRUST_ITEMS.map((item) => (
            <li
              key={item}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--fs-sm)',
                color: 'var(--text-tertiary)',
                fontWeight: 500,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Hero finding cards */}
      <div
        className="container-narrow"
        style={{ marginTop: 'var(--space-10)' }}
      >
        <ul
          aria-label="Example findings"
          className="grid-3"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {HERO_FINDINGS.map((f) => (
            <li
              key={f.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--success)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {f.status}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4 }}>
                {f.sub}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Category pills */}
      <div className="container-narrow" style={{ marginTop: 'var(--space-10)' }}>
        <ul
          aria-label="What VibeSafe checks"
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {CATEGORIES.map((cat) => (
            <li key={cat.label}>
              <span
                className="pill"
                style={{
                  background: cat.bg ?? 'var(--surface)',
                  borderColor: cat.color ?? 'var(--border)',
                  color: cat.color ?? 'var(--text-secondary)',
                }}
              >
                {cat.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Tools strip — social proof
   ───────────────────────────────────────────────────────────── */

function ToolsStrip() {
  return (
    <section
      aria-label="Supported AI coding tools"
      style={{
        padding: 'var(--space-8) var(--space-6)',
        borderTop: '1px solid var(--border-light)',
        borderBottom: '1px solid var(--border-light)',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--space-4)',
          fontWeight: 500,
        }}
      >
        Built for sites made with
      </p>
      <ul
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'clamp(16px, 5vw, 40px)',
          flexWrap: 'wrap',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {TOOLS.map((t) => (
          <li
            key={t}
            style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.65 }}
          >
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   How it works
   ───────────────────────────────────────────────────────────── */

function HowItWorksSection() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="How it works"
          id="how-heading"
          title="Three steps. Ninety seconds."
          lead="Zero setup. Zero security expertise. Real, prioritised findings — with fixes you can copy-paste."
        />

        <ol
          className="grid-feature"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
        >
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="card"
              style={{ padding: 'var(--space-8)' }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--accent)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                STEP {s.n}
              </div>
              <h3
                style={{
                  fontSize: 'var(--fs-xl)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-2)',
                  letterSpacing: '-0.01em',
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Stats
   ───────────────────────────────────────────────────────────── */

function StatsSection() {
  return (
    <section aria-labelledby="stats-heading" className="section-sm" style={{ borderTop: '1px solid var(--border-light)' }}>
      <div className="container">
        <h2 id="stats-heading" className="sr-only">
          Key statistics
        </h2>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-6)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd
                style={{
                  fontSize: 'clamp(28px, 5vw, 44px)',
                  fontWeight: 800,
                  color: s.tone === 'accent' ? 'var(--accent)' : 'var(--text)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  marginBottom: 'var(--space-2)',
                }}
              >
                {s.value}
              </dd>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Features
   ───────────────────────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-heading" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Everything in one scan"
          id="features-heading"
          title="Everything you need to ship with confidence"
          lead="From security to SEO, we check it all — so you don't have to."
        />

        <FeatureBanner
          color="#DC2626"
          gradientFrom="rgba(220,38,38,0.10)"
          gradientTo="rgba(124,58,237,0.08)"
          emoji="🔴"
          badge="New"
          eyebrow="Active Security Testing"
          title="We try to break your site — so attackers can't"
          body={
            <>
              Beyond passive checks: VibeSafe actually sends attack probes — SQL injection, XSS payloads,
              API fuzzing — against your verified domain. You get{' '}
              <strong style={{ color: 'var(--text)' }}>CONFIRMED exploitable</strong> findings, not guesses.
            </>
          }
          bullets={['SQL injection probing', 'XSS payload testing', 'API endpoint fuzzing', 'Auth bypass attempts']}
          aside={
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5) var(--space-6)',
                minWidth: 200,
              }}
            >
              <div className="eyebrow" style={{ color: 'var(--text-tertiary)' }}>Replaces</div>
              <div style={{ fontSize: 24, fontWeight: 800, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>$5,000</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>manual pentest engagement</div>
              <div className="eyebrow" style={{ color: 'var(--text-tertiary)' }}>VibeSafe</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626' }}>3 credits</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>per active scan (~$3.48)</div>
            </div>
          }
        />

        <FeatureBanner
          color="#7C3AED"
          gradientFrom="rgba(124,58,237,0.10)"
          gradientTo="rgba(13,148,136,0.08)"
          emoji="📋"
          eyebrow="GitHub Code Scanning"
          title="Catch secrets before they ship — in your repo"
          body="Connect your GitHub repo and VibeSafe scans every PR for hardcoded API keys, secrets, and security anti-patterns — before they ever reach production."
          bullets={['Gitleaks integration', 'PR comments', 'Block merge on critical', '1 credit per scan']}
          aside={
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5) var(--space-6)',
                minWidth: 200,
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.8,
              }}
            >
              <div style={{ color: '#7C3AED', fontWeight: 700, marginBottom: 6 }}>⚠ PR #47 blocked</div>
              <div style={{ color: '#DC2626' }}>✗ OPENAI_API_KEY exposed</div>
              <div style={{ color: '#DC2626' }}>✗ DB password in config.js</div>
              <div style={{ color: 'var(--success)', marginTop: 4 }}>✓ Fix + merge to proceed</div>
            </div>
          }
        />

        {/* Feature grid */}
        <div className="grid-feature" style={{ marginTop: 'var(--space-10)' }}>
          {FEATURE_CARDS.map((card) => (
            <article key={card.title} className="card card-interactive">
              <div aria-hidden="true" style={{ fontSize: 32, marginBottom: 'var(--space-4)' }}>
                {card.emoji}
              </div>
              <h3
                style={{
                  fontSize: 'var(--fs-xl)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-3)',
                  letterSpacing: '-0.01em',
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontSize: 'var(--fs-base)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 'var(--space-4)',
                }}
              >
                {card.desc}
              </p>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
                {card.tags}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Comparison
   ───────────────────────────────────────────────────────────── */

function ComparisonSection() {
  return (
    <section
      id="why-vibesafe"
      aria-labelledby="compare-heading"
      className="section"
      style={{ background: 'var(--surface-secondary)' }}
    >
      <div className="container">
        <SectionHeader
          eyebrow="The trade-off"
          id="compare-heading"
          title="VibeSafe vs. the old way"
          lead="A manual security audit takes weeks and costs thousands. Traditional SaaS scanners need DNS, agents, and security expertise. VibeSafe takes 90 seconds."
        />

        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 640,
              fontSize: 'var(--fs-base)',
            }}
          >
            <caption className="sr-only">Comparison of VibeSafe vs manual audits and traditional scanners</caption>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th scope="col" style={cellHeadCss}>&nbsp;</th>
                <th scope="col" style={{ ...cellHeadCss, color: 'var(--accent)' }}>VibeSafe</th>
                <th scope="col" style={cellHeadCss}>Manual audit</th>
                <th scope="col" style={cellHeadCss}>Traditional SaaS</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr
                  key={row.feature}
                  style={{ borderTop: '1px solid var(--border-light)', background: i % 2 ? 'transparent' : 'var(--surface-secondary)' }}
                >
                  <th scope="row" style={{ ...cellCss, fontWeight: 600, color: 'var(--text)' }}>
                    {row.feature}
                  </th>
                  <td style={{ ...cellCss, color: 'var(--accent)', fontWeight: 600 }}>{row.vibesafe}</td>
                  <td style={cellCss}>{row.manual}</td>
                  <td style={cellCss}>{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const cellHeadCss: React.CSSProperties = {
  padding: '14px 18px',
  fontSize: 'var(--fs-sm)',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const cellCss: React.CSSProperties = {
  padding: '14px 18px',
  color: 'var(--text-secondary)',
  textAlign: 'left',
};

/* ─────────────────────────────────────────────────────────────
   Testimonials
   ───────────────────────────────────────────────────────────── */

function TestimonialsSection() {
  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Builders ship safer"
          id="testimonials-heading"
          title="Loved by indie founders and small teams"
          lead="A few words from people who paste URLs and ship fixes."
        />

        <div className="grid-feature">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div aria-hidden="true" style={{ fontSize: 24, color: 'var(--accent)', lineHeight: 1 }}>
                &ldquo;
              </div>
              <blockquote style={{ fontSize: 'var(--fs-lg)', color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
                {t.quote}
              </blockquote>
              <figcaption style={{ marginTop: 'auto' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-base)' }}>{t.name}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FAQ
   ───────────────────────────────────────────────────────────── */

function FAQSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="section"
      style={{ background: 'var(--surface-secondary)' }}
    >
      <div className="container-prose">
        <SectionHeader
          eyebrow="FAQ"
          id="faq-heading"
          title="Common questions"
          lead="If you don't see your question here, email support@vibesafe.app — a real human answers."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="card"
              style={{ padding: 0, overflow: 'hidden' }}
            >
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
                <span aria-hidden="true" style={{ color: 'var(--text-tertiary)', fontSize: 20, flexShrink: 0 }}>
                  +
                </span>
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
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Final CTA
   ───────────────────────────────────────────────────────────── */

function FinalCTASection() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="section"
      style={{ textAlign: 'center' }}
    >
      <div className="container-prose">
        <h2 id="cta-heading" className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
          Ready to ship with confidence?
        </h2>
        <p className="text-lead" style={{ marginBottom: 'var(--space-8)' }}>
          Free tier includes 3 full scans every month. No credit card required.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/#hero-heading" className="btn-primary" aria-label="Run a free scan now">
            Scan your site free
            <IconArrowRight size={16} color="#fff" />
          </Link>
          <Link href="/pricing" className="btn-secondary">
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared primitives
   ───────────────────────────────────────────────────────────── */

function ChromeExtensionSection() {
  return (
    <section className="section" aria-labelledby="extension-title" style={{ background: 'var(--surface)' }}>
      <div className="container">
        <article
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(66,133,244,0.08), rgba(13,148,136,0.06))',
            padding: 'clamp(28px, 5vw, 56px)',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 1fr)',
            gap: 'var(--space-10)',
            alignItems: 'center',
          }}
          className="extension-banner"
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
              <span aria-hidden="true">🧩</span> Coming soon · Chrome Extension
            </div>
            <h2 id="extension-title" className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
              Scan any site in one click — without leaving your browser
            </h2>
            <p className="text-lead" style={{ marginBottom: 'var(--space-6)' }}>
              Pin the VibeSafe extension and audit any page you visit. Instant grade overlay,
              one-click deep scan, copy-paste fix prompts for your AI assistant.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-6)', display: 'grid', gap: 'var(--space-2)' }}>
              {[
                'Live grade badge on every site you visit',
                'Right-click → "Scan this page with VibeSafe"',
                'Detects secrets in network requests in real time',
                'Works offline for client-side checks',
              ].map((b) => (
                <li key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
                  <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', maxWidth: 480 }}
              aria-label="Join the Chrome extension waitlist"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                aria-label="Email address"
                style={{
                  flex: 1, minWidth: 200,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 'var(--fs-base)',
                }}
              />
              <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                Join waitlist
              </button>
            </form>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>
              No spam — one email when it ships. <strong style={{ color: 'var(--text-secondary)' }}>2,140 devs</strong> already on the list.
            </p>
          </div>

          {/* Mock browser preview */}
          <aside
            aria-hidden="true"
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              fontFamily: 'var(--mono)',
              fontSize: 12,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px',
              background: 'var(--surface-secondary)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FF5F57' }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FEBC2E' }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#28C840' }} />
              <span style={{
                flex: 1, marginLeft: 8,
                padding: '4px 10px', borderRadius: 999,
                background: 'var(--bg)', color: 'var(--text-tertiary)',
                fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: 'var(--success)' }}>🔒</span> example.com
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(220,38,38,0.15)', color: '#DC2626',
                fontWeight: 800, fontSize: 11,
              }}>
                🛡 D
              </span>
            </div>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-secondary)', width: '80%' }} />
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-secondary)', width: '60%' }} />
              <div style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                border: '1px solid rgba(220,38,38,0.30)',
                background: 'rgba(220,38,38,0.06)',
                display: 'grid', gap: 6,
              }}>
                <div style={{ fontWeight: 700, color: '#DC2626', fontSize: 11 }}>
                  ⚠ 2 critical findings on this page
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>• Exposed API key in /static/main.js</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>• Missing CSP header</div>
                <div style={{
                  marginTop: 4, padding: '6px 10px',
                  borderRadius: 6, background: 'var(--accent)', color: '#fff',
                  fontWeight: 700, fontSize: 11, textAlign: 'center',
                }}>
                  Run full scan →
                </div>
              </div>
            </div>
          </aside>
        </article>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  id,
  title,
  lead,
}: {
  eyebrow: string;
  id: string;
  title: string;
  lead: string;
}) {
  return (
    <header style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto var(--space-12)' }}>
      <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
        {eyebrow}
      </div>
      <h2 id={id} className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
        {title}
      </h2>
      <p className="text-lead">{lead}</p>
    </header>
  );
}

function FeatureBanner({
  color,
  gradientFrom,
  gradientTo,
  emoji,
  badge,
  eyebrow,
  title,
  body,
  bullets,
  aside,
}: {
  color: string;
  gradientFrom: string;
  gradientTo: string;
  emoji: string;
  badge?: string;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  bullets: string[];
  aside: React.ReactNode;
}) {
  return (
    <article
      className="feature-banner"
      style={{
        background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        border: `1px solid ${color}55`,
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(20px, 4vw, 32px) clamp(20px, 4vw, 40px)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div className="feature-banner__body">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 28 }}>
            {emoji}
          </span>
          {badge && (
            <span
              style={{
                background: color,
                color: 'white',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {badge}
            </span>
          )}
          <span
            style={{
              fontSize: 'var(--fs-sm)',
              color,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {eyebrow}
          </span>
        </div>
        <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 540 }}>
          {body}
        </p>
        <ul
          style={{
            display: 'flex',
            gap: 'var(--space-5)',
            marginTop: 'var(--space-4)',
            flexWrap: 'wrap',
            listStyle: 'none',
            padding: 0,
          }}
        >
          {bullets.map((b) => (
            <li key={b} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              ✓ {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="feature-banner__aside">{aside}</div>
    </article>
  );
}
