'use client';

import { Link } from '@/i18n/navigation';
import { IconArrowRight } from '@/components/icons';
import type { ScanListItem, SortOption } from '@/lib/dashboard-queries';
import { GRADE_TONE, formatRelative } from '@/lib/scan-format';
import { RescanButton } from './rescan-button';

interface Labels {
  colSite: string;
  colGrade: string;
  colIssues: string;
  colScanned: string;
  colReport: string;
  colActions: string;
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
  sort: SortOption;
  onSort: (s: SortOption) => void;
  locale: string;
  labels: Labels;
}

const tHeadCss: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 'var(--fs-sm)',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tCellCss: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-secondary)',
  textAlign: 'left',
  verticalAlign: 'middle',
};

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortOption;
  current: SortOption;
  onSort: (s: SortOption) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        ...tHeadCss,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        color: active ? 'var(--text)' : 'var(--text-tertiary)',
      }}
    >
      {label}
      <span aria-hidden="true" style={{ fontSize: 10, opacity: active ? 1 : 0.3 }}>
        {active ? '▼' : '▼'}
      </span>
    </button>
  );
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
  );
}

function t(labels: Labels, key: string, values?: Record<string, number>): string {
  const raw = labels[key as keyof Labels] as string | undefined;
  if (!raw) return key;
  if (!values) return raw;
  return raw.replace(/\{(\w+)[^}]*\}/g, (_, k) => String(values[k] ?? ''));
}

export function ScanTable({ items, sort, onSort, locale, labels }: Props) {
  return (
    <div
      className="scans-table-wrap"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
        <caption className="sr-only">{labels.colSite}</caption>
        <thead>
          <tr style={{ background: 'var(--surface-secondary)' }}>
            <th style={tHeadCss} scope="col">{labels.colSite}</th>
            <th style={{ ...tHeadCss }} scope="col">
              <SortHeader label={labels.colGrade} sortKey="grade" current={sort} onSort={onSort} />
            </th>
            <th style={{ ...tHeadCss }} scope="col">
              <SortHeader label={labels.colIssues} sortKey="issues" current={sort} onSort={onSort} />
            </th>
            <th style={{ ...tHeadCss }} scope="col">
              <SortHeader label={labels.colScanned} sortKey="date-desc" current={sort} onSort={onSort} />
            </th>
            <th style={{ ...tHeadCss, textAlign: 'right' }} scope="col">{labels.colReport}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((scan, i) => {
            const tone = scan.grade ? GRADE_TONE[scan.grade] : null;
            const timeLabel = formatRelative(scan.completedAt ?? scan.startedAt, locale, (key, vals) =>
              t(labels, key, vals as Record<string, number> | undefined)
            );
            return (
              <tr key={scan.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                <th scope="row" style={{ ...tCellCss, fontWeight: 600, color: 'var(--text)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {scan.inputType === 'apk' && <span aria-label="Android" title="Android APK" style={{ fontSize: 13 }}>🤖</span>}
                    {scan.inputType === 'ipa' && <span aria-label="iOS" title="iOS IPA" style={{ fontSize: 13 }}>🍎</span>}
                    {scan.targetLabel ?? scan.url}
                  </span>
                </th>
                <td style={tCellCss}>
                  {scan.grade && tone ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
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
                    <span style={{ color: 'var(--text-tertiary)' }}>{scan.status.toLowerCase()}</span>
                  )}
                </td>
                <td style={tCellCss}>
                  <IssueChips
                    critical={scan.critical}
                    high={scan.high}
                    medium={scan.medium}
                    labels={{ critical: labels.critical, high: labels.high, medium: labels.medium }}
                  />
                </td>
                <td style={{ ...tCellCss, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {timeLabel}
                </td>
                <td style={{ ...tCellCss, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    {(!scan.inputType || scan.inputType === 'url') && (
                      <RescanButton
                        url={scan.url}
                        labels={{ rescan: labels.rescan, rescanError: labels.rescanError }}
                      />
                    )}
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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {labels.view}
                      <IconArrowRight size={13} color="var(--accent)" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
