import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'View recent scans, security grade trends, critical findings, and monitored sites — all in one place.',
  alternates: { canonical: '/dashboard' },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type StatTone = 'neutral' | 'danger' | 'accent';

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

function buildStatCards(stats: DashboardStats): StatCard[] {
  return [
    {
      value: stats.totalScans.toString(),
      label: 'Total scans',
      trend: stats.trends.totalScans,
      tone: 'neutral',
    },
    {
      value: stats.criticalIssues.toString(),
      label: 'Critical issues',
      trend: stats.trends.criticalIssues,
      tone: stats.criticalIssues > 0 ? 'danger' : 'neutral',
    },
    {
      value: stats.avgGrade ?? '—',
      label: 'Avg. grade',
      trend: stats.trends.avgGrade,
      tone: 'accent',
    },
    {
      value: stats.monitoredSites.toString(),
      label: 'Monitored sites',
      trend: stats.trends.monitoredSites,
      tone: 'neutral',
    },
  ];
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/dashboard');
  }

  let stats: DashboardStats | null = null;
  let scans: ScanListItem[] = [];
  let loadError = false;
  try {
    const [statsResult, scansResult] = await Promise.all([
      getDashboardStats(user.id),
      listUserScans(user.id, { limit: 20 }),
    ]);
    stats = statsResult;
    scans = scansResult.items;
  } catch (err) {
    logger.error('Dashboard page load failed', { userId: user.id }, err as Error);
    loadError = true;
  }

  const statCards = stats ? buildStatCards(stats) : [];

  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">
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
                  Dashboard
                </h1>
                <p className="text-lead" style={{ margin: 0 }}>
                  Manage and monitor your website scans
                </p>
              </div>
              <Link href="/" className="btn-primary">
                New scan
                <IconArrowRight size={16} color="#fff" />
              </Link>
            </header>

            {loadError && <LoadError />}

            {!loadError && stats && (
              <section
                aria-label="Account summary"
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
                  Recent scans
                </h2>

                {scans.length === 0 ? (
                  <EmptyState />
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
                        <caption className="sr-only">Recent website scans</caption>
                        <thead>
                          <tr style={{ background: 'var(--surface-secondary)' }}>
                            <th style={tHeadCss} scope="col">Site</th>
                            <th style={tHeadCss} scope="col">Grade</th>
                            <th style={tHeadCss} scope="col">Issues</th>
                            <th style={tHeadCss} scope="col">Scanned</th>
                            <th style={{ ...tHeadCss, textAlign: 'right' }} scope="col">Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scans.map((s, i) => (
                            <ScanRow key={s.id} scan={s} isFirst={i === 0} />
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
                        <ScanCard key={s.id} scan={s} />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function ScanRow({ scan, isFirst }: { scan: ScanListItem; isFirst: boolean }) {
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
        <IssueChips critical={scan.critical} high={scan.high} medium={scan.medium} />
      </td>
      <td style={{ ...tCellCss, color: 'var(--text-tertiary)' }}>
        {formatRelative(scan.completedAt ?? scan.startedAt)}
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
          View
          <IconArrowRight size={14} color="var(--accent)" />
        </Link>
      </td>
    </tr>
  );
}

function ScanCard({ scan }: { scan: ScanListItem }) {
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
        <IssueChips critical={scan.critical} high={scan.high} medium={scan.medium} />
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          {formatRelative(scan.completedAt ?? scan.startedAt)}
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
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
      <h3 style={{ marginBottom: 'var(--space-2)' }}>No scans yet</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        Paste a URL on the homepage to run your first scan.
      </p>
      <Link href="/" className="btn-primary" style={{ display: 'inline-flex' }}>
        Run your first scan
        <IconArrowRight size={16} color="#fff" />
      </Link>
    </div>
  );
}

function LoadError() {
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
      We couldn&apos;t load your dashboard data. Please refresh to try again.
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

function IssueChips({ critical, high, medium }: { critical: number; high: number; medium: number }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
      <Chip n={critical} label="Critical" color="#DC2626" bg="rgba(220,38,38,0.12)" />
      <Chip n={high} label="High" color="#F59E0B" bg="rgba(245,158,11,0.12)" />
      <Chip n={medium} label="Medium" color="#CA8A04" bg="rgba(202,138,4,0.10)" />
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
