import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { routing, type Locale } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibesafe.app';
const SITE_NAME = 'Codifie Scan';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function pathForLocale(locale: Locale): string {
  return `/${locale}`;
}

function alternateLanguages(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of routing.locales) map[l] = pathForLocale(l);
  map['x-default'] = pathForLocale(routing.defaultLocale);
  return map;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'metadata.default' });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t('title'),
      template: `%s · ${SITE_NAME}`,
    },
    description: t('description'),
    applicationName: SITE_NAME,
    generator: 'Next.js',
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: {
      canonical: pathForLocale(locale as Locale),
      languages: alternateLanguages(),
    },
    category: 'technology',
    openGraph: {
      type: 'website',
      locale,
      url: `${SITE_URL}/${locale}`,
      title: t('title'),
      description: t('description'),
      siteName: SITE_NAME,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: t('ogAlt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/og-image.png'],
      creator: '@vibesafe',
      site: '@vibesafe',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    icons: {
      icon: '/favicon.svg',
      shortcut: '/favicon.svg',
      apple: '/favicon.svg',
    },
    manifest: '/site.webmanifest',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'jsonld' });

  const ORGANIZATION_LD = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: t('orgDescription'),
    inLanguage: locale,
    sameAs: ['https://twitter.com/vibesafe', 'https://github.com/vibesafe'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@vibesafe.app',
    },
  };

  const WEBSITE_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/${locale}/?url={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const APP_LD = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/${locale}`,
    description: t('appDescription'),
    inLanguage: locale,
    offers: { '@type': 'Offer', price: '9.00', priceCurrency: 'USD' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '247' },
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }}
      />
      <LocaleHtmlAttrs locale={locale} />
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}

// Sets <html lang> from the locale segment without owning the <html> element.
function LocaleHtmlAttrs({ locale }: { locale: string }) {
  const script = `(function(){try{document.documentElement.setAttribute('lang',${JSON.stringify(locale)});}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
