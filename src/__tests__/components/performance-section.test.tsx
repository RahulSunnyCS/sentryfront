/**
 * Tests for PerformanceSection component.
 *
 * Covers (T-07 contract — preserved):
 *   - score 0 → renders "0" (not treated as missing) and shows grade F copy
 *   - score null → renders 'not measured' state (no NaN, no misleading grade)
 *   - score null → no fetch to the suggestions API (avoids confusing 404)
 *   - normal score (73) → unchanged render path
 *
 * Covers (T-09 contract — new):
 *   - field present → verbatim real-user verdict shown via i18n key
 *   - field absent / no verdict → verdict chip absent
 *   - UNAVAILABLE state → scoreUnavailable, no NaN (preserves T-07 tests)
 *   - desktop present → subordinate section with disclaimer, no extra slow banner
 *   - desktop absent → no desktop section rendered
 *   - XSS payloads in CrUX fields → escaped as plain text, not executed as HTML
 *   - old-shape back-compat → no crash, no empty desktop section
 *   - best-practices grade shown when score is available
 *   - cache staleness note shown for real scores
 *   - real-users-slow banner mobile-only (SLOW + real score)
 *   - real-users-slow banner NOT shown for scoreUnavailable
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

// ===========================================================================
// T-09 NEW TESTS
// ===========================================================================

/** Metrics block with CrUX field data (FAST verdict) — named-field shape from lighthouse.ts */
const METRICS_WITH_FIELD_FAST = {
  ...METRICS,
  scoreSource: 'lab' as const,
  fieldDataVerdict: 'FAST',
  fieldData: {
    overallCategory: 'FAST' as const,
    lcp:  { percentile: 1800, category: 'FAST' as const, distributions: [] },
    inp:  null,
    cls:  null,
    fcp:  { percentile: 900,  category: 'FAST' as const, distributions: [] },
    ttfb: null,
  },
  bestPracticesScore: 92,
  bestPracticesGrade: 'A',
};

/** Metrics block with CrUX field data (SLOW verdict) — named-field shape from lighthouse.ts */
const METRICS_WITH_FIELD_SLOW = {
  ...METRICS,
  scoreSource: 'lab' as const,
  fieldDataVerdict: 'SLOW',
  fieldData: {
    overallCategory: 'SLOW' as const,
    lcp:  { percentile: 6000, category: 'SLOW' as const, distributions: [] },
    inp:  null,
    cls:  null,
    fcp:  null,
    ttfb: null,
  },
  bestPracticesScore: 75,
  bestPracticesGrade: 'C',
};

/** Metrics block with no field data (lab-only) */
const METRICS_NO_FIELD = {
  ...METRICS,
  scoreSource: 'lab' as const,
  bestPracticesScore: 85,
  bestPracticesGrade: 'B',
};

/** Desktop sub-object for tests */
const DESKTOP_DATA = {
  score: 88,
  grade: 'B',
  scoreSource: 'lab' as const,
  metrics: { lcp: 1200, fcp: 700, cls: 0.05, tbt: 100, ttfb: 200 },
};

