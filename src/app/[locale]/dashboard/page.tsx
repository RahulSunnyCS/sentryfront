import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { IconArrowRight } from '@/components/icons';
import { getCurrentUser } from '@/lib/auth/helpers';
import {
  getDashboardStats,
  listUserScans,
  type DashboardStats,
} from '@/lib/dashboard-queries';
import { logger } from '@/lib/logger';
import { routing, type Locale } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { StatsRibbon } from './stats-ribbon';
import { ScanHistory } from './scan-history';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/dashboard` },
    robots: { index: false, follow: false },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ verified?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login?next=/dashboard', locale: locale as Locale });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { emailVerified: true },
  });
  const justVerified = sp?.verified === '1';

  if (!dbUser?.emailVerified && !justVerified) {
    redirect({ href: '/verify-email-sent', locale: locale as Locale });
  }

  let stats: DashboardStats | null = null;
  let loadError = false;
  let initialItems: Awaited<ReturnType<typeof listUserScans>>['items'] = [];
  let initialCursor: string | null = null;
  let initialHasMore = false;

  try {
    const [statsResult, scansResult] = await Promise.all([
      getDashboardStats(user!.id),
      listUserScans(user!.id, { limit: 20 }),
    ]);
    stats = statsResult;
    initialItems = scansResult.items;
    initialCursor = scansResult.nextCursor;
    initialHasMore = scansResult.hasMore;
  } catch (err) {
    logger.error('Dashboard page load failed', { userId: user!.id }, err as Error);
    loadError = true;
  }

  const ribbonLabels = {
    statScans: t('statScans'),
    statCritical: t('statCritical'),
    statAvgGrade: t('statAvgGrade'),
    statSites: t('statSites'),
  };

  const historyLabels = {
    scanHistory: t('scanHistory'),
    searchPlaceholder: t('searchPlaceholder'),
    filterGrade: t('filterGrade'),
    filterStatus: t('filterStatus'),
    filterAll: t('filterAll'),
    sortDateDesc: t('sortDateDesc'),
    sortDateAsc: t('sortDateAsc'),
    sortGrade: t('sortGrade'),
    sortIssues: t('sortIssues'),
    loadMore: t('loadMore'),
    colSite: t('colSite'),
    colGrade: t('colGrade'),
    colIssues: t('colIssues'),
    colScanned: t('colScanned'),
    colReport: t('colReport'),
    colActions: t('colActions'),
    critical: t('critical'),
    high: t('high'),
    medium: t('medium'),
    view: t('view'),
    rescan: t('rescan'),
    rescanError: t('rescanError'),
    justNow: t('justNow'),
    minutesAgo: t('minutesAgo', { count: 0 }),
    hoursAgo: t('hoursAgo', { count: 0 }),
    yesterday: t('yesterday'),
    daysAgo: t('daysAgo', { count: 0 }),
    emptyTitle: t('emptyTitle'),
    emptyDesc: t('emptyDesc'),
    loadError: t('loadError'),
    statusCompleted: t('statusCompleted'),
    statusRunning: t('statusRunning'),
    statusFailed: t('statusFailed'),
  };

  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">

            {justVerified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 'var(--space-6)', fontSize: 'var(--fs-sm)', color: '#15803d' }}>
                <span>✅</span>
                <span>Email verified — your account is fully activated.</span>
              </div>
            )}

            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-8)',
              }}
            >
              <div>
                <h1 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>
                  {t('title')}
                </h1>
                <p className="text-lead" style={{ margin: 0 }}>
                  {t('lead')}
                </p>
              </div>
              <Link href="/" className="btn-primary">
                {t('newScan')}
                <IconArrowRight size={16} color="#fff" />
              </Link>
            </header>

            {loadError && <LoadError message={t('loadError')} />}

            {!loadError && stats && (
              <StatsRibbon stats={stats} labels={ribbonLabels} />
            )}

            {!loadError && (
              <ScanHistory
                initialItems={initialItems}
                initialCursor={initialCursor}
                initialHasMore={initialHasMore}
                locale={locale}
                labels={historyLabels}
              />
            )}

            <ComingSoonSection t={t} />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(220,38,38,0.08)',
        border: '1px solid rgba(220,38,38,0.25)',
        color: '#DC2626',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-10)',
      }}
    >
      {message}
    </div>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations<'dashboard'>>>;

interface ComingSoonFeature {
  emoji: string;
  color: string;
  bg: string;
  border: string;
  titleKey: 'dastTitle' | 'githubTitle' | 'extensionTitle';
  descKey: 'dastDesc' | 'githubDesc' | 'extensionDesc';
}

const COMING_SOON_FEATURES: ComingSoonFeature[] = [
  {
    emoji: '⚡',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.20)',
    titleKey: 'dastTitle',
    descKey: 'dastDesc',
  },
  {
    emoji: '🔗',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.07)',
    border: 'rgba(124,58,237,0.20)',
    titleKey: 'githubTitle',
    descKey: 'githubDesc',
  },
  {
    emoji: '🧩',
    color: '#0D9488',
    bg: 'rgba(13,148,136,0.07)',
    border: 'rgba(13,148,136,0.20)',
    titleKey: 'extensionTitle',
    descKey: 'extensionDesc',
  },
];

function ComingSoonSection({ t }: { t: Translator }) {
  return (
    <section
      aria-labelledby="coming-soon-heading"
      style={{ marginTop: 'var(--space-10)' }}
    >
      <h2
        id="coming-soon-heading"
        className="text-h3"
        style={{ marginBottom: 'var(--space-6)' }}
      >
        {t('comingSoonHeading')}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {COMING_SOON_FEATURES.map(({ emoji, color, bg, border, titleKey, descKey }) => (
          <article
            key={titleKey}
            className="card"
            style={{ background: bg, borderColor: border, position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color,
                  background: 'rgba(0,0,0,0.06)',
                  border: `1px solid ${border}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('comingSoonBadge')}
              </span>
            </div>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--text)' }}>
              {t(titleKey)}
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              {t(descKey)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
