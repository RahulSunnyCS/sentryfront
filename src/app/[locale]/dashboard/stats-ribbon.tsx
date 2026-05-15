import type { DashboardStats } from '@/lib/dashboard-queries';

interface Props {
  stats: DashboardStats;
  labels: {
    statScans: string;
    statCritical: string;
    statAvgGrade: string;
    statSites: string;
  };
}

export function StatsRibbon({ stats, labels }: Props) {
  const items = [
    {
      value: stats.totalScans.toString(),
      label: labels.statScans,
      color: 'var(--text)',
    },
    {
      value: stats.criticalIssues.toString(),
      label: labels.statCritical,
      color: stats.criticalIssues > 0 ? '#DC2626' : 'var(--text)',
    },
    {
      value: stats.avgGrade ?? '—',
      label: labels.statAvgGrade,
      color: 'var(--accent)',
    },
    {
      value: stats.monitoredSites.toString(),
      label: labels.statSites,
      color: 'var(--text)',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        flexWrap: 'wrap',
        padding: '12px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-8)',
      }}
    >
      {items.map((item, i) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {i > 0 && (
            <span
              aria-hidden="true"
              style={{ color: 'var(--border)', marginRight: 'var(--space-6)', userSelect: 'none' }}
            >
              ·
            </span>
          )}
          <span style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 800, color: item.color, lineHeight: 1 }}>
            {item.value}
          </span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
