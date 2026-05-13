import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibesafe.app';
const SITE_NAME = 'VibeSafe';
const DEFAULT_TITLE = 'VibeSafe — Security, performance & compliance scanner for AI-built sites';
const DEFAULT_DESC =
  'Paste a URL and get an enterprise-grade security, performance, accessibility, and SEO report in 90 seconds. Every finding ships with a ready-to-paste AI fix prompt for Cursor, Lovable, Bolt, v0, and Replit.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s · VibeSafe',
  },
  description: DEFAULT_DESC,
  applicationName: SITE_NAME,
  generator: 'Next.js',
  keywords: [
    'security scanner',
    'website security',
    'AI-built site security',
    'Cursor security',
    'Lovable security',
    'Bolt security',
    'v0 security',
    'GDPR compliance scan',
    'WCAG accessibility check',
    'Core Web Vitals',
    'Lighthouse',
    'penetration testing',
    'DAST',
    'secret detection',
    'gitleaks',
    'OWASP scanner',
    'SEO audit',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
    },
  },
  category: 'technology',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    siteName: SITE_NAME,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VibeSafe — Security scanner for AI-built sites',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
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
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
  colorScheme: 'dark light',
};

// JSON-LD payloads — Organization, WebSite (with SearchAction), SoftwareApplication
const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: DEFAULT_DESC,
  sameAs: [
    'https://twitter.com/vibesafe',
    'https://github.com/vibesafe',
  ],
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
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/?url={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: DEFAULT_DESC,
  offers: {
    '@type': 'Offer',
    price: '9.00',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '247',
  },
};

// No-flash theme init: read saved theme synchronously before paint.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
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
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
