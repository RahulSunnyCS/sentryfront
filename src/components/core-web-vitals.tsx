'use client';

/**
 * CoreWebVitals Component
 * Displays Core Web Vitals metrics with visual indicators
 */

interface CoreWebVitalsProps {
  metrics: {
    lcp: number | null;  // Largest Contentful Paint (ms)
    fcp: number | null;  // First Contentful Paint (ms)
    cls: number | null;  // Cumulative Layout Shift (score)
    tbt: number | null;  // Total Blocking Time (ms)
    ttfb: number | null; // Time To First Byte (ms)
  };
}

interface MetricConfig {
  name: string;
  description: string;
  unit: string;
  format: (value: number) => string;
  good: number;
  needsImprovement: number;
}

const METRIC_CONFIGS: Record<string, MetricConfig> = {
  lcp: {
    name: 'LCP',
    description: 'Largest Contentful Paint',
    unit: 's',
    format: (v) => (v / 1000).toFixed(2),
    good: 2000,
    needsImprovement: 4000,
  },
  fcp: {
    name: 'FCP',
    description: 'First Contentful Paint',
    unit: 's',
    format: (v) => (v / 1000).toFixed(2),
    good: 1500,
    needsImprovement: 3000,
  },
  cls: {
    name: 'CLS',
    description: 'Cumulative Layout Shift',
    unit: '',
    format: (v) => v.toFixed(3),
    good: 0.08,
    needsImprovement: 0.25,
  },
  tbt: {
    name: 'TBT',
    description: 'Total Blocking Time',
    unit: 'ms',
    format: (v) => Math.round(v).toString(),
    good: 200,
    needsImprovement: 600,
  },
  ttfb: {
    name: 'TTFB',
    description: 'Time To First Byte',
    unit: 'ms',
    format: (v) => Math.round(v).toString(),
    good: 600,
    needsImprovement: 1000,
  },
};

function getMetricStatus(value: number, config: MetricConfig): 'good' | 'needs-improvement' | 'poor' {
  if (config.unit === '') {
    // CLS - lower is better, inverted logic
    if (value < config.good) return 'good';
    if (value < config.needsImprovement) return 'needs-improvement';
    return 'poor';
  }
  
  // Time-based metrics - lower is better
  if (value < config.good) return 'good';
  if (value < config.needsImprovement) return 'needs-improvement';
  return 'poor';
}

const STATUS_COLORS = {
  good: { bg: '#10b98133', text: '#10b981', border: '#10b981' },
  'needs-improvement': { bg: '#f59e0b33', text: '#f59e0b', border: '#f59e0b' },
  poor: { bg: '#ef444433', text: '#ef4444', border: '#ef4444' },
};

function MetricCard({ metricKey, value }: { metricKey: string; value: number | null }) {
  const config = METRIC_CONFIGS[metricKey];
  
  if (value === null) {
    return (
      <div style={{
        flex: 1,
        minWidth: 140,
        padding: 16,
        backgroundColor: 'var(--surface-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {config.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          {config.description}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>
          N/A
        </div>
      </div>
    );
  }
  
  const status = getMetricStatus(value, config);
  const colors = STATUS_COLORS[status];
  const formattedValue = config.format(value);
  
  return (
    <div style={{
      flex: 1,
      minWidth: 140,
      padding: 16,
      backgroundColor: colors.bg,
      borderRadius: 12,
      border: `1px solid ${colors.border}44`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {config.name}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {config.description}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>
          {formattedValue}
        </span>
        {config.unit && (
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, opacity: 0.7 }}>
            {config.unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function CoreWebVitals({ metrics }: CoreWebVitalsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        Core Web Vitals
      </h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard metricKey="lcp" value={metrics.lcp} />
        <MetricCard metricKey="fcp" value={metrics.fcp} />
        <MetricCard metricKey="cls" value={metrics.cls} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard metricKey="tbt" value={metrics.tbt} />
        <MetricCard metricKey="ttfb" value={metrics.ttfb} />
      </div>
    </div>
  );
}
