import { SEVERITY_CONFIG } from '@/lib/data';
import type { ScanSummary, Severity } from '@/types';

const ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function SeveritySummary({ summary }: { summary: ScanSummary }) {
  const total = ORDER.reduce((s, k) => s + (summary[k] || 0), 0);
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {ORDER.map((sev) => {
        const count = summary[sev] || 0;
        if (count === 0) return null;
        const config = SEVERITY_CONFIG[sev];
        return (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: config.color }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{count}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              {sev.toLowerCase()}
            </span>
          </div>
        );
      })}
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 4 }}>{total} total</div>
    </div>
  );
}
