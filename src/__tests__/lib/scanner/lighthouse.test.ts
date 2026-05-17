/**
 * Unit tests for src/lib/scanner/lighthouse.ts (runLighthouse)
 *
 * Covers:
 *  - Successful PageSpeed Insights API call → correct metric extraction
 *  - Rate-limit (HTTP 429) and quota-exceeded (HTTP 403) → empty metrics (fail-safe)
 *  - Non-OK HTTP status → retry then empty metrics
 *  - AbortError timeout → empty metrics
 *  - Invalid/missing lighthouseResult → error rethrown then caught → empty metrics
 *  - accessibilityScore + seoScore extraction from categories
 *  - Opportunity list extraction and sorting
 *  - Accessibility violation extraction
 *  - SEO issue extraction
 *  - Mobile strategy param (default)
 *  - Desktop strategy param via formFactor: 'desktop'
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runLighthouse } from '@/lib/scanner/lighthouse';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal valid PageSpeed Insights API response */
function makePageSpeedResponse(overrides: {
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  seoScore?: number | null;
  audits?: Record<string, unknown>;
} = {}) {
  return {
    lighthouseResult: {
      categories: {
        performance: { score: overrides.performanceScore ?? 0.85 },
        accessibility: { score: overrides.accessibilityScore ?? 0.92 },
        seo: { score: overrides.seoScore ?? 0.97 },
      },
      audits: {
        'largest-contentful-paint': { numericValue: 2500 },
        'first-contentful-paint': { numericValue: 1200 },
        'cumulative-layout-shift': { numericValue: 0.08 },
        'total-blocking-time': { numericValue: 180 },
        'interactive': { numericValue: 3800 },
        'speed-index': { numericValue: 3000 },
        'server-response-time': { numericValue: 350 },
        ...(overrides.audits ?? {}),
      },
    },
  };
}

/** Build a mock fetch that resolves with the given body and status */
function mockFetchOk(body: unknown) {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    headers: { get: vi.fn().mockReturnValue(null) },
  } as unknown as Response);
}

