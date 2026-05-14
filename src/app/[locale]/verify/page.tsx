import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { getCurrentUser } from '@/lib/auth/helpers';
import { getOrCreateVerification, normalizeDomain, TOKEN_PREFIX } from '@/lib/verify-domain';
import { ValidationError } from '@/lib/url-validator';
import { logger } from '@/lib/logger';
import { VerifyFlow } from './verify-flow';
import { DomainEntry } from './domain-entry';
import { routing, type Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'verify' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/verify` },
    robots: { index: false, follow: false },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ domain?: string | string[] }>;
}

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'verify' });
  const sp = (await searchParams) ?? {};

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login?next=/verify', locale: locale as Locale });
  }

  const rawDomain = Array.isArray(sp.domain) ? sp.domain[0] : sp.domain;

  let domain: string | null = null;
  let domainError: string | null = null;
  if (rawDomain) {
    try {
      domain = normalizeDomain(rawDomain);
    } catch (err) {
      if (err instanceof ValidationError) domainError = err.message;
      else throw err;
    }
  }

  let token: string | null = null;
  let alreadyVerified = false;
  if (domain) {
    try {
      const record = await getOrCreateVerification(user!.id, domain);
      token = `${TOKEN_PREFIX}${record.token}`;
      alreadyVerified = record.verifiedAt !== null;
    } catch (err) {
      logger.error('Verify token init failed', { userId: user!.id, domain }, err as Error);
      domainError = t('initError');
      domain = null;
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
                  background: 'rgba(220,38,38,0.10)',
                  color: '#DC2626',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <span aria-hidden="true" className="pulse-soft">●</span>
                {t('requiredBadge')}
              </div>
              <h1 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>
                {t('heroTitle')}
              </h1>
              <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
                {t('heroLead')}
              </p>
            </header>

            {domain && token ? (
              <VerifyFlow
                domain={domain}
                token={token}
                alreadyVerified={alreadyVerified}
              />
            ) : (
              <DomainEntry error={domainError} initialDomain={rawDomain ?? ''} />
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
