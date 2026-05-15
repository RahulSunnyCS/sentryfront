'use client';

import { Link } from '@/i18n/navigation';
import { IconArrowRight } from '@/components/icons';
import type { ScanListItem } from '@/lib/dashboard-queries';
import { GRADE_TONE, formatRelative } from '@/lib/scan-format';
import { RescanButton } from './rescan-button';

interface Labels {
  critical: string;
  high: string;
  medium: string;
  view: string;
  rescan: string;
  rescanError: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  yesterday: string;
  daysAgo: string;
}

interface Props {
  items: ScanListItem[];
  locale: string;
  labels: Labels;
}

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
    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
      {([
        { n: critical, label: labels.critical, color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
        { n: high, label: labels.high, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
        { n: medium, label: labels.medium, color: '#CA8A04', bg: 'rgba(202,138,4,0.10)' },
      ] as const).map(({ n, label, color, bg }) => (
        <span
          key={label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: bg,
            color,
            opacity: n === 0 ? 0.35 : 1,
          }}
        >
          <span style={{ fontWeight: 700 }}>{n}</span>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function tl(labels: Labels, key: string, values?: Record<string, number>): string {
  const raw = labels[key as keyof Labels] as string | undefined;
  if (!raw) return key;
  if (!values) return raw;
  return raw.replace(/\{(\w+)[^}]*\}/g, (_, k) => String(values[k] ?? ''));
}

export function ScanCardList({ items, locale, labels }: Props) {
  return (
    <ul
      className="scans-cards-mobile"
      style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      {items.map((scan) => {
        const tone = scan.grade ? GRADE_TONE[scan.grade] : null;
        const timeLabel = formatRelative(scan.completedAt ?? scan.startedAt, locale, (key, vals) =>
          tl(labels, key, vals as Record<string, number> | undefined)
        );
        return (
          <li key={scan.id}>
            <div
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 'var(--fs-sm)', wordBreak: 'break-all' }}>{scan.url}</strong>
                {scan.grade && tone ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-md)',
                      background: tone.bg,
                      color: tone.fg,
                      fontWeight: 700,
                      fontSize: 'var(--fs-sm)',
                      flexShrink: 0,
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
                labels={{ critical: labels.critical, high: labels.high, medium: labels.medium }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeLabel}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RescanButton url={scan.url} labels={{ rescan: labels.rescan, rescanError: labels.rescanError }} />
                  <Link
                    href={`/report/${scan.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      textDecoration: 'none',
                    }}
                  >
                    {labels.view}
                    <IconArrowRight size={13} color="var(--accent)" />
                  </Link>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