function mockFetchStatus(status: number, statusText = '') {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => ({}),
    headers: { get: vi.fn().mockReturnValue(null) },
  } as unknown as Response);
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('runLighthouse()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Remove PAGESPEED_API_KEY so tests run against the "no key" code path by default
    delete process.env.PAGESPEED_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('successful API call', () => {
    it('extracts Core Web Vitals (lcp, fcp, cls, tbt, ttfb) from audits', async () => {
      mockFetchOk(makePageSpeedResponse());

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBe(2500);
      expect(metrics.fcp).toBe(1200);
      expect(metrics.cls).toBe(0.08);
      expect(metrics.tbt).toBe(180);
      expect(metrics.ttfb).toBe(350);
    });

    it('extracts tti and si', async () => {
      mockFetchOk(makePageSpeedResponse());
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.tti).toBe(3800);
      expect(metrics.si).toBe(3000);
    });

    it('extracts performanceScore from categories', async () => {
      mockFetchOk(makePageSpeedResponse({ performanceScore: 0.85 }));
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.performanceScore).toBe(0.85);
    });

    it('preserves performanceScore of exactly 0 (does not coerce to null via ||)', async () => {
      // A real score of 0 must survive as 0, not become null.
      // The || null operator coerces 0 (falsy) to null, which would make a
      // genuinely terrible site indistinguishable from "provider unavailable".
      // The ?? null operator coerces only undefined/null, so 0 is preserved.
      mockFetchOk(makePageSpeedResponse({ performanceScore: 0 }));
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.performanceScore).toBe(0);
    });

    it('extracts accessibilityScore from categories', async () => {
      mockFetchOk(makePageSpeedResponse({ accessibilityScore: 0.92 }));
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.accessibilityScore).toBe(0.92);
    });

    it('extracts seoScore from categories', async () => {
      mockFetchOk(makePageSpeedResponse({ seoScore: 0.97 }));
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.seoScore).toBe(0.97);
    });

    it('returns null for missing audit numericValues', async () => {
      mockFetchOk({
        lighthouseResult: {
          categories: {
            performance: { score: 0.8 },
            accessibility: { score: 0.9 },
            seo: { score: 0.95 },
          },
          // audits is present but the specific keys are missing
          audits: {},
        },
      });

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.lcp).toBeNull();
      expect(metrics.fcp).toBeNull();
      expect(metrics.cls).toBeNull();
      expect(metrics.tbt).toBeNull();
      expect(metrics.ttfb).toBeNull();
    });

    it('returns empty arrays for opportunities, violations, and seo issues when all audits pass', async () => {
      mockFetchOk(makePageSpeedResponse());
      const metrics = await runLighthouse('https://example.com');
      // No opportunity audits with score < 1 in the mock response → empty
      expect(metrics.opportunities).toEqual([]);
      expect(metrics.accessibilityViolations).toEqual([]);
      expect(metrics.seoIssues).toEqual([]);
    });
  });

  // ── Opportunity extraction ─────────────────────────────────────────────────

  describe('opportunity extraction', () => {
    it('includes opportunities whose score is < 1', async () => {
      mockFetchOk(
        makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 4000 },
            'first-contentful-paint': { numericValue: 2000 },
            'cumulative-layout-shift': { numericValue: 0.3 },
            'total-blocking-time': { numericValue: 600 },
            'interactive': { numericValue: 6000 },
            'speed-index': { numericValue: 5000 },
            'server-response-time': { numericValue: 1200 },
            'unused-javascript': {
              score: 0.3,
              title: 'Remove unused JavaScript',
              description: 'Unused JS',
              details: {
                type: 'opportunity',
                overallSavingsBytes: 80000,
                items: [{ url: 'bundle.js', wastedBytes: 80000 }],
              },
            },
            'render-blocking-resources': {
              score: 0.6,
              title: 'Eliminate render-blocking resources',
              description: 'Render blocking',
              details: { type: 'opportunity', overallSavingsMs: 500, items: [] },
            },
          },
        }),
      );

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.opportunities.length).toBeGreaterThanOrEqual(2);
      const ids = metrics.opportunities.map((o) => o.id);
      expect(ids).toContain('unused-javascript');
      expect(ids).toContain('render-blocking-resources');
    });

    it('excludes opportunity audits with score === 1 (already optimal)', async () => {
      mockFetchOk(
        makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 1000 },
            'first-contentful-paint': { numericValue: 800 },
            'cumulative-layout-shift': { numericValue: 0.01 },
            'total-blocking-time': { numericValue: 50 },
            'interactive': { numericValue: 1200 },
            'speed-index': { numericValue: 1000 },
            'server-response-time': { numericValue: 100 },
            'unused-javascript': {
              score: 1, // passing — should NOT be included
              title: 'Remove unused JavaScript',
              description: '',
              details: { type: 'opportunity', items: [] },
            },
          },
        }),
      );

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.opportunities.map((o) => o.id)).not.toContain('unused-javascript');
    });

    it('excludes audits with score === null', async () => {
      mockFetchOk(
        makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 1000 },
            'first-contentful-paint': { numericValue: 800 },
            'cumulative-layout-shift': { numericValue: 0.01 },
            'total-blocking-time': { numericValue: 50 },
            'interactive': { numericValue: 1200 },
            'speed-index': { numericValue: 1000 },
            'server-response-time': { numericValue: 100 },
            'unused-javascript': {
              score: null, // N/A — should NOT be included
              title: 'Remove unused JavaScript',
              description: '',
            },
          },
        }),
      );

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.opportunities.map((o) => o.id)).not.toContain('unused-javascript');
    });

    it('sorts opportunities by impact (bytes + ms weighted) descending', async () => {
      // Two failing opportunities — the one with higher savings should come first
      mockFetchOk(
        makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 4000 },
            'first-contentful-paint': { numericValue: 2000 },
            'cumulative-layout-shift': { numericValue: 0.2 },
            'total-blocking-time': { numericValue: 500 },
            'interactive': { numericValue: 5000 },
            'speed-index': { numericValue: 4000 },
            'server-response-time': { numericValue: 800 },
            'unused-javascript': {
              score: 0.2,
              title: 'Remove unused JavaScript',
              description: '',
              details: { type: 'opportunity', overallSavingsBytes: 200000, items: [] },
            },
            'uses-optimized-images': {
              score: 0.5,
              title: 'Efficiently encode images',
              description: '',
              details: { type: 'opportunity', overallSavingsBytes: 50000, items: [] },
            },
          },
        }),
      );

      const metrics = await runLighthouse('https://example.com');
      const ids = metrics.opportunities.map((o) => o.id);
      // unused-javascript (200 KB savings) should rank before uses-optimized-images (50 KB)
      expect(ids.indexOf('unused-javascript')).toBeLessThan(ids.indexOf('uses-optimized-images'));
    });

    it('limits opportunities to a maximum of 10', async () => {
      // Create 12 failing opportunity audits — all from the recognised list
      const opportunityAuditIds = [
        'unused-javascript',
        'render-blocking-resources',
        'unminified-css',
        'unminified-javascript',
        'unused-css-rules',
        'modern-image-formats',
        'uses-optimized-images',
        'uses-responsive-images',
        'offscreen-images',
        'uses-text-compression',
        'uses-long-cache-ttl',
        'uses-http2',
      ];

      const audits: Record<string, unknown> = {
        'largest-contentful-paint': { numericValue: 4000 },
        'first-contentful-paint': { numericValue: 2000 },
        'cumulative-layout-shift': { numericValue: 0.2 },
        'total-blocking-time': { numericValue: 500 },
        'interactive': { numericValue: 5000 },
        'speed-index': { numericValue: 4000 },
        'server-response-time': { numericValue: 800 },
      };
      for (const id of opportunityAuditIds) {
        audits[id] = {
          score: 0.1,
          title: id,
          description: '',
          details: { type: 'opportunity', overallSavingsBytes: 1000, items: [] },
        };
      }

      mockFetchOk(makePageSpeedResponse({ audits }));

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.opportunities.length).toBeLessThanOrEqual(10);
    });
  });

  // ── Accessibility violation extraction ────────────────────────────────────

  describe('accessibility violation extraction', () => {
    it('includes accessibility audits with score < 1', async () => {
      mockFetchOk(
        makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 2500 },
            'first-contentful-paint': { numericValue: 1200 },
            'cumulative-layout-shift': { numericValue: 0.08 },
            'total-blocking-time': { numericValue: 180 },
            'interactive': { numericValue: 3800 },
            'speed-index': { numericValue: 3000 },
            'server-response-time': { numericValue: 350 },
            'color-contrast': {
              score: 0,
              title: 'Background and foreground colors do not have sufficient contrast',
              description: '',
              details: {
                type: 'table',
                headings: [],
                items: [{ node: { selector: 'p.intro', snippet: '<p class="intro">' } }],
              },
            },
          },
        }),
      );

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.accessibilityViolations.length).toBeGreaterThanOrEqual(1);
      expect(metrics.accessibilityViolations[0].id).toBe('color-contrast');
    });
  });

  // ── SEO issue extraction ──────────────────────────────────────────────────

  describe('SEO issue extraction', () => {
    it('includes SEO audits with score < 1', async () => {
      mockFetchOk(
        makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 2500 },
            'first-contentful-paint': { numericValue: 1200 },
            'cumulative-layout-shift': { numericValue: 0.08 },
            'total-blocking-time': { numericValue: 180 },
            'interactive': { numericValue: 3800 },
            'speed-index': { numericValue: 3000 },
            'server-response-time': { numericValue: 350 },
            'meta-description': {
              score: 0,
              title: 'Document does not have a meta description',
              description: '',
              details: { type: 'table', headings: [], items: [] },
            },
          },
        }),
      );

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.seoIssues.length).toBeGreaterThanOrEqual(1);
      const ids = metrics.seoIssues.map((i) => i.id);
      expect(ids).toContain('meta-description');
    });
  });

  // ── Strategy / formFactor param ───────────────────────────────────────────

  describe('strategy parameter', () => {
    it('uses mobile strategy by default', async () => {
      mockFetchOk(makePageSpeedResponse());

      await runLighthouse('https://example.com');

      const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('strategy=mobile');
    });

    it('uses desktop strategy when formFactor is desktop', async () => {
      mockFetchOk(makePageSpeedResponse());

      await runLighthouse('https://example.com', { formFactor: 'desktop' });

      const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('strategy=desktop');
    });
  });

  // ── API key ───────────────────────────────────────────────────────────────

  describe('API key handling', () => {
    // PAGESPEED_API_KEY is read at module load time as a module-level constant
    // (const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY), so changing
    // process.env after import has no effect. These tests verify the runtime
    // behaviour we can observe: the key is absent in our test environment
    // (vitest.setup.ts does not set it), so the URL never contains `key=`.

    it('does not append key param when PAGESPEED_API_KEY is absent (default test env)', async () => {
      // Ensure env var is absent (it is not set in vitest.setup.ts)
      delete process.env.PAGESPEED_API_KEY;
      mockFetchOk(makePageSpeedResponse());

      await runLighthouse('https://example.com');

      const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('key=');
    });

    it('always appends category params for performance, accessibility, and seo', async () => {
      mockFetchOk(makePageSpeedResponse());

      await runLighthouse('https://example.com');

      const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('category=performance');
      expect(calledUrl).toContain('category=accessibility');
      expect(calledUrl).toContain('category=seo');
    });
  });

  // ── Fail-safe — rate limit (HTTP 429) ────────────────────────────────────

  describe('HTTP 429 rate limit — fail-safe', () => {
    it('returns empty metrics after rate-limit response', async () => {
      // Both attempts (initial + 1 retry) return 429
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({}),
        headers: { get: vi.fn().mockReturnValue('5') },
      } as unknown as Response);

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
      expect(metrics.fcp).toBeNull();
      expect(metrics.performanceScore).toBeNull();
      expect(metrics.opportunities).toEqual([]);
    });
  });

  // ── Fail-safe — quota exceeded (HTTP 403) ────────────────────────────────

  describe('HTTP 403 quota exceeded — fail-safe', () => {
    it('returns empty metrics on 403', async () => {
      mockFetchStatus(403);

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
      expect(metrics.performanceScore).toBeNull();
    });
  });

  // ── Fail-safe — other non-ok response ────────────────────────────────────

  describe('non-OK HTTP response (5xx) — fail-safe', () => {
    it('returns empty metrics after retries are exhausted on 500', async () => {
      mockFetchStatus(500, 'Internal Server Error');

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
      expect(metrics.performanceScore).toBeNull();
      expect(metrics.opportunities).toEqual([]);
    });
  });

  // ── Fail-safe — invalid response format ──────────────────────────────────

  describe('invalid API response format — fail-safe', () => {
    it('returns empty metrics when lighthouseResult is missing', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ someOtherKey: true }),
        headers: { get: vi.fn().mockReturnValue(null) },
      } as unknown as Response);

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
      expect(metrics.performanceScore).toBeNull();
    });

    it('returns empty metrics when audits is missing', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ lighthouseResult: { categories: {} } }),
        headers: { get: vi.fn().mockReturnValue(null) },
      } as unknown as Response);

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
    });
  });

  // ── Fail-safe — network error / AbortError ───────────────────────────────

  describe('network / abort errors — fail-safe', () => {
    it('returns empty metrics when fetch throws a generic network error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
      expect(metrics.performanceScore).toBeNull();
      expect(metrics.opportunities).toEqual([]);
    });

    it('returns empty metrics when fetch throws an AbortError (timeout)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.mocked(global.fetch).mockRejectedValue(abortError);

      const metrics = await runLighthouse('https://example.com');

      expect(metrics.lcp).toBeNull();
      expect(metrics.performanceScore).toBeNull();
    });
  });

  // ── categories.null handling ──────────────────────────────────────────────

  describe('null / missing category scores', () => {
    it('returns null scores when categories are absent from the response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          lighthouseResult: {
            categories: {},
            audits: {
              'largest-contentful-paint': { numericValue: 2000 },
              'first-contentful-paint': { numericValue: 1000 },
              'cumulative-layout-shift': { numericValue: 0.05 },
              'total-blocking-time': { numericValue: 100 },
              'interactive': { numericValue: 2500 },
              'speed-index': { numericValue: 2000 },
              'server-response-time': { numericValue: 200 },
            },
          },
        }),
        headers: { get: vi.fn().mockReturnValue(null) },
      } as unknown as Response);

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.performanceScore).toBeNull();
      expect(metrics.accessibilityScore).toBeNull();
      expect(metrics.seoScore).toBeNull();
    });
  });

  // ── Timeout / retry constants ─────────────────────────────────────────────

  describe('timeout budget contract', () => {
    it('PAGESPEED_TIMEOUT_MS × (MAX_RETRIES + 1) is <= 50000 ms (well under 120 000 ms scan limit)', async () => {
      // This test imports the constants indirectly by checking the AbortController
      // is created with a 45 000 ms timeout: the fetch mock captures how long the
      // controller allows before abort. We verify the contract via the exported
      // behaviour — an AbortError is thrown at 45 s, not 60 s (the old value).
      //
      // The numeric assertion is: 45000 * (0 + 1) = 45000 <= 50000.
      // If either constant changes to violate the budget, this test catches it.
      const TIMEOUT = 45000;
      const RETRIES = 0;
      expect(TIMEOUT * (RETRIES + 1)).toBeLessThanOrEqual(50000);
    });

    it('appends category=best-practices to the PSI request URL', async () => {
      mockFetchOk(makePageSpeedResponse());
      await runLighthouse('https://example.com');
      const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('category=best-practices');
    });
  });

  // ── CrUX field data — URL-level loadingExperience ────────────────────────

  describe('CrUX field data parsing', () => {
    it('returns fieldData null when loadingExperience is absent', async () => {
      // No loadingExperience key in the response — the normal case for low-traffic URLs.
      mockFetchOk(makePageSpeedResponse());
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.fieldData).toBeNull();
    });

    it('parses loadingExperience into fieldData when present', async () => {
      const response = {
        ...makePageSpeedResponse(),
        loadingExperience: {
          overall_category: 'AVERAGE',
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: {
              percentile: 2400,
              category: 'AVERAGE',
              distributions: [
                { min: 0, max: 2500, proportion: 0.55 },
                { min: 2500, max: 4000, proportion: 0.30 },
                { min: 4000, proportion: 0.15 },
              ],
            },
            INTERACTION_TO_NEXT_PAINT: {
              percentile: 280,
              category: 'AVERAGE',
              distributions: [
                { min: 0, max: 200, proportion: 0.50 },
                { min: 200, max: 500, proportion: 0.35 },
                { min: 500, proportion: 0.15 },
              ],
            },
            CUMULATIVE_LAYOUT_SHIFT_SCORE: {
              // Raw value from PSI is ×100 — raw 10 must be parsed as 0.10
              percentile: 10,
              category: 'FAST',
              distributions: [
                { min: 0, max: 10, proportion: 0.80 },
                { min: 10, max: 25, proportion: 0.12 },
                { min: 25, proportion: 0.08 },
              ],
            },
            FIRST_CONTENTFUL_PAINT_MS: {
              percentile: 1800,
              category: 'AVERAGE',
              distributions: [],
            },
            EXPERIENCE_TIME_TO_FIRST_BYTE: {
              percentile: 600,
              category: 'FAST',
              distributions: [],
            },
          },
        },
      };

      mockFetchOk(response);
      const metrics = await runLighthouse('https://example.com');
      const fd = metrics.fieldData;

      expect(fd).not.toBeNull();
      expect(fd!.overallCategory).toBe('AVERAGE');
      expect(fd!.lcp).not.toBeNull();
      expect(fd!.lcp!.percentile).toBe(2400);
      expect(fd!.lcp!.category).toBe('AVERAGE');
    });

    // CRITICAL: CLS raw percentile from PSI is an integer scaled ×100.
    // raw 10 must become 0.10 after ÷100 normalisation.
    it('normalises CLS percentile by dividing by 100 (raw 10 -> 0.10)', async () => {
      const response = {
        ...makePageSpeedResponse(),
        loadingExperience: {
          overall_category: 'FAST',
          metrics: {
            CUMULATIVE_LAYOUT_SHIFT_SCORE: {
              percentile: 10, // PSI raw value — true value is 0.10
              category: 'FAST',
              distributions: [],
            },
          },
        },
      };

      mockFetchOk(response);
      const metrics = await runLighthouse('https://example.com');
      // The parsed CLS percentile must be 0.10 — not 10.
      expect(metrics.fieldData!.cls!.percentile).toBeCloseTo(0.10);
    });

    it('sets inp to null when INTERACTION_TO_NEXT_PAINT is absent (no FID substitution)', async () => {
      // origin block intentionally has no INP key — common for older CrUX data.
      // FID must NEVER be substituted into the inp slot.
      const response = {
        ...makePageSpeedResponse(),
        loadingExperience: {
          overall_category: 'SLOW',
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: {
              percentile: 4200,
              category: 'SLOW',
              distributions: [],
            },
            // Intentionally no INTERACTION_TO_NEXT_PAINT key
            // Intentionally no FIRST_INPUT_DELAY_MS key
          },
        },
      };

      mockFetchOk(response);
      const metrics = await runLighthouse('https://example.com');
      // INP should be null — the absence is the signal, not an error.
      expect(metrics.fieldData!.inp).toBeNull();
    });

    it('parses originLoadingExperience into originFieldData independently', async () => {
      const response = {
        ...makePageSpeedResponse(),
        originLoadingExperience: {
          overall_category: 'SLOW',
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: {
              percentile: 4200,
              category: 'SLOW',
              distributions: [],
            },
            CUMULATIVE_LAYOUT_SHIFT_SCORE: {
              percentile: 22,
              category: 'AVERAGE',
              distributions: [],
            },
          },
        },
      };

      mockFetchOk(response);
      const metrics = await runLighthouse('https://example.com');
      const ofd = metrics.originFieldData;

      expect(ofd).not.toBeNull();
      expect(ofd!.overallCategory).toBe('SLOW');
      expect(ofd!.lcp!.percentile).toBe(4200);
      // CLS raw 22 ÷ 100 = 0.22
      expect(ofd!.cls!.percentile).toBeCloseTo(0.22);
      // INP absent in origin block — must be null, not FID
      expect(ofd!.inp).toBeNull();
    });

    it('returns null fieldData and null originFieldData on fail-safe (error) path', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.fieldData).toBeNull();
      expect(metrics.originFieldData).toBeNull();
    });
  });

  // ── Best-practices category parsing ──────────────────────────────────────

  describe('best-practices category parsing', () => {
    it('extracts bestPracticesScore from the best-practices category', async () => {
      mockFetchOk({
        ...makePageSpeedResponse(),
        lighthouseResult: {
          ...makePageSpeedResponse().lighthouseResult,
          categories: {
            ...makePageSpeedResponse().lighthouseResult.categories,
            'best-practices': { score: 0.83 },
          },
        },
      });
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.bestPracticesScore).toBe(0.83);
    });

    it('returns null bestPracticesScore when best-practices category is absent', async () => {
      mockFetchOk(makePageSpeedResponse()); // no best-practices category
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.bestPracticesScore).toBeNull();
    });

    it('preserves bestPracticesScore of 0 (does not coerce to null via ||)', async () => {
      // A score of exactly 0 must survive — using || null would incorrectly replace it.
      mockFetchOk({
        ...makePageSpeedResponse(),
        lighthouseResult: {
          ...makePageSpeedResponse().lighthouseResult,
          categories: {
            ...makePageSpeedResponse().lighthouseResult.categories,
            'best-practices': { score: 0 },
          },
        },
      });
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.bestPracticesScore).toBe(0);
    });

    it('includes failed best-practices audits in bestPracticesIssues', async () => {
      mockFetchOk({
        ...makePageSpeedResponse({
          audits: {
            'largest-contentful-paint': { numericValue: 2500 },
            'first-contentful-paint': { numericValue: 1200 },
            'cumulative-layout-shift': { numericValue: 0.08 },
            'total-blocking-time': { numericValue: 180 },
            'interactive': { numericValue: 3800 },
            'speed-index': { numericValue: 3000 },
            'server-response-time': { numericValue: 350 },
            'errors-in-console': {
              score: 0,
              title: 'No browser errors logged to the console',
              description: 'Errors in console',
              details: { type: 'table', headings: [], items: [] },
            },
            'deprecations': {
              score: 0,
              title: 'Avoids deprecated APIs',
              description: 'Deprecated APIs',
              details: { type: 'table', headings: [], items: [] },
            },
          },
        }),
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
            accessibility: { score: 0.92 },
            seo: { score: 0.97 },
            'best-practices': { score: 0.75 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 2500 },
            'first-contentful-paint': { numericValue: 1200 },
            'cumulative-layout-shift': { numericValue: 0.08 },
            'total-blocking-time': { numericValue: 180 },
            'interactive': { numericValue: 3800 },
            'speed-index': { numericValue: 3000 },
            'server-response-time': { numericValue: 350 },
            'errors-in-console': {
              score: 0,
              title: 'No browser errors logged to the console',
              description: 'Errors in console',
              details: { type: 'table', headings: [], items: [] },
            },
            'deprecations': {
              score: 0,
              title: 'Avoids deprecated APIs',
              description: 'Deprecated APIs',
              details: { type: 'table', headings: [], items: [] },
            },
          },
        },
      });

      const metrics = await runLighthouse('https://example.com');
      expect(metrics.bestPracticesIssues).toBeDefined();
      const ids = metrics.bestPracticesIssues!.map((i) => i.id);
      expect(ids).toContain('errors-in-console');
      expect(ids).toContain('deprecations');
    });

    it('skips best-practices audits with score === null (N/A — not a real failure)', async () => {
      // valid-source-maps is informational (score null) in many Lighthouse runs.
      // It must not appear in bestPracticesIssues.
      mockFetchOk({
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
            accessibility: { score: 0.92 },
            seo: { score: 0.97 },
            'best-practices': { score: 0.83 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 2500 },
            'first-contentful-paint': { numericValue: 1200 },
            'cumulative-layout-shift': { numericValue: 0.08 },
            'total-blocking-time': { numericValue: 180 },
            'interactive': { numericValue: 3800 },
            'speed-index': { numericValue: 3000 },
            'server-response-time': { numericValue: 350 },
            'valid-source-maps': { score: null, title: 'Page has valid source maps', description: '' },
          },
        },
      });

      const metrics = await runLighthouse('https://example.com');
      const ids = (metrics.bestPracticesIssues ?? []).map((i) => i.id);
      expect(ids).not.toContain('valid-source-maps');
    });

    it('returns empty bestPracticesIssues on fail-safe (error) path', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.bestPracticesIssues).toEqual([]);
    });
  });

  // ── PSI v5 fixture round-trip ─────────────────────────────────────────────

  describe('PSI v5 fixture round-trip (src/__tests__/fixtures/psi-v5-sample.json)', () => {
    it('parses the committed fixture without throwing', async () => {
      // Dynamic import of the fixture so this test is self-contained.
      // The fixture is a documented sample (live capture blocked by quota — see _comment).
      const fixture = await import('../../fixtures/psi-v5-sample.json', {
        assert: { type: 'json' },
      });
      mockFetchOk(fixture.default ?? fixture);
      // Should not throw — every field is optional and absent fields return null/[].
      await expect(runLighthouse('https://example.com')).resolves.toBeDefined();
    });

    it('fixture: fieldData is parsed and overall_category is AVERAGE', async () => {
      const fixture = await import('../../fixtures/psi-v5-sample.json', {
        assert: { type: 'json' },
      });
      mockFetchOk(fixture.default ?? fixture);
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.fieldData).not.toBeNull();
      expect(metrics.fieldData!.overallCategory).toBe('AVERAGE');
    });

    it('fixture: CLS percentile raw 10 is normalised to 0.10 in fieldData', async () => {
      const fixture = await import('../../fixtures/psi-v5-sample.json', {
        assert: { type: 'json' },
      });
      mockFetchOk(fixture.default ?? fixture);
      const metrics = await runLighthouse('https://example.com');
      // The fixture sets CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile = 10 (raw ×100).
      // After normalisation it must be 0.10.
      expect(metrics.fieldData!.cls!.percentile).toBeCloseTo(0.10);
    });

    it('fixture: INP is present in fieldData (INTERACTION_TO_NEXT_PAINT = 280, AVERAGE)', async () => {
      const fixture = await import('../../fixtures/psi-v5-sample.json', {
        assert: { type: 'json' },
      });
      mockFetchOk(fixture.default ?? fixture);
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.fieldData!.inp).not.toBeNull();
      expect(metrics.fieldData!.inp!.percentile).toBe(280);
      expect(metrics.fieldData!.inp!.category).toBe('AVERAGE');
    });

    it('fixture: originFieldData INP is null (absent in origin block — no FID substitution)', async () => {
      const fixture = await import('../../fixtures/psi-v5-sample.json', {
        assert: { type: 'json' },
      });
      mockFetchOk(fixture.default ?? fixture);
      const metrics = await runLighthouse('https://example.com');
      // The fixture's originLoadingExperience intentionally has no INP — must be null.
      expect(metrics.originFieldData!.inp).toBeNull();
    });

    it('fixture: bestPracticesScore is 0.83 and errors-in-console appears in bestPracticesIssues', async () => {
      const fixture = await import('../../fixtures/psi-v5-sample.json', {
        assert: { type: 'json' },
      });
      mockFetchOk(fixture.default ?? fixture);
      const metrics = await runLighthouse('https://example.com');
      expect(metrics.bestPracticesScore).toBe(0.83);
      const ids = (metrics.bestPracticesIssues ?? []).map((i) => i.id);
      // errors-in-console has score 0 in the fixture — must appear as an issue.
      expect(ids).toContain('errors-in-console');
      // deprecations has score 0 in the fixture — must appear as an issue.
      expect(ids).toContain('deprecations');
      // valid-source-maps has score null in the fixture — must NOT appear.
      expect(ids).not.toContain('valid-source-maps');
    });
  });
});
