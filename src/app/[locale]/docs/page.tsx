import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { DocsLayout } from './docs-layout';
import { routing, type Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'docs' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/docs` },
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDesc'),
      url: `/${locale}/docs`,
      type: 'article',
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <DocsLayout />
        <Footer />
      </div>
    </>
  );
}
