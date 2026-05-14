import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { routing, type Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('contactMetaTitle'),
    description: t('contactMetaDesc'),
    alternates: { canonical: `/${locale}/legal/contact` },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {t('contactTitle')}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 48, lineHeight: 1.6 }}>
            {t('contactLead')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <ContactCard
              title={t('contactLegalTitle')}
              desc={t('contactLegalDesc')}
              email="legal@vibesafe.app"
            />
            <ContactCard
              title={t('contactPrivacyTitle')}
              desc={t('contactPrivacyDesc')}
              email="privacy@vibesafe.app"
            />
            <ContactCard
              title={t('contactSecurityTitle')}
              desc={t('contactSecurityDesc')}
              email="security@vibesafe.app"
            />
            <ContactCard
              title={t('contactAbuseTitle')}
              desc={t('contactAbuseDesc')}
              email="abuse@vibesafe.app"
              variant="warning"
            />
            <ContactCard
              title={t('contactDmcaTitle')}
              desc={t('contactDmcaDesc')}
              email="dmca@vibesafe.app"
            />
          </div>

          <div
            style={{
              marginTop: 48,
              padding: 24,
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 12,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              {t('responseTitle')}
            </h3>
            <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 24 }}>
              <li dangerouslySetInnerHTML={{ __html: t.raw('responseSecurity') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('responseAbuse') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('responsePrivacy') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('responseGeneral') as string }} />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  title,
  desc,
  email,
  variant,
}: {
  title: string;
  desc: string;
  email: string;
  variant?: 'warning';
}) {
  const isWarn = variant === 'warning';
  return (
    <div
      style={{
        backgroundColor: isWarn ? '#fef3c7' : 'var(--surface)',
        border: isWarn ? '2px solid #f59e0b' : '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: isWarn ? '#92400e' : 'var(--text)',
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: isWarn ? '#78350f' : 'var(--text-secondary)',
          marginBottom: 12,
        }}
      >
        {desc}
      </p>
      <a
        href={`mailto:${email}`}
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: isWarn ? '#b45309' : 'var(--accent)',
          textDecoration: 'none',
        }}
      >
        {email}
      </a>
    </div>
  );
}
