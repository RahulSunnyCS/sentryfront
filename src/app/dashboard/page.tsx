import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { IconArrowRight } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'View recent scans, security grade trends, critical findings, and monitored sites — all in one place.',
  alternates: { canonical: '/dashboard' },
  robots: { index: false, follow: false },
};

interface ScanRow {
  id: string;
  url: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  critical: number;
  high: number;
  medium: number;
  whenLabel: string;
}

const STATS = [
  { value: '24',  label: 'Total scans',     trend: '↑ 12% from last month', tone: 'neutral' as const },
  { value: '7',   label: 'Critical issues', trend: 'Require immediate attention', tone: 'danger' as const },
  { value: 'B',   label: 'Avg. grade',      trend: '↑ 1 grade improved', tone: 'accent' as const },
  { value: '3',   label: 'Monitored sites', trend: 'With continuous scanning', tone: 'neutral' as const },
];

const SCANS: ScanRow[] = [
  { id: 'demo', url: 'taskflow.app',     grade: 'D', score: 35, critical: 2, high: 4, medium: 3, whenLabel: '2 hours ago' },
  { id: 'demo', url: 'mycompany.io',     grade: 'B', score: 82, critical: 0, high: 1, medium: 2, whenLabel: 'Yesterday' },
  { id: 'demo', url: 'secure-app.com',   grade: 'A', score: 94, critical: 0, high: 0, medium: 1, whenLabel: '3 days ago' },
];

const GRADE_TONE: Record<ScanRow['grade'], { bg: string; fg: string }> = {
  A: { bg: 'rgba(5,150,105,0.15)',  fg: '#10B981' },
  B: { bg: 'rgba(13,148,136,0.15)', fg: 'var(--accent)' },
  C: { bg: 'rgba(202,138,4,0.15)',  fg: '#CA8A04' },
  D: { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B' },
  F: { bg: 'rgba(220,38,38,0.18)',  fg: '#DC2626' },
};

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">

            {/* Header */}
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
                <h1 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Dashboard</h1>
                <p className="text-lead" style={{ margin: 0 }}>
                  Manage and monitor your website scans
                </p>
              </div>
              <Link href="/" className="btn-primary">
                New scan
                <IconArrowRight size={16} color="#fff" />
              </Link>
            </header>

            {/* Stats grid */}
            <section
              aria-label="Account summary"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-10)',
              }}
            >
              {STATS.map((s) => (
                <article key={s.label} className="card">
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
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
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{s.trend}</div>
                </article>
              ))}
            </section>

            {/* Recent scans */}
            <section aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="text-h3" style={{ marginBottom: 'var(--space-6)' }}>
                Recent scans
              </h2>

              {/* Desktop table */}
              <div
                className="scans-table-wrap"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--fs-base)',
                  }}
                >
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
                    {SCANS.map((s, i) => {
                      const tone = GRADE_TONE[s.grade];
                      return (
                        <tr key={s.url} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                          <th scope="row" style={{ ...tCellCss, fontWeight: 600, color: 'var(--text)' }}>
                            {s.url}
                          </th>
                          <td style={tCellCss}>
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
                              {s.grade}
                              <span style={{ fontWeight: 500, opacity: 0.85 }}>{s.score}/100</span>
                            </span>
                          </td>
                          <td style={tCellCss}>
                            <IssueChips critical={s.critical} high={s.high} medium={s.medium} />
                          </td>
                          <td style={{ ...tCellCss, color: 'var(--text-tertiary)' }}>{s.whenLabel}</td>
                          <td style={{ ...tCellCss, textAlign: 'right' }}>
                            <Link
                              href={`/report/${s.id}`}
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
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards (shown <720px) */}
              <ul className="scans-cards-mobile" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {SCANS.map((s) => {
                  const tone = GRADE_TONE[s.grade];
                  return (
                    <li key={s.url}>
                      <Link
                        href={`/report/${s.id}`}
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
                          <strong style={{ fontSize: 'var(--fs-md)' }}>{s.url}</strong>
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
                            {s.grade} · {s.score}
                          </span>
                        </div>
                        <IssueChips critical={s.critical} high={s.high} medium={s.medium} />
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{s.whenLabel}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
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
      <Chip n={high}     label="High"     color="#F59E0B" bg="rgba(245,158,11,0.12)" />
      <Chip n={medium}   label="Medium"   color="#CA8A04" bg="rgba(202,138,4,0.10)" />
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
