'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { IconShield, IconGlobe, IconArrowRight } from '@/components/icons';
import { createScan } from '@/lib/api';
import { HeroHeadlineAnim } from './HeroHeadlineAnim';

function formatCount(n: number | null, locale: string): string {
  if (n === null) return '—';
  return n.toLocaleString(locale);
}

export function LandingHero() {
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);
  const t = useTranslations('landing');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/stats/scan-count')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { count?: number }) => {
        if (!cancelled && typeof data.count === 'number') {
          setWeeklyCount(data.count);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const faqKeys = [1, 2, 3, 4, 5, 6] as const;

  return (
    <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
      <HeroSection weeklyCount={weeklyCount} />
      <ToolsStrip />
      <HowItWorksSection />
      <StatsSection weeklyCount={weeklyCount} />
      <FeaturesSection />
      <ComparisonSection />
      <TestimonialsSection />
      <ChromeExtensionSection />
      <FAQSection />
      <FinalCTASection />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqKeys.map((i) => ({
              '@type': 'Question',
              name: t(`faq.q${i}`),
              acceptedAnswer: { '@type': 'Answer', text: t(`faq.a${i}`) },
            })),
          }),
        }}
      />
    </main>
  );
}

function HeroSection({ weeklyCount }: { weeklyCount: number | null }) {
  const t = useTranslations('landing');
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    const target = url.trim() || 'example.com';
    setError(null);
    setLoading(true);
    try {
      const { id } = await createScan(target);
      router.push(`/scan/${id}?url=${encodeURIComponent(target)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('scanFailed'));
      setLoading(false);
    }
  };

  const trustItems: Array<{ key: string; label: string }> = [
    { key: 'noLogin', label: t('trust.noLogin') },
    { key: 'stripe', label: t('trust.stripe') },
    { key: 'refund', label: t('trust.refund') },
    { key: 'noExpertise', label: t('trust.noExpertise') },
  ];

  const heroFindings = [
    { status: t('findings.protected'), title: t('findings.stripeTitle'), sub: t('findings.stripeSub') },
    { status: t('findings.protected'), title: t('findings.headersTitle'), sub: t('findings.headersSub') },
    { status: t('findings.verified'), title: t('findings.tlsTitle'), sub: t('findings.tlsSub') },
  ];

  const categories: Array<{ key: string; label: string; color?: string; bg?: string }> = [
    { key: 'security', label: t('categories.security') },
    { key: 'performance', label: t('categories.performance') },
    { key: 'accessibility', label: t('categories.accessibility') },
    { key: 'seo', label: t('categories.seo') },
    { key: 'active', label: t('categories.active'), color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    { key: 'code', label: t('categories.code'), color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  ];

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
          {t('pill')}
        </span>

        <HeroHeadlineAnim
          initial={t('heroTitleInitialLine1')}
          final={t('heroTitleLine1')}
          line2={t('heroTitleLine2')}
        />

        <p
          className="text-lead"
          style={{ maxWidth: 560, marginInline: 'auto', marginBottom: 'var(--space-10)' }}
        >
          {t('heroLead')}
        </p>

        <form
          className="url-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleScan();
          }}
          role="search"
          aria-label={t('searchAriaLabel')}
        >
          <IconGlobe size={20} />
          <label htmlFor="hero-url" className="sr-only">
            {t('urlLabel')}
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
            placeholder={t('urlPlaceholder')}
            disabled={loading}
          />
          <button type="submit" disabled={loading} aria-label={t('scanAriaLabel')}>
            {loading ? t('starting') : t('scanFree')}
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
          <span style={{ color: 'var(--text-secondary)' }}>
            {t('weeklyCounter', { count: weeklyCount ?? 0 })}
          </span>
        </p>

        <ul
          aria-label={t('trust.label')}
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
          {trustItems.map((item) => (
            <li
              key={item.key}
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
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="container-narrow"
        style={{ marginTop: 'var(--space-10)' }}
      >
        <ul
          aria-label={t('findings.label')}
          className="grid-3"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {heroFindings.map((f) => (
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

      <div className="container-narrow" style={{ marginTop: 'var(--space-10)' }}>
        <ul
          aria-label={t('categories.label')}
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
          {categories.map((cat) => (
            <li key={cat.key}>
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

function ToolsStrip() {
  const t = useTranslations('landing.tools');
  const tools = ['Lovable', 'Bolt', 'v0', 'Cursor', 'Replit'];
  return (
    <section
      aria-label={t('label')}
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
        {t('label')}
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
        {tools.map((tool) => (
          <li
            key={tool}
            style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.65 }}
          >
            {tool}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowItWorksSection() {
  const t = useTranslations('landing.how');
  const steps = [
    { n: '01', title: t('step1Title'), desc: t('step1Desc') },
    { n: '02', title: t('step2Title'), desc: t('step2Desc') },
    { n: '03', title: t('step3Title'), desc: t('step3Desc') },
  ];

  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="section">
      <div className="container">
        <SectionHeader
          eyebrow={t('eyebrow')}
          id="how-heading"
          title={t('title')}
          lead={t('lead')}
        />

        <ol className="grid-feature" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {steps.map((s) => (
            <li key={s.n} className="card" style={{ padding: 'var(--space-8)' }}>
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
                {t('stepLabel', { n: s.n })}
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

function StatsSection({ weeklyCount }: { weeklyCount: number | null }) {
  const t = useTranslations('landing.stats');
  const locale = useLocale();
  const stats: Array<{ value: string; label: string; tone?: 'accent' }> = [
    { value: formatCount(weeklyCount, locale), label: t('weekly'), tone: 'accent' },
    { value: '700+', label: t('patterns') },
    { value: '90s', label: t('scanTime') },
    { value: '$3,200', label: t('auditCost') },
  ];

  return (
    <section aria-labelledby="stats-heading" className="section-sm" style={{ borderTop: '1px solid var(--border-light)' }}>
      <div className="container">
        <h2 id="stats-heading" className="sr-only">
          {t('heading')}
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
          {stats.map((s) => (
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

function FeaturesSection() {
  const t = useTranslations('landing.features');
  const tActive = useTranslations('landing.activeBanner');
  const tCode = useTranslations('landing.codeBanner');

  const featureCards = [
    { emoji: '🛡️', title: t('securityTitle'), desc: t('securityDesc'), tags: t('securityTags') },
    { emoji: '💻', title: t('codeTitle'), desc: t('codeDesc'), tags: t('codeTags') },
    { emoji: '⚡', title: t('perfTitle'), desc: t('perfDesc'), tags: t('perfTags') },
    { emoji: '♿', title: t('a11yTitle'), desc: t('a11yDesc'), tags: t('a11yTags') },
    { emoji: '🤖', title: t('aiTitle'), desc: t('aiDesc'), tags: t('aiTags') },
  ];

  return (
    <section id="features" aria-labelledby="features-heading" className="section">
      <div className="container">
        <SectionHeader
          eyebrow={t('eyebrow')}
          id="features-heading"
          title={t('title')}
          lead={t('lead')}
        />

        <FeatureBanner
          color="#DC2626"
          gradientFrom="rgba(220,38,38,0.10)"
          gradientTo="rgba(124,58,237,0.08)"
          emoji="🔴"
          badge={tActive('badge')}
          eyebrow={tActive('eyebrow')}
          title={tActive('title')}
          body={
            <span
              dangerouslySetInnerHTML={{ __html: tActive.raw('body') as string }}
            />
          }
          bullets={[tActive('bullet1'), tActive('bullet2'), tActive('bullet3'), tActive('bullet4')]}
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
              <div className="eyebrow" style={{ color: 'var(--text-tertiary)' }}>{tActive('replaces')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>$5,000</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>{tActive('pentest')}</div>
              <div className="eyebrow" style={{ color: 'var(--text-tertiary)' }}>VibeSafe</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626' }}>{tActive('credits')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tActive('perScan')}</div>
            </div>
          }
        />

        <FeatureBanner
          color="#7C3AED"
          gradientFrom="rgba(124,58,237,0.10)"
          gradientTo="rgba(13,148,136,0.08)"
          emoji="📋"
          eyebrow={tCode('eyebrow')}
          title={tCode('title')}
          body={tCode('body')}
          bullets={[tCode('bullet1'), tCode('bullet2'), tCode('bullet3'), tCode('bullet4')]}
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
              <div style={{ color: '#7C3AED', fontWeight: 700, marginBottom: 6 }}>{tCode('prBlocked')}</div>
              <div style={{ color: '#DC2626' }}>{tCode('exposedKey')}</div>
              <div style={{ color: '#DC2626' }}>{tCode('dbPassword')}</div>
              <div style={{ color: 'var(--success)', marginTop: 4 }}>{tCode('fixMerge')}</div>
            </div>
          }
        />

        <div className="grid-feature" style={{ marginTop: 'var(--space-10)' }}>
          {featureCards.map((card) => (
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

function ComparisonSection() {
  const t = useTranslations('landing.comparison');
  const rows = [1, 2, 3, 4, 5, 6].map((i) => ({
    feature: t(`row${i}Feature`),
    vibesafe: t(`row${i}Vibesafe`),
    manual: t(`row${i}Manual`),
    competitor: t(`row${i}Competitor`),
  }));

  return (
    <section
      id="why-vibesafe"
      aria-labelledby="compare-heading"
      className="section"
      style={{ background: 'var(--surface-secondary)' }}
    >
      <div className="container">
        <SectionHeader
          eyebrow={t('eyebrow')}
          id="compare-heading"
          title={t('title')}
          lead={t('lead')}
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
            <caption className="sr-only">{t('caption')}</caption>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th scope="col" style={cellHeadCss}>&nbsp;</th>
                <th scope="col" style={{ ...cellHeadCss, color: 'var(--accent)' }}>{t('colVibesafe')}</th>
                <th scope="col" style={cellHeadCss}>{t('colManual')}</th>
                <th scope="col" style={cellHeadCss}>{t('colCompetitor')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
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

function TestimonialsSection() {
  const t = useTranslations('landing.testimonials');
  const items = [1, 2, 3].map((i) => ({
    quote: t(`t${i}Quote`),
    name: t(`t${i}Name`),
    role: t(`t${i}Role`),
  }));

  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" className="section">
      <div className="container">
        <SectionHeader
          eyebrow={t('eyebrow')}
          id="testimonials-heading"
          title={t('title')}
          lead={t('lead')}
        />

        <div className="grid-feature">
          {items.map((item) => (
            <figure key={item.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div aria-hidden="true" style={{ fontSize: 24, color: 'var(--accent)', lineHeight: 1 }}>
                &ldquo;
              </div>
              <blockquote style={{ fontSize: 'var(--fs-lg)', color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
                {item.quote}
              </blockquote>
              <figcaption style={{ marginTop: 'auto' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-base)' }}>{item.name}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{item.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const t = useTranslations('landing.faq');
  const faqs = [1, 2, 3, 4, 5, 6].map((i) => ({
    q: t(`q${i}`),
    a: t(`a${i}`),
  }));

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="section"
      style={{ background: 'var(--surface-secondary)' }}
    >
      <div className="container-prose">
        <SectionHeader
          eyebrow={t('eyebrow')}
          id="faq-heading"
          title={t('title')}
          lead={t('lead')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {faqs.map((f, i) => (
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

function FinalCTASection() {
  const t = useTranslations('landing.finalCta');
  return (
    <section
      aria-labelledby="cta-heading"
      className="section"
      style={{ textAlign: 'center' }}
    >
      <div className="container-prose">
        <h2 id="cta-heading" className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
          {t('title')}
        </h2>
        <p className="text-lead" style={{ marginBottom: 'var(--space-8)' }}>
          {t('lead')}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/#hero-heading" className="btn-primary" aria-label={t('scanButtonAria')}>
            {t('scanButton')}
            <IconArrowRight size={16} color="#fff" />
          </Link>
          <Link href="/pricing" className="btn-secondary">
            {t('pricingButton')}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ChromeExtensionSection() {
  const t = useTranslations('landing.extension');
  const bullets = [t('bullet1'), t('bullet2'), t('bullet3'), t('bullet4')];

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
              {t('eyebrow')}
            </div>
            <h2 id="extension-title" className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
              {t('title')}
            </h2>
            <p className="text-lead" style={{ marginBottom: 'var(--space-6)' }}>
              {t('lead')}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-6)', display: 'grid', gap: 'var(--space-2)' }}>
              {bullets.map((b) => (
                <li key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
                  <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', maxWidth: 480 }}
              aria-label={t('waitlistAria')}
            >
              <input
                type="email"
                required
                placeholder={t('emailPlaceholder')}
                aria-label={t('emailLabel')}
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
                {t('joinWaitlist')}
              </button>
            </form>
            <p
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}
              dangerouslySetInnerHTML={{ __html: t.raw('noSpam') as string }}
            />
          </div>

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
                  {t('preview.criticalFindings')}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('preview.exposedKey')}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t('preview.missingCsp')}</div>
                <div style={{
                  marginTop: 4, padding: '6px 10px',
                  borderRadius: 6, background: 'var(--accent)', color: '#fff',
                  fontWeight: 700, fontSize: 11, textAlign: 'center',
                }}>
                  {t('preview.runScan')}
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