// ---------------------------------------------------------------------------
// T-09: Field data present — verbatim real-user verdict via i18n key
// ---------------------------------------------------------------------------
describe('PerformanceSection — field data present (T-09)', () => {
  it('shows verbatim real-user verdict for FAST via i18n key', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'A',
          performanceScore: 92,
          performanceMetrics: METRICS_WITH_FIELD_FAST,
        }}
      />,
    );

    // Wait for grade render; i18n mock returns 'report.performance.realUserVerdictFast'
    await screen.findByTestId('performance-grade');
    expect(
      screen.getByTestId('real-user-verdict'),
    ).toHaveTextContent('report.performance.realUserVerdictFast');
  });

  it('shows verbatim real-user verdict for SLOW via i18n key', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'D',
          performanceScore: 35,
          performanceMetrics: METRICS_WITH_FIELD_SLOW,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(
      screen.getByTestId('real-user-verdict'),
    ).toHaveTextContent('report.performance.realUserVerdictSlow');
  });

  it('does NOT show the verdict chip when there is no overallCategory', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'B',
          performanceScore: 80,
          performanceMetrics: METRICS_NO_FIELD,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(screen.queryByTestId('real-user-verdict')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-09: Best-practices grade displayed
// ---------------------------------------------------------------------------
describe('PerformanceSection — best practices grade (T-09)', () => {
  it('shows best-practices grade and score when available', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'A',
          performanceScore: 92,
          performanceMetrics: METRICS_WITH_FIELD_FAST,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    const bpEl = screen.getByTestId('best-practices-grade');
    // Should contain 'A' (grade) and '92' (score) from bestPracticesGrade='A', bestPracticesScore=92
    expect(bpEl).toHaveTextContent('A');
    expect(bpEl).toHaveTextContent('92');
  });

  it('shows N/A for best-practices when score is null', async () => {
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
          performanceMetrics: { ...METRICS, bestPracticesScore: null, bestPracticesGrade: 'N/A' },
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(screen.getByTestId('best-practices-grade')).toHaveTextContent('N/A');
  });

  it('does NOT show best-practices section when provider score is unavailable', () => {
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

    expect(screen.queryByTestId('best-practices-grade')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-09: Cache staleness note
// ---------------------------------------------------------------------------
describe('PerformanceSection — cache staleness note (T-09)', () => {
  it('shows cache staleness note for a real score', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'B',
          performanceScore: 80,
          performanceMetrics: METRICS_NO_FIELD,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    // i18n mock returns 'report.performance.cacheStalenessNote'
    expect(screen.getByText('report.performance.cacheStalenessNote')).toBeInTheDocument();
  });

  it('does NOT show cache staleness note when score is unavailable', () => {
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

    expect(screen.queryByText('report.performance.cacheStalenessNote')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-09: Desktop present — subordinate section with disclaimer, no extra slow banner
// ---------------------------------------------------------------------------
describe('PerformanceSection — desktop section present (T-09)', () => {
  it('renders the desktop section with subordinate note when desktop data is present', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'A',
          performanceScore: 92,
          performanceMetrics: {
            ...METRICS_NO_FIELD,
            desktop: DESKTOP_DATA,
          },
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(screen.getByTestId('desktop-section')).toBeInTheDocument();
    // Subordinate disclaimer must appear inside the desktop block
    expect(screen.getByTestId('desktop-subordinate-note')).toHaveTextContent(
      'report.performance.desktopSubordinateNote',
    );
  });

  it('shows the desktop section label', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'A',
          performanceScore: 92,
          performanceMetrics: {
            ...METRICS_NO_FIELD,
            desktop: DESKTOP_DATA,
          },
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    // i18n mock returns 'report.performance.desktopSectionLabel'
    expect(screen.getByText('report.performance.desktopSectionLabel')).toBeInTheDocument();
  });

  it('does NOT add a second real-users-slow banner for the desktop section', async () => {
    // The slow banner is mobile-only — desktop must not produce its own copy.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'D',
          performanceScore: 35,
          performanceMetrics: {
            ...METRICS_WITH_FIELD_SLOW,
            desktop: DESKTOP_DATA,
          },
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    // Mobile SLOW + real score → exactly ONE banner total (never duplicated by desktop)
    const banners = screen.getAllByTestId('real-users-slow-banner');
    expect(banners).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T-09: Desktop absent — no desktop section rendered
// ---------------------------------------------------------------------------
describe('PerformanceSection — desktop section absent (T-09)', () => {
  it('does NOT render the desktop section when desktop data is absent', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'B',
          performanceScore: 80,
          performanceMetrics: METRICS_NO_FIELD,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(screen.queryByTestId('desktop-section')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-09: Real-users-slow banner (mobile + URL-level only)
// ---------------------------------------------------------------------------
describe('PerformanceSection — real-users-slow banner (T-09)', () => {
  it('shows the slow banner when mobile verdict is SLOW and score is real', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'D',
          performanceScore: 35,
          performanceMetrics: METRICS_WITH_FIELD_SLOW,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(screen.getByTestId('real-users-slow-banner')).toBeInTheDocument();
    expect(screen.getByTestId('real-users-slow-banner')).toHaveTextContent(
      'report.performance.realUsersSlowBanner',
    );
  });

  it('does NOT show the slow banner when verdict is FAST', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'A',
          performanceScore: 92,
          performanceMetrics: METRICS_WITH_FIELD_FAST,
        }}
      />,
    );

    await screen.findByTestId('performance-grade');
    expect(screen.queryByTestId('real-users-slow-banner')).not.toBeInTheDocument();
  });

  it('does NOT show the slow banner when score is unavailable (even if SLOW verdict present)', () => {
    // Banner requires !scoreUnavailable — provider down means no reliable lab score
    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: null,
          performanceScore: null,
          performanceMetrics: METRICS_WITH_FIELD_SLOW,
        }}
      />,
    );

    expect(screen.queryByTestId('real-users-slow-banner')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-09: XSS security — CrUX-derived strings are escaped as plain text
// ---------------------------------------------------------------------------
describe('PerformanceSection — XSS payload escaping (T-09)', () => {
  it('renders <script>alert(1)</script> in overallCategory as escaped text, not injected HTML', async () => {
    // An attacker controlling the scanned URL could theoretically influence
    // CrUX data. Feed a malicious string through overallCategory and confirm
    // it is rendered as escaped text — React's JSX escaping applies; no raw HTML.
    const xssPayload = '<script>alert(1)</script>';

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    const { container } = render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'B',
          performanceScore: 80,
          performanceMetrics: {
            ...METRICS_NO_FIELD,
            fieldDataVerdict: xssPayload,
            fieldData: {
              // Cast to feed an adversarial value past the type guard.
              // Named-field shape matches what lighthouse.ts actually produces.
              overallCategory: xssPayload as 'FAST' | 'AVERAGE' | 'SLOW',
              lcp: null, inp: null, cls: null, fcp: null, ttfb: null,
            },
          },
        }}
      />,
    );

    await screen.findByTestId('performance-grade');

    // innerHTML must NOT contain an unescaped <script> element
    expect(container.innerHTML).not.toContain('<script>alert(1)</script>');
    // No script element must be present in the rendered DOM
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  it('renders javascript: payload in bestPracticesGrade as escaped plain text', async () => {
    const jsPayload = 'javascript:alert(1)';

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    const { container } = render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'C',
          performanceScore: 60,
          performanceMetrics: {
            ...METRICS_NO_FIELD,
            bestPracticesGrade: jsPayload,
            bestPracticesScore: 60,
          },
        }}
      />,
    );

    await screen.findByTestId('performance-grade');

    // textContent must contain the (capped) payload as a plain string, not executed code
    const bpEl = screen.getByTestId('best-practices-grade');
    expect(bpEl.textContent).toContain('javascript');
    // Must not appear as an anchor href that could execute
    expect(container.innerHTML).not.toContain('href="javascript:');
    // No script element injected
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-09: Old-shape back-compat — pre-T-06 scan blobs
// ---------------------------------------------------------------------------
describe('PerformanceSection — old-shape back-compat (T-09)', () => {
  it('renders mobile-only view without crash when desktop/scoreSource/fieldData are absent', async () => {
    // Simulates a persisted scan blob from before T-06 — only legacy fields present.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'B',
          performanceScore: 78,
          // Old shape: no scoreSource, no fieldData, no fieldDataVerdict, no desktop,
          // no bestPracticesScore/Grade
          performanceMetrics: { lcp: 2000, fcp: 1200, cls: 0.08, tbt: 250, ttfb: 350 },
        }}
      />,
    );

    // Grade must render correctly
    const gradeEl = await screen.findByTestId('performance-grade');
    expect(gradeEl).toHaveTextContent('B/78');

    // No empty desktop section must appear
    expect(screen.queryByTestId('desktop-section')).not.toBeInTheDocument();
  });

  it('contains no NaN in the output for old-shape data', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => makeSuggestionsResponse(),
    });

    const { container } = render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'B',
          performanceScore: 78,
          performanceMetrics: { lcp: 2000, fcp: 1200, cls: 0.08, tbt: 250, ttfb: 350 },
        }}
      />,
    );
    await screen.findByTestId('performance-grade');
    expect(container.textContent).not.toContain('NaN');
  });

  it('renders without crash when performanceMetrics is null (very old blob)', () => {
    // Some persisted blobs may have performanceMetrics set to null.
    // The component must default to empty metrics instead of crashing.
    const { container } = render(
      <PerformanceSection
        scanId="scan-1"
        performanceData={{
          performanceGrade: 'C',
          performanceScore: 65,
          // Bypass the type system to simulate null coming from the DB
          performanceMetrics: null as unknown as { lcp: null; fcp: null; cls: null; tbt: null; ttfb: null },
        }}
      />,
    );

    // No crash — and no NaN in the output
    expect(container.textContent).not.toContain('NaN');
    expect(screen.queryByTestId('desktop-section')).not.toBeInTheDocument();
  });
});
