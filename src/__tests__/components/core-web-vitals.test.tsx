/**
 * Tests for the CoreWebVitals component — specifically that the per-metric
 * real-user (CrUX) FieldMetricCard elements ACTUALLY RENDER when fieldData
 * uses the named-field shape produced by lighthouse.ts.
 *
 * WHY THIS FILE EXISTS (H1 regression guard):
 *   The H1 finding in the Phase 4 architecture review identified that the
 *   CrUXFieldData type was defined in THREE places with two incompatible
 *   shapes.  The stored shape (from lighthouse.ts) uses NAMED fields
 *   { lcp, inp, cls, fcp, ttfb }.  The old component read
 *   `fieldData?.metrics?.['LARGEST_CONTENTFUL_PAINT_MS']` — a Record-keyed
 *   path that NEVER exists in the stored object — so every FieldMetricCard
 *   was silently suppressed in production.
 *
 *   This test exercises the component with the REAL persisted shape and
 *   asserts the cards render.  Without this test, the bug was invisible:
 *   performance-section.test.tsx mocks CoreWebVitals entirely, so no
 *   component-level assertion ever reached FieldMetricCard.
 *
 * Covered scenarios:
 *   1. Named-field fieldData → per-metric real-user cards render (H1 guard)
 *   2. Null fieldData → "no field data" fallback renders
 *   3. Lab metrics always render regardless of fieldData presence
 *   4. INP card renders only when inp is non-null
 *   5. CrUX category string rendered as safe plain text (capString applied)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next-intl before importing the component.
// Returns "namespace.key" so assertions can be deterministic without loading
// the full i18n catalog.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

import { CoreWebVitals } from '@/components/core-web-vitals';
import type { CrUXFieldData } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures — named-field shape exactly as lighthouse.ts parseCrUXBlock produces
// ---------------------------------------------------------------------------

/**
 * Full CrUX block with LCP + FCP real-user data (FAST).
 * Values deliberately chosen to NOT collide with LAB_METRICS below:
 *   lab LCP = 2500 ms → "2.50"   ≠   field LCP = 1200 ms → "1.20"
 *   lab FCP = 1800 ms → "1.80"   ≠   field FCP = 700 ms  → "0.70"
 */
const FIELD_DATA_FAST: CrUXFieldData = {
  overallCategory: 'FAST',
  // LCP p75 = 1200 ms → formatted as "1.20" s (distinct from lab 2500 ms → "2.50")
  lcp:  { percentile: 1200, category: 'FAST',    distributions: [] },
  // FCP p75 = 700 ms  → formatted as "0.70" s (distinct from lab 1800 ms → "1.80")
  fcp:  { percentile: 700,  category: 'FAST',    distributions: [] },
  // CLS absent for this fixture
  cls:  null,
  // INP absent (not all CrUX blocks include INP)
  inp:  null,
  ttfb: null,
};

/**
 * CrUX block with all per-metric data including INP and a SLOW verdict.
 *
 * Note: the CoreWebVitals component renders FieldMetricCards for LCP, FCP,
 * CLS, and INP only — there is no FieldMetricCard for TTFB in the current
 * component implementation (TTFB is stored in fieldData but not surfaced as
 * a separate card in this version of the UI).
 *
 * Values chosen to be distinct from LAB_METRICS:
 *   lab LCP  = 2500 ms → "2.50"   ≠   field LCP  = 5200 ms → "5.20"
 *   lab FCP  = 1800 ms → "1.80"   ≠   field FCP  = 3100 ms → "3.10"
 *   lab CLS  = 0.1    → "0.100"  ≠   field CLS  = 0.22    → "0.220"
 *   lab TBT  = 300 ms → "300"        (TBT has no field equivalent)
 *   lab TTFB = 400 ms → "400"        (TTFB stored in fieldData; no card rendered)
 */
const FIELD_DATA_FULL: CrUXFieldData = {
  overallCategory: 'SLOW',
  lcp:  { percentile: 5200, category: 'SLOW',    distributions: [] },
  fcp:  { percentile: 3100, category: 'SLOW',    distributions: [] },
  cls:  { percentile: 0.22, category: 'AVERAGE', distributions: [] },
  // INP p75 = 450 ms → formatted as "450" ms
  inp:  { percentile: 450,  category: 'SLOW',    distributions: [] },
  // TTFB stored but no FieldMetricCard renders for it in the current UI
  ttfb: { percentile: 950,  category: 'AVERAGE', distributions: [] },
};

/** Standard lab metrics — always present; real-user section is optional. */
const LAB_METRICS = {
  lcp:  2500,  // ms → "2.50" s
  fcp:  1800,  // ms → "1.80" s
  cls:  0.1,
  tbt:  300,
  ttfb: 400,
};

// ---------------------------------------------------------------------------
// H1 regression guard — FieldMetricCard renders with the NAMED-FIELD shape
// ---------------------------------------------------------------------------

