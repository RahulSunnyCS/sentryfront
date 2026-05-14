import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { authConfig } from '@/lib/features';
import { LoginCard } from './login-card';
import { routing, type Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/login` },
    robots: { index: false, follow: true },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'login' });

  const googleClientId = authConfig.nextauth.google.clientId;

  return (
    <>
      {googleClientId && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      )}
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-10) var(--space-4)',
          }}
        >
          <Suspense fallback={<LoginFallback label={t('loadingFallback')} />}>
            <LoginCard googleClientId={googleClientId} />
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
}

function LoginFallback({ label }: { label: string }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(24px, 5vw, 40px)',
        boxShadow: 'var(--shadow-md)',
        minHeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
