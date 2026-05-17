'use client';

import { useTranslations } from 'next-intl';
import type { CrUXFieldData } from '@/types';

/**
 * CoreWebVitals Component
 * Displays Core Web Vitals metrics with visual indicators.
 *
 * Distinguishes LAB (Lighthouse simulation) metrics from real-user (CrUX field)
 * data when fieldData is provided. INP is shown from field data where present.
 *
 * SECURITY: all untrusted strings (verdict text, audit descriptions) are
 * rendered as plain React text children — never dangerouslySetInnerHTML.
 * Strings from CrUX data are length-capped at render to limit any adversarial
 * payload from a scanned site's CrUX entry (unlikely path, but guarded).
 */

// Maximum characters to render for any untrusted CrUX-derived string.
// This prevents an extremely long verdict/category string from breaking layout.
const MAX_STRING_LEN = 64;

/**
 * Cap a string at MAX_STRING_LEN chars. Applied to any value that originates
 * from CrUX data (which ultimately comes from the scanned site's URL) to
 * prevent oversized strings from reaching the DOM.
 */
function capString(s: string | undefined | null): string {
  if (!s) return '';
  return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) : s;
}

interface CoreWebVitalsProps {
  metrics: {
    lcp: number | null;  // Largest Contentful Paint (ms)
    fcp: number | null;  // First Contentful Paint (ms)
    cls: number | null;  // Cumulative Layout Shift (score, already normalised)
    tbt: number | null;  // Total Blocking Time (ms)
    ttfb: number | null; // Time To First Byte (ms)
    // CrUX field data for real-user metrics, null when absent
    fieldData?: CrUXFieldData | null;
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
    // Lab value is in ms from Lighthouse; convert to seconds for display
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
    // CLS is already normalised (÷100 done upstream in lighthouse.ts).
    // Display as-is, do NOT divide again here.
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
  // INP is only displayed from CrUX field data — there is no Lighthouse lab value.
  inp: {
    name: 'INP',
    description: 'Interaction to Next Paint',
    unit: 'ms',
    // CrUX p75 for INP is reported in ms directly
    format: (v) => Math.round(v).toString(),
    good: 200,
    needsImprovement: 500,
  },
};

function getMetricStatus(value: number, config: MetricConfig): 'good' | 'needs-improvement' | 'poor' {
  // All metrics: lower is better (CLS has its thresholds set appropriately)
  if (value < config.good) return 'good';
  if (value < config.needsImprovement) return 'needs-improvement';
  return 'poor';
}

const STATUS_COLORS = {
  good: { bg: '#10b98133', text: '#10b981', border: '#10b981', label: 'Good' },
  'needs-improvement': { bg: '#f59e0b33', text: '#f59e0b', border: '#f59e0b', label: 'Needs improvement' },
  poor: { bg: '#ef444433', text: '#ef4444', border: '#ef4444', label: 'Poor' },
};

// Maps CrUX category strings to STATUS_COLORS keys.
// The CrUX API uses 'FAST', 'AVERAGE', 'SLOW' — map them to our local scale.
const CRUX_CATEGORY_MAP: Record<string, keyof typeof STATUS_COLORS> = {
  FAST: 'good',
  AVERAGE: 'needs-improvement',
  SLOW: 'poor',
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

/**
 * FieldMetricCard: shows the CrUX real-user p75 value for a single metric.
 *
 * The percentile value from CrUX is the p75 — 75% of real users experience
 * the metric at or below this value.
 *
 * SECURITY: category string comes from CrUX data (derived from scanned URL).
 * It is capped via capString() and rendered as plain text — not as HTML.
 *
 * CLS note: upstream lighthouse.ts already normalised the CLS p75 value (÷100),
 * so we display it with the same toFixed(3) format as the lab value.
 */
function FieldMetricCard({
  metricKey,
  percentile,
  category,
}: {
  metricKey: string;
  percentile: number;
  category: string | undefined;
}) {
  const config = METRIC_CONFIGS[metricKey];
  if (!config) return null;

  // Map CrUX category ('FAST'/'AVERAGE'/'SLOW') to our colour/status system.
  // If category is missing or unexpected, fall back to threshold-based status.
  const statusKey: keyof typeof STATUS_COLORS =
    category && CRUX_CATEGORY_MAP[category]
      ? CRUX_CATEGORY_MAP[category]
      : getMetricStatus(percentile, config);

  const colors = STATUS_COLORS[statusKey];

  // Format the p75 value the same way we format the lab value
  const formattedValue = config.format(percentile);
  // Cap the category string before rendering — it is user-site-derived data
  const safeCategory = capString(category);

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
      {safeCategory && (
        // Render category as plain text — React's default JSX escaping applies.
        // capString() already limits the length.
        <div style={{ fontSize: 11, color: colors.text, opacity: 0.8, marginTop: 4, fontWeight: 600 }}>
          {safeCategory}
        </div>
      )}
    </div>
  );
}

export function CoreWebVitals({ metrics }: CoreWebVitalsProps) {
  const t = useTranslations('report');

  // CrUX uses 'LARGEST_CONTENTFUL_PAINT_MS', 'FIRST_CONTENTFUL_PAINT_MS',
  // 'CUMULATIVE_LAYOUT_SHIFT_SCORE', 'INTERACTION_TO_NEXT_PAINT',
  // 'EXPERIMENTAL_TIME_TO_FIRST_BYTE' as keys in the metrics record.
  const fieldMetrics = metrics.fieldData?.metrics ?? null;

  // Extract per-metric field data using the CrUX metric key names
  const fieldLcp = fieldMetrics?.['LARGEST_CONTENTFUL_PAINT_MS'];
  const fieldFcp = fieldMetrics?.['FIRST_CONTENTFUL_PAINT_MS'];
  const fieldCls = fieldMetrics?.['CUMULATIVE_LAYOUT_SHIFT_SCORE'];
  const fieldInp = fieldMetrics?.['INTERACTION_TO_NEXT_PAINT'];

  // Check if we have any field data to show at all
  const hasFieldData = Boolean(fieldMetrics && Object.keys(fieldMetrics).length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Lab (Lighthouse simulation) metrics section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Core Web Vitals
        </h3>
        {/* Label the lab section so users understand these are simulated */}
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          background: 'var(--surface-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '2px 8px',
        }}>
          {t('performance.labScoreLabel')}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard metricKey="lcp" value={metrics.lcp} />
        <MetricCard metricKey="fcp" value={metrics.fcp} />
        <MetricCard metricKey="cls" value={metrics.cls} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard metricKey="tbt" value={metrics.tbt} />
        <MetricCard metricKey="ttfb" value={metrics.ttfb} />
      </div>