describe('CoreWebVitals — per-metric real-user cards render (H1 guard)', () => {
  it('renders the LCP real-user card when fieldData.lcp is present', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FAST }} />,
    );

    // Field LCP p75 = 1200 ms → "1.20" s (lab LCP = 2500 → "2.50", no collision)
    // The real-user heading must also be present (gated on hasFieldData)
    expect(screen.getByText('report.performance.realUserLabel')).toBeInTheDocument();
    expect(screen.getByText('1.20')).toBeInTheDocument();
  });

  it('renders the FCP real-user card when fieldData.fcp is present', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FAST }} />,
    );

    // Field FCP p75 = 700 ms → "0.70" s (lab FCP = 1800 → "1.80", no collision)
    expect(screen.getByText('0.70')).toBeInTheDocument();
  });

  it('renders all per-metric cards (LCP, FCP, CLS, INP) when all are present', () => {
    // The component renders FieldMetricCards for LCP, FCP, CLS, and INP.
    // TTFB is stored in fieldData but the current UI does not render a card for it.
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FULL }} />,
    );

    // Field LCP p75 = 5200 ms → "5.20" (lab LCP = 2500 → "2.50", distinct)
    expect(screen.getByText('5.20')).toBeInTheDocument();
    // Field FCP p75 = 3100 ms → "3.10" (lab FCP = 1800 → "1.80", distinct)
    expect(screen.getByText('3.10')).toBeInTheDocument();
    // Field CLS p75 = 0.22 → "0.220" (lab CLS = 0.1 → "0.100", distinct)
    expect(screen.getByText('0.220')).toBeInTheDocument();
    // INP p75 = 450 ms → "450" (no lab INP card — no collision possible)
    expect(screen.getByText('450')).toBeInTheDocument();
  });

  it('does NOT render an INP card when fieldData.inp is null', () => {
    // FIELD_DATA_FAST has inp: null — no INP card should appear.
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FAST }} />,
    );

    // The INP metric config description is 'Interaction to Next Paint' — if any
    // INP FieldMetricCard rendered it would show this text.  There is exactly
    // one occurrence of this text (in METRIC_CONFIGS as the card description),
    // but ONLY from a FieldMetricCard; lab MetricCard for INP is never rendered.
    // With inp: null the card must be absent.
    const allText = screen.queryAllByText('Interaction to Next Paint');
    // MetricCard is only rendered for the five named lab keys (lcp/fcp/cls/tbt/ttfb).
    // INP has no lab value, so its description should not appear at all.
    expect(allText).toHaveLength(0);
  });

  it('renders INP card when fieldData.inp is non-null', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FULL }} />,
    );

    // FIELD_DATA_FULL has inp: { percentile: 450 } — the card must render
    // and show the description text.
    expect(screen.getAllByText('Interaction to Next Paint').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('450')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// No-field-data fallback
// ---------------------------------------------------------------------------

describe('CoreWebVitals — no field data fallback', () => {
  it('renders the "no field data" i18n message when fieldData is null', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: null }} />,
    );

    expect(screen.getByText('report.performance.noFieldData')).toBeInTheDocument();
    // The real-user section heading must NOT appear
    expect(screen.queryByText('report.performance.realUserLabel')).not.toBeInTheDocument();
  });

  it('renders the "no field data" message when fieldData is absent (undefined)', () => {
    // fieldData is optional — omitting it is the same as passing null.
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS }} />,
    );

    expect(screen.getByText('report.performance.noFieldData')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Lab metrics always render
// ---------------------------------------------------------------------------

describe('CoreWebVitals — lab metrics', () => {
  it('always renders the lab section heading', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: null }} />,
    );

    expect(screen.getByText('Core Web Vitals')).toBeInTheDocument();
    expect(screen.getByText('report.performance.labScoreLabel')).toBeInTheDocument();
  });

  it('renders lab LCP value regardless of fieldData presence', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FAST }} />,
    );

    // Lab LCP = 2500 ms → "2.50" (MetricCard)
    // Real-user LCP = 1200 ms → "1.20" (FieldMetricCard — distinct value, no collision)
    // Both must be present because they are independent sections.
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('1.20')).toBeInTheDocument();
  });

  it('renders N/A placeholder when a lab metric is null', () => {
    render(
      <CoreWebVitals
        metrics={{ lcp: null, fcp: null, cls: null, tbt: null, ttfb: null, fieldData: null }}
      />,
    );

    // All five lab MetricCards render N/A when value is null
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// CrUX category string safety — capped and rendered as plain text
// ---------------------------------------------------------------------------

describe('CoreWebVitals — CrUX category safety', () => {
  it('renders the FAST category label as plain text in a FieldMetricCard', () => {
    render(
      <CoreWebVitals metrics={{ ...LAB_METRICS, fieldData: FIELD_DATA_FAST }} />,
    );

    // The "FAST" category string should appear at least once (from LCP or FCP card)
    expect(screen.getAllByText('FAST').length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT inject raw HTML for a category string with HTML characters', () => {
    // Feed an adversarial category string — capString caps length and React
    // JSX rendering escapes it.  No <script> should be injected.
    const xssCategory = '<script>alert(1)</script>' as 'FAST' | 'AVERAGE' | 'SLOW';
    const { container } = render(
      <CoreWebVitals
        metrics={{
          ...LAB_METRICS,
          fieldData: {
            overallCategory: 'FAST',
            lcp: { percentile: 1800, category: xssCategory, distributions: [] },
            fcp: null, cls: null, inp: null, ttfb: null,
          },
        }}
      />,
    );

    // No <script> element must be present in the rendered DOM
    expect(container.querySelectorAll('script')).toHaveLength(0);
    // The raw unescaped tag must not appear in innerHTML
    expect(container.innerHTML).not.toContain('<script>alert(1)</script>');
  });
});
