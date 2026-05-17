/**
 * Tests for PerformanceSection component — T-07 null/zero-safety contract.
 *
 * Covers:
 *   - score 0 → renders "0" (not treated as missing) and shows grade F copy
 *   - score null → renders 'not measured' state (no NaN, no misleading grade)
 *   - score null → no fetch to the suggestions API (avoids confusing 404)
 *   - normal score (73) → unchanged render path
 *
 * Child components (PerformanceGrade, CoreWebVitals, AIImprovementSuggestions)
 * are mocked to isolate the behaviour under test in PerformanceSection itself.
 * next-intl is mocked because the component runs outside the locale provider
 * in a unit-test environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ── Mock next-intl BEFORE importing the component ──────────────────────────
// The 'report' namespace is the one used by PerformanceSection.
// The translation function returns the key path joined with dots by default,
// which is deterministic and easy to assert on.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

// ── Mock child components ───────────────────────────────────────────────────
// This prevents pulling in their own deps (canvas, Sentry, etc.) and keeps
// the test focused on the PerformanceSection branching logic.
vi.mock('@/components/performance-grade', () => ({
  PerformanceGrade: ({ grade, score }: { grade: string; score: number }) => (
    <div data-testid="performance-grade">
      {grade}/{score}
    </div>
  ),
}));

vi.mock('@/components/core-web-vitals', () => ({
  CoreWebVitals: () => <div data-testid="core-web-vitals" />,
}));

vi.mock('@/components/ai-improvement-suggestions', () => ({
  AIImprovementSuggestions: () => <div data-testid="ai-suggestions" />,
}));

// ── Import component after mocks ────────────────────────────────────────────
import { PerformanceSection } from '@/components/performance-section';

/** Minimal metrics that satisfy the PerformanceData interface */
const METRICS = {
  lcp: 2500,
  fcp: 1800,
  cls: 0.1,
  tbt: 300,
  ttfb: 400,
};

/** Helper: minimal suggestions API response */
function makeSuggestionsResponse() {
  return {
    scanId: 'scan-1',
    targetUrl: 'https://example.com',
    performanceGrade: 'C',
    performanceScore: 73,
    summary: 'Summary',
    quickWins: [],
    majorImprovements: [],
    optimizations: [],
    aiPromptBundle: 'bundle',
    meta: { totalSuggestions: 0, quickWinsCount: 0, majorImprovementsCount: 0, optimizationsCount: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Score 0 — worst-performing site, real score, NOT "no data"
// ---------------------------------------------------------------------------
describe('PerformanceSection — score 0', () => {
  it('renders PerformanceGrade with grade F and score 0 (not treated as missing)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'F',
          performanceScore: 0,
          scoreSource: 'lab',
          performanceMetrics: METRICS,
        }}
      />,
    );

    // PerformanceGrade must be rendered (not the "—" placeholder)
    const gradeEl = await screen.findByTestId('performance-grade');
    expect(gradeEl).toBeInTheDocument();
    // The mock renders "grade/score" — confirms both values passed correctly
    expect(gradeEl.textContent).toBe('F/0');
  });

  it('shows "needs attention" copy for score 0 (falls through <50 branch)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'F',
          performanceScore: 0,
          performanceMetrics: METRICS,
        }}
      />,
    );

    expect(
      await screen.findByText(/Performance needs attention/i),
    ).toBeInTheDocument();
  });

  it('does NOT show the scoreUnavailable i18n message for score 0', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'F',
          performanceScore: 0,
          performanceMetrics: METRICS,
        }}
      />,
    );

    // Wait for loading to complete, then assert absence
    await screen.findByTestId('performance-grade');
    expect(screen.queryByText(/report\.performance\.scoreUnavailable/i)).not.toBeInTheDocument();
  });

  it('fetches suggestions when score is 0 (provider ran)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'F',
          performanceScore: 0,
          performanceMetrics: METRICS,
        }}
      />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/scans/scan-1/performance-suggestions',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Score null — PSI/Lighthouse provider unavailable
// ---------------------------------------------------------------------------
describe('PerformanceSection — score null (provider unavailable)', () => {
  it('renders the i18n scoreUnavailable message (not NaN, not a misleading grade)', () => {
    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: null,
          performanceScore: null,
          scoreSource: 'unavailable',
          performanceMetrics: METRICS,
        }}
      />,
    );

    // The mock useTranslations returns 'report.performance.scoreUnavailable'
    expect(
      screen.getByText('report.performance.scoreUnavailable'),
    ).toBeInTheDocument();
  });

  it('does NOT render PerformanceGrade (avoids NaN and misleading grade display)', () => {
    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: null,
          performanceScore: null,
          performanceMetrics: METRICS,
        }}
      />,
    );

    // The PerformanceGrade mock must not appear — the "—" placeholder is shown instead
    expect(screen.queryByTestId('performance-grade')).not.toBeInTheDocument();
  });

  it('renders the neutral "—" placeholder circle when score is null', () => {
    const { container } = render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: null,
          performanceScore: null,
          performanceMetrics: METRICS,
        }}
      />,
    );

    // The placeholder is a div containing an em-dash
    expect(container.textContent).toContain('—');
  });

  it('does NOT call fetch when score is null (avoids confusing 404 in error state)', () => {
    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: null,
          performanceScore: null,
          performanceMetrics: METRICS,
        }}
      />,
    );

    // fetch must never be called — the scoreUnavailable guard skips the request
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not show NaN anywhere in the rendered output', () => {
    const { container } = render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: null,
          performanceScore: null,
          performanceMetrics: METRICS,
        }}
      />,
    );

    expect(container.textContent).not.toContain('NaN');
  });
});

// ---------------------------------------------------------------------------
// Normal score (73) — unchanged happy path
// ---------------------------------------------------------------------------
describe('PerformanceSection — normal score 73', () => {
  it('renders PerformanceGrade with the correct grade and score', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'C',
          performanceScore: 73,
          performanceMetrics: METRICS,
        }}
      />,
    );

    const gradeEl = await screen.findByTestId('performance-grade');
    expect(gradeEl.textContent).toBe('C/73');
  });

  it('shows "Moderate performance" copy for score 73 (50-74 branch)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'C',
          performanceScore: 73,
          performanceMetrics: METRICS,
        }}
      />,
    );

    expect(
      await screen.findByText(/Moderate performance/i),
    ).toBeInTheDocument();
  });

  it('fetches suggestions for a normal score', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'C',
          performanceScore: 73,
          performanceMetrics: METRICS,
        }}
      />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/scans/scan-1/performance-suggestions',
      );
    });
  });
});
