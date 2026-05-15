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
  type Grade,
  type ScanListItem,
} from '@/lib/dashboard-queries';
import { logger } from '@/lib/logger';
import { routing, type Locale } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';

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

type StatTone = 'neutral' | 'danger' | 'accent';
type Translator = Awaited<ReturnType<typeof getTranslations<'dashboard'>>>;

interface StatCard {
  value: string;
  label: string;
  trend: string | null;
  tone: StatTone;
}

const GRADE_TONE: Record<Grade, { bg: string; fg: string }> = {
  A: { bg: 'rgba(5,150,105,0.15)', fg: '#10B981' },
  B: { bg: 'rgba(13,148,136,0.15)', fg: 'var(--accent)' },
  C: { bg: 'rgba(202,138,4,0.15)', fg: '#CA8A04' },
  D: { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B' },
  F: { bg: 'rgba(220,38,38,0.18)', fg: '#DC2626' },
};

function buildStatCards(stats: DashboardStats, t: Translator): StatCard[] {
  return [
    {
      value: stats.totalScans.toString(),
      label: t('totalScans'),
      trend: stats.trends.totalScans,
      tone: 'neutral',
    },
    {
      value: stats.criticalIssues.toString(),
      label: t('criticalIssues'),
      trend: stats.trends.criticalIssues,
      tone: stats.criticalIssues > 0 ? 'danger' : 'neutral',
    },
    {
      value: stats.avgGrade ?? '—',
      label: t('avgGrade'),
      trend: stats.trends.avgGrade,
      tone: 'accent',
    },
    {
      value: stats.monitoredSites.toString(),
      label: t('monitoredSites'),
      trend: stats.trends.monitoredSites,
      tone: 'neutral',
    },
  ];
}

function formatRelative(iso: string | null, locale: string, t: Translator): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return t('justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('minutesAgo', { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('hoursAgo', { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return t('yesterday');
  if (diffDay < 7) return t('daysAgo', { count: diffDay });
  return new Date(iso).toLocaleDateString(locale);
}

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

  // Block access until email is verified (OAuth users are pre-verified)
  if (!dbUser?.emailVerified && !justVerified) {
    redirect({ href: '/verify-email-sent', locale: locale as Locale });
  }

  let stats: DashboardStats | null = null;
  let scans: ScanListItem[] = [];
  let loadError = false;
  try {
    const [statsResult, scansResult] = await Promise.all([
      getDashboardStats(user!.id),
      listUserScans(user!.id, { limit: 20 }),
    ]);
    stats = statsResult;
    scans = scansResult.items;
  } catch (err) {
    logger.error('Dashboard page load failed', { userId: user!.id }, err as Error);
    loadError = true;
  }

  const statCards = stats ? buildStatCards(stats, t) : [];

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
                marginBottom: 'var(--space-10)',
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
              <section
                aria-label={t('accountSummary')}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--space-4)',
                  marginBottom: 'var(--space-10)',
                }}
              >
                {statCards.map((s) => (
                  <article key={s.label} className="card">
                    <div
                      style={{
                        fontSize: 'var(--fs-sm)',
                        color: 'var(--text-tertiary)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 'clamp(28px, 4vw, 36px)',
                        fontWeight: 800,
                        lineHeight: 1,
                        marginBottom: 'var(--space-2)',
                        color:
                          s.tone === 'accent'
                            ? 'var(--accent)'
                            : s.tone === 'danger'
                            ? '#DC2626'
                            : 'var(--text)',
                      }}
                    >
                      {s.value}
                    </div>
                    {s.trend && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
                        {s.trend}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            {!loadError && (
              <section aria-labelledby="recent-heading">
                <h2 id="recent-heading" className="text-h3" style={{ marginBottom: 'var(--space-6)' }}>
                  {t('recentScans')}
                </h2>

                {scans.length === 0 ? (
                  <EmptyState
                    title={t('emptyTitle')}
                    desc={t('emptyDesc')}
                    cta={t('emptyCta')}
                  />
                ) : (
                  <>
                    <div
                      className="scans-table-wrap"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-base)' }}>
                        <caption className="sr-only">{t('recentScansCaption')}</caption>
                        <thead>
                          <tr style={{ background: 'var(--surface-secondary)' }}>
                            <th style={tHeadCss} scope="col">{t('colSite')}</th>
                            <th style={tHeadCss} scope="col">{t('colGrade')}</th>
                            <th style={tHeadCss} scope="col">{t('colIssues')}</th>
                            <th style={tHeadCss} scope="col">{t('colScanned')}</th>
                            <th style={{ ...tHeadCss, textAlign: 'right' }} scope="col">{t('colReport')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scans.map((s, i) => (
                            <ScanRow
                              key={s.id}
                              scan={s}
                              isFirst={i === 0}
                              locale={locale}
                              t={t}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <ul
                      className="scans-cards-mobile"
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      {scans.map((s) => (
                        <ScanCard key={s.id} scan={s} locale={locale} t={t} />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            <ComingSoonSection t={t} />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function ScanRow({
  scan,
  isFirst,
  locale,
  t,
}: {
  scan: ScanListItem;
  isFirst: boolean;
  locale: string;
  t: Translator;
}) {
  const tone = scan.grade ? GRADE_TONE[scan.grade] : null;
  return (
    <tr style={{ borderTop: isFirst ? 'none' : '1px solid var(--border-light)' }}>
      <th scope="row" style={{ ...tCellCss, fontWeight: 600, color: 'var(--text)' }}>
        {scan.url}
      </th>
      <td style={tCellCss}>
        {scan.grade && tone ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              background: tone.bg,
              color: tone.fg,
              fontWeight: 700,
            }}
          >
            {scan.grade}
            {typeof scan.score === 'number' && (
              <span style={{ fontWeight: 500, opacity: 0.85 }}>
                {Math.round(scan.score)}/100
              </span>
            )}
          </span>
        ) : (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            {scan.status.toLowerCase()}
          </span>
        )}
      </td>
      <td style={tCellCss}>
        <IssueChips
          critical={scan.critical}
          high={scan.high}
          medium={scan.medium}
          labels={{ critical: t('critical'), high: t('high'), medium: t('medium') }}
        />
      </td>
      <td style={{ ...tCellCss, color: 'var(--text-tertiary)' }}>
        {formatRelative(scan.completedAt ?? scan.startedAt, locale, t)}
      </td>
      <td style={{ ...tCellCss, textAlign: 'right' }}>
        <Link
          href={`/report/${scan.id}`}
          className="nav-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            color: 'var(--accent)',
          }}
        >
          {t('view')}
          <IconArrowRight size={14} color="var(--accent)" />
        </Link>
      </td>
    </tr>
  );
}

function ScanCard({
  scan,
  locale,
  t,
}: {
  scan: ScanListItem;
  locale: string;
  t: Translator;
}) {
  const tone = scan.grade ? GRADE_TONE[scan.grade] : null;
  return (
    <li>
      <Link
        href={`/report/${scan.id}`}
        className="card card-interactive"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
          <strong style={{ fontSize: 'var(--fs-md)' }}>{scan.url}</strong>
          {scan.grade && tone ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                background: tone.bg,
                color: tone.fg,
                fontWeight: 700,
                fontSize: 'var(--fs-sm)',
              }}
            >
              {scan.grade}
              {typeof scan.score === 'number' && <> · {Math.round(scan.score)}</>}
            </span>
          ) : (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              {scan.status.toLowerCase()}
            </span>
          )}
        </div>
        <IssueChips
          critical={scan.critical}
          high={scan.high}
          medium={scan.medium}
          labels={{ critical: t('critical'), high: t('high'), medium: t('medium') }}
        />
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          {formatRelative(scan.completedAt ?? scan.startedAt, locale, t)}
        </div>
      </Link>
    </li>
  );
}

function EmptyState({ title, desc, cta }: { title: string; desc: string; cta: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-10) var(--space-6)',
        textAlign: 'center',
      }}
    >
      <h3 style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        {desc}
      </p>
      <Link href="/" className="btn-primary" style={{ display: 'inline-flex' }}>
        {cta}
        <IconArrowRight size={16} color="#fff" />
      </Link>
    </div>
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

const tHeadCss: React.CSSProperties = {
  padding: '14px 18px',
  fontSize: 'var(--fs-sm)',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
};
const tCellCss: React.CSSProperties = {
  padding: '14px 18px',
  color: 'var(--text-secondary)',
  textAlign: 'left',
};

function IssueChips({
  critical,
  high,
  medium,
  labels,
}: {
  critical: number;
  high: number;
  medium: number;
  labels: { critical: string; high: string; medium: string };
}) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
      <Chip n={critical} label={labels.critical} color="#DC2626" bg="rgba(220,38,38,0.12)" />
      <Chip n={high} label={labels.high} color="#F59E0B" bg="rgba(245,158,11,0.12)" />
      <Chip n={medium} label={labels.medium} color="#CA8A04" bg="rgba(202,138,4,0.10)" />
    </div>
  );
}

function Chip({ n, label, color, bg }: { n: number; label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        background: bg,
        color,
        opacity: n === 0 ? 0.4 : 1,
      }}
    >
      <span style={{ fontWeight: 700 }}>{n}</span>
      <span>{label}</span>
    </span>
  );
}

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
