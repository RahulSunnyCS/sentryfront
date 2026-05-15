import type { Grade } from './dashboard-queries';

export const GRADE_TONE: Record<Grade, { bg: string; fg: string }> = {
  A: { bg: 'rgba(5,150,105,0.15)', fg: '#10B981' },
  B: { bg: 'rgba(13,148,136,0.15)', fg: 'var(--accent)' },
  C: { bg: 'rgba(202,138,4,0.15)', fg: '#CA8A04' },
  D: { bg: 'rgba(245,158,11,0.18)', fg: '#F59E0B' },
  F: { bg: 'rgba(220,38,38,0.18)', fg: '#DC2626' },
};

type FormatTranslator = (key: string, values?: Record<string, unknown>) => string;

export function formatRelative(iso: string | null, locale: string, t: FormatTranslator): string {
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
