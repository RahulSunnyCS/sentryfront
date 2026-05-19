import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { CheckoutButton } from '@/components/checkout-button';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

interface Tier {
  id: 'verify' | 'activePack' | 'monitor';
  price: number;
  cadence: string;
  featured: boolean;
  badge?: string;
  badgeColor?: string;
  tier: 'one-shot' | 'pro' | 'studio';
}

function pricingTiers(t: (key: string) => string): Array<Tier & {
  name: string;
  desc: string;
  btn: string;
  features: string[];
}> {
  const oneTime = t('cadenceOneTime');
  const perMonth = t('cadencePerMonth');
  return [
    {
      id: 'verify',
      price: 0,
      cadence: oneTime,
      featured: false,
      tier: 'one-shot',
      name: t('tiers.verify.name'),
      desc: t('tiers.verify.desc'),
      btn: t('tiers.verify.btn'),
      features: [
        t('tiers.verify.f1'),
        t('tiers.verify.f2'),
        t('tiers.verify.f3'),
        t('tiers.verify.f4'),
      ],
    },
    {
      id: 'activePack',
      price: 0,
      cadence: oneTime,
      featured: true,
      tier: 'pro',
      badge: t('badgeMostPopular'),
      badgeColor: 'var(--accent)',
      name: t('tiers.activePack.name'),
      desc: t('tiers.activePack.desc'),
      btn: t('tiers.activePack.btn'),
      features: [
        t('tiers.activePack.f1'),
        t('tiers.activePack.f2'),
        t('tiers.activePack.f3'),
        t('tiers.activePack.f4'),
      ],
    },
    {
      id: 'monitor',
      price: 0,
      cadence: perMonth,
      featured: false,
      tier: 'studio',
      name: t('tiers.monitor.name'),
      desc: t('tiers.monitor.desc'),
      btn: t('tiers.monitor.btn'),
      features: [
        t('tiers.monitor.f1'),
        t('tiers.monitor.f2'),
        t('tiers.monitor.f3'),
        t('tiers.monitor.f4'),
      ],
    },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });

  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/pricing` },
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDesc'),
      url: `/${locale}/pricing`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDesc'),
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pricing' });

  const tiers = pricingTiers(t);
  const faqs = [1, 2, 3, 4, 5, 6].map((i) => ({
    q: t(`faqs.q${i}`),
    a: t(`faqs.a${i}`),
  }));

  const PRICING_LD = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'VibeSafe Active Testing & Monitoring',
    description: t('metaDesc'),
    brand: { '@type': 'Brand', name: 'VibeSafe' },
    inLanguage: locale,
    offers: tiers.map((tier) => ({
      '@type': 'Offer',
      name: `${tier.name} — $${tier.price} ${tier.cadence}`,
      price: tier.price.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `https://vibesafe.app/${locale}/pricing#${tier.id}`,
    })),
  };

  const FAQ_LD = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">

            <header style={{ textAlign: 'center', marginBottom: 'var(--space-16)' }}>
              <div className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{t('eyebrow')}</div>
              <h1 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>
                {t('heroTitle')}
              </h1>
              <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
                {t('heroLead')}
              </p>
            </header>

            <section
              aria-label={t('freeBadge')}
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
                {t('freeBadge')}
              </div>
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
                {t('freeTitle')}
              </h2>
              <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', maxWidth: 560, marginInline: 'auto' }}>
                {t('freeDesc')}
              </p>
              <Link href="/" className="btn-primary">{t('freeCta')}</Link>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-4)' }}>
                {t('freeUpsell')}
              </p>
            </section>

            <section
              aria-label={t('includedHeading')}
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
                {t('includedHeading')}
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
                <li>{t('includedSecurity')} <strong style={{ color: 'var(--text)' }}>{t('includedSecurityNote')}</strong></li>
                <li>{t('includedPerformance')} <strong style={{ color: 'var(--text)' }}>{t('includedPerformanceNote')}</strong></li>
                <li>{t('includedAccessibility')} <strong style={{ color: 'var(--text)' }}>{t('includedAccessibilityNote')}</strong></li>
                <li>{t('includedSeo')} <strong style={{ color: 'var(--text)' }}>{t('includedSeoNote')}</strong></li>
              </ul>
            </section>

            <section aria-label={t('paidTitle')} style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
              <h2 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>{t('paidTitle')}</h2>
              <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                {t('paidLead')}
              </p>
            </section>

            <section
              aria-label={t('paidTitle')}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 'var(--space-5)',
                maxWidth: 1000,
                margin: '0 auto var(--space-20)',
              }}
            >
              {tiers.map((tier) => (
                <PricingCard key={tier.id} {...tier} />
              ))}
            </section>

            <section aria-labelledby="pricing-faq-heading" style={{ maxWidth: 720, margin: '0 auto' }}>
              <h2 id="pricing-faq-heading" className="text-h2" style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
                {t('faqHeading')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {faqs.map((f, i) => (
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

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

interface PricingCardProps extends Tier {
  name: string;
  desc: string;
  btn: string;
  features: string[];
}

function PricingCard(props: PricingCardProps) {
  return (
    <article
      id={props.id}
      data-testid="pricing-card"
      style={{
        background: 'var(--surface)',
        border: `2px solid ${props.featured ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        position: 'relative',
        boxShadow: props.featured ? '0 0 0 4px rgba(13,148,136,0.10)' : 'none',
      }}
    >
      {props.badge && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: props.badgeColor ?? 'var(--accent)',
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
          {props.badge}
        </div>
      )}

      <header style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, marginBottom: 4 }}>{props.name}</h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{props.desc}</p>
      </header>

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>${props.price}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{props.cadence}</div>
        </div>
      </div>

      <CheckoutButton tier={props.tier} label={props.btn} featured={props.featured} />

      <ul style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--fs-sm)' }}>
        {props.features.map((feat) => (
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