      {/* Real-user (CrUX field data) section — only rendered when present */}
      {hasFieldData ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {/* This heading uses a static i18n string, not site-derived data */}
              {t('performance.realUserLabel')}
            </h4>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '2px 8px',
            }}>
              p75
            </span>
          </div>
          {/* Field metrics row — only render cards where we have a valid percentile */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {fieldLcp?.percentile != null && (
              <FieldMetricCard
                metricKey="lcp"
                percentile={fieldLcp.percentile}
                category={capString(fieldLcp.category)}
              />
            )}
            {fieldFcp?.percentile != null && (
              <FieldMetricCard
                metricKey="fcp"
                percentile={fieldFcp.percentile}
                category={capString(fieldFcp.category)}
              />
            )}
            {fieldCls?.percentile != null && (
              <FieldMetricCard
                metricKey="cls"
                percentile={fieldCls.percentile}
                category={capString(fieldCls.category)}
              />
            )}
            {/* INP is only available from field data — show it here where present */}
            {fieldInp?.percentile != null && (
              <FieldMetricCard
                metricKey="inp"
                percentile={fieldInp.percentile}
                category={capString(fieldInp.category)}
              />
            )}
          </div>
        </div>
      ) : (
        // No field data: show a clear, non-alarming label
        <div style={{
          marginTop: 4,
          fontSize: 13,
          color: 'var(--text-tertiary)',
          fontStyle: 'italic',
        }}>
          {t('performance.noFieldData')}
        </div>
      )}
    </div>
  );
}
