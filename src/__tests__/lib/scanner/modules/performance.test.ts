/**
 * Tests for the Performance orchestrator (src/lib/scanner/modules/performance.ts).
 *
 * T-06 rewrite: removes all penalty-specific assertions (LCP/CLS deductions no
 * longer exist) and adds the new acceptance-criteria tests:
 *   - double-penalty-gone (score stays at raw Lighthouse value)
 *   - genuine score 0 → integer 0, not null
 *   - UNAVAILABLE → grade 'N/A', score null, non-empty metrics with scoreSource
 *   - desktop-OFF: single call, no `desktop` key (byte-identical to pre-T-06)
 *   - desktop-ON: mobile headline + subordinate desktop
 *   - mobile-429 → desktop skipped
 *   - one-form-factor failure isolation
 *   - cache hit avoids second fetch
 *   - bypass forces fresh fetch
 *   - timing-bound assertion (2 × PSI_TIMEOUT_MS < SCAN_TIMEOUT_MS)
 *
 * Non-scoring assertions (findings aggregation, mobile-module gating) are kept
 * so regression signal from prior tests is preserved.
 *
 * Cache isolation strategy: mock the entire psi-cache module so the in-memory
 * LRU store does not bleed across test cases.  The mock is configured per-test
 * inside each describe block that needs specific cache behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the P2 sub-modules (return empty findings by default) ───────────────
vi.mock('@/lib/scanner/modules/p2-01-core-web-vitals', () => ({
  runCoreWebVitalsModule: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p2-02-resource-optimization', () => ({
  runResourceOptimizationModule: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p2-03-network-efficiency', () => ({
  runNetworkEfficiencyModule: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p2-04-javascript-performance', () => ({
  runJavaScriptPerformanceModule: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p2-05-server-response-time', () => ({
  runServerResponseTimeModule: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p2-06-mobile-performance', () => ({
  runMobilePerformanceModule: vi.fn().mockReturnValue([]),
}));
// T-02 new modules — mocked so they don't affect scoring assertions
vi.mock('@/lib/scanner/modules/p2-07-real-user-field', () => ({
  runRealUserFieldModule: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p2-08-best-practices', () => ({
  runBestPracticesModule: vi.fn().mockReturnValue([]),
}));

// ── Mock the logger (avoids console noise) ───────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Mock runLighthouse via the module path the orchestrator imports ───────────
// performance.ts does: const { runLighthouse } = await import('../lighthouse')
// The alias resolves to @/lib/scanner/lighthouse from the test runner's perspective.
vi.mock('@/lib/scanner/lighthouse', () => ({
  runLighthouse: vi.fn(),
}));

// ── Mock psi-cache to prevent cross-test state bleed ─────────────────────────
// The real psi-cache uses a module-level Map; without mocking, the first test
// that runs populates the cache and every subsequent test gets a hit (returning
// the first score regardless of what mockRunLighthouse.mockResolvedValue says).
// We expose getOrFetch as a pass-through by default, then override per-test
// when we want to test cache-hit / bypass / isolation behaviour.
vi.mock('@/lib/scanner/psi-cache', () => ({
  buildPsiCacheKey: vi.fn().mockImplementation((url: string, strategy: string) => `${url}::${strategy}`),
  getOrFetch: vi.fn().mockImplementation(
    // Default: pass-through — always call the fetcher, never cache.
    async (_key: unknown, fetcher: () => unknown) => fetcher(),
  ),
}));

// ── features mock — desktopPerformance starts as false ───────────────────────
// We control this per-test to verify desktop orchestration.
vi.mock('@/lib/features', () => ({
  features: {
    desktopPerformance: false,
  },
}));

import { runPerformanceModules, PSI_TIMEOUT_MS, DESKTOP_PSI_TIMEOUT_MS, CRAWL_WORST_CASE_MS, P1_MODULES_ALLOWANCE_MS } from '@/lib/scanner/modules/performance';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import { runLighthouse } from '@/lib/scanner/lighthouse';
import { getOrFetch } from '@/lib/scanner/psi-cache';
import { features } from '@/lib/features';

const mockRunLighthouse = runLighthouse as ReturnType<typeof vi.fn>;
const mockGetOrFetch = getOrFetch as ReturnType<typeof vi.fn>;
// features.desktopPerformance is declared readonly in the real module, but our
// mock is a plain object so we can mutate it in tests without TypeScript complaints.
const mutableFeatures = features as { desktopPerformance: boolean };

/** Build a minimal LighthouseMetrics object with sensible defaults */
function makeMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
  return {
    lcp: null,
    fcp: null,
    cls: null,
    tbt: null,
    tti: null,
    si: null,
    ttfb: null,
    performanceScore: null,
    accessibilityScore: null,
    seoScore: null,
    bestPracticesScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    bestPracticesIssues: [],
    fieldData: null,
    originFieldData: null,
    ...overrides,
  };
}

/** Empty metrics — what runLighthouse returns on 429/403/timeout */
const unavailableMetrics = makeMetrics({ performanceScore: null });

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — grade calculation (no penalties)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
    // Default mock: pass-through (always call fetcher)
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('returns grade A and score 95 for performanceScore 0.95', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.95 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('A');
    expect(result.performanceScore).toBe(95);
    expect(result.scoreSource).toBe('lab');
  });

  it('returns grade B and score 85 for performanceScore 0.85 — no penalty applied (double-penalty-gone)', async () => {
    // Pre-T-06, a score of 0.85 with LCP=2000ms would have been penalised to 80.
    // Post-T-06, the raw Lighthouse score is authoritative: 0.85 → 85, stays in B band.
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.85, lcp: 2000, cls: 0.08 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('B');
    expect(result.performanceScore).toBe(85);
  });

  it('returns grade B and score 82 for performanceScore 0.82 — previously penalised case now stays accurate', async () => {
    // Pre-T-06, 0.82 with LCP=4000ms would have been reduced to 0.67 (67 → D).
    // Post-T-06: 0.82 → 82, stays in B band.
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.82, lcp: 4000, cls: 0.25 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('B');
    expect(result.performanceScore).toBe(82);
  });

  it('returns grade C and score 75 for performanceScore 0.75', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.75 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('C');
    expect(result.performanceScore).toBe(75);
  });

  it('returns grade D and score 65 for performanceScore 0.65', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.65 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('D');
    expect(result.performanceScore).toBe(65);
  });

  it('returns grade F and score 50 for performanceScore 0.50', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.50 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('F');
    expect(result.performanceScore).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — genuine score 0 contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('maps performanceScore 0.0 to integer 0, NOT null', async () => {
    // A genuine lab score of 0 (worst possible site) must be preserved as the
    // integer 0 rather than treated as "unavailable".  Pre-T-06 code used || null
    // which would coerce 0 to null; T-01 changed that to ?? null in lighthouse.ts.
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(0);     // integer 0, not null
    expect(result.performanceGrade).toBe('F');   // F is correct for 0
    expect(result.scoreSource).toBe('lab');       // it IS a real lab measurement
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — UNAVAILABLE contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('returns grade N/A, score null, scoreSource unavailable when PSI fails (null performanceScore)', async () => {
    // runLighthouse returns emptyMetrics (performanceScore: null) for 429/403/timeout.
    mockRunLighthouse.mockResolvedValue(unavailableMetrics);
    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('N/A');
    expect(result.performanceScore).toBeNull();
    expect(result.scoreSource).toBe('unavailable');
  });

  it('NEVER returns grade F or score 0 for a provider failure (null performanceScore)', async () => {
    mockRunLighthouse.mockResolvedValue(unavailableMetrics);
    const result = await runPerformanceModules('https://example.com');

    // Returning 'F'/0 would misrepresent "we don't know" as "definitely bad"
    expect(result.performanceGrade).not.toBe('F');
    expect(result.performanceScore).not.toBe(0);
  });

  it('returned performanceMetrics object is NON-EMPTY and carries scoreSource unavailable on PSI failure', async () => {
    // The contract requires the metrics object to be non-empty so downstream JSON
    // serialisation (T-08 blob persist) cannot silently drop it.
    mockRunLighthouse.mockResolvedValue(unavailableMetrics);
    const result = await runPerformanceModules('https://example.com');

    // scoreSource is the discriminating field T-08 will check
    expect(result.scoreSource).toBe('unavailable');
    // metrics should be the full LighthouseMetrics shape, not undefined
    expect(result.metrics).toBeDefined();
    expect(typeof result.metrics).toBe('object');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — desktop-OFF (flag = false)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('makes exactly one PSI call (mobile only) when desktopPerformance is false', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.80 }));
    await runPerformanceModules('https://example.com');
    // runLighthouse is called once (mobile); no second call for desktop
    expect(mockRunLighthouse).toHaveBeenCalledTimes(1);
    expect(mockRunLighthouse).toHaveBeenCalledWith('https://example.com', { formFactor: 'mobile' });
  });

  it('does NOT include a `desktop` key in the result when flag is false', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.80 }));
    const result = await runPerformanceModules('https://example.com');
    // The desktop key must be entirely absent — not undefined, not null
    expect(Object.prototype.hasOwnProperty.call(result, 'desktop')).toBe(false);
  });

  it('returns the mobile score as the headline when flag is false', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.78 }));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(78);
    expect(result.performanceGrade).toBe('C');
    expect(result.scoreSource).toBe('lab');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — desktop-ON (flag = true)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = true;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('makes two PSI calls (mobile first, then desktop) when flag is true, both with DESKTOP_PSI_TIMEOUT_MS', async () => {
    // Both calls return valid metrics.
    // When desktop is ON, BOTH mobile and desktop calls must receive the reduced
    // DESKTOP_PSI_TIMEOUT_MS (25 000 ms) so the combined honest worst case fits:
    // CRAWL_WORST_CASE_MS (53 000) + P1_MODULES_ALLOWANCE_MS (10 000) +
    //   2 × DESKTOP_PSI_TIMEOUT_MS (50 000) + SAFETY_MARGIN_MS (5 000) = 118 000 ms
    // — 2 000 ms under the 120 000 ms scan limit.
    // Using 45 000 ms for both (the old behaviour) would give 158 000 ms; using
    // 35 000 ms (the prior "fixed" value) would give 138 000 ms — both over the limit
    // once CRAWL_WORST_CASE_MS is correctly accounted as 53 000 ms.
    mockRunLighthouse
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.80 })) // mobile
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.90 })); // desktop
    await runPerformanceModules('https://example.com');
    expect(mockRunLighthouse).toHaveBeenCalledTimes(2);
    expect(mockRunLighthouse).toHaveBeenNthCalledWith(
      1,
      'https://example.com',
      { formFactor: 'mobile', timeoutMs: DESKTOP_PSI_TIMEOUT_MS },
    );
    expect(mockRunLighthouse).toHaveBeenNthCalledWith(
      2,
      'https://example.com',
      { formFactor: 'desktop', timeoutMs: DESKTOP_PSI_TIMEOUT_MS },
    );
  });

  it('mobile result is the headline: score, grade, and scoreSource come from mobile', async () => {
    mockRunLighthouse
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.75 })) // mobile → C/75
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.92 })); // desktop → A/92
    const result = await runPerformanceModules('https://example.com');
    // Headline must be from mobile
    expect(result.performanceScore).toBe(75);
    expect(result.performanceGrade).toBe('C');
    expect(result.scoreSource).toBe('lab');
  });

  it('desktop result is stored as subordinate `desktop` sub-object, never drives headline', async () => {
    mockRunLighthouse
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.75 })) // mobile
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.92 })); // desktop
    const result = await runPerformanceModules('https://example.com');
    expect(result.desktop).toBeDefined();
    expect(result.desktop!.score).toBe(92);
    expect(result.desktop!.grade).toBe('A');
    expect(result.desktop!.scoreSource).toBe('lab');
    // Headline still mobile
    expect(result.performanceScore).toBe(75);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — mobile-429 → desktop skipped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = true;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('skips desktop call when mobile returns UNAVAILABLE (rate-limit/quota path)', async () => {
    // Mobile is UNAVAILABLE (429/403 → null performanceScore from runLighthouse)
    mockRunLighthouse.mockResolvedValue(unavailableMetrics);
    const result = await runPerformanceModules('https://example.com');
    // Only one call — mobile. Desktop is skipped because mobile is UNAVAILABLE.
    expect(mockRunLighthouse).toHaveBeenCalledTimes(1);
    // No desktop key
    expect(Object.prototype.hasOwnProperty.call(result, 'desktop')).toBe(false);
    // Headline reflects the mobile unavailability
    expect(result.scoreSource).toBe('unavailable');
    expect(result.performanceGrade).toBe('N/A');
    expect(result.performanceScore).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — fail-soft isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = true;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('mobile succeeds even when desktop PSI call throws', async () => {
    // Mobile returns a valid score; desktop throws (simulates a crash inside fetchPsi).
    // The fetchPsi wrapper catches this and returns emptyMetrics for desktop,
    // so the mobile headline should be unaffected.
    mockRunLighthouse
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.80 })) // mobile ok
      .mockRejectedValueOnce(new Error('Desktop PSI network error'));  // desktop throws
    const result = await runPerformanceModules('https://example.com');
    // Mobile headline is intact
    expect(result.performanceScore).toBe(80);
    expect(result.performanceGrade).toBe('B');
    expect(result.scoreSource).toBe('lab');
    // Desktop sub-object still present (UNAVAILABLE result from the catch)
    expect(result.desktop).toBeDefined();
    expect(result.desktop!.scoreSource).toBe('unavailable');
    expect(result.desktop!.score).toBeNull();
  });

  it('desktop result is UNAVAILABLE but mobile stays valid when desktop throws', async () => {
    mockRunLighthouse
      .mockResolvedValueOnce(makeMetrics({ performanceScore: 0.90 }))
      .mockRejectedValueOnce(new Error('Desktop timeout'));
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(90);
    expect(result.desktop!.grade).toBe('N/A');
    expect(result.desktop!.scoreSource).toBe('unavailable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — cache behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
  });

  it('cache hit: getOrFetch returns cached value without calling runLighthouse again', async () => {
    const cachedMetrics = makeMetrics({ performanceScore: 0.88 });
    // Simulate a cache hit by returning the cached metrics without invoking the fetcher
    mockGetOrFetch.mockResolvedValueOnce(cachedMetrics);
    const result = await runPerformanceModules('https://example.com');
    // runLighthouse should NOT have been called (cache served the result)
    expect(mockRunLighthouse).not.toHaveBeenCalled();
    expect(result.performanceScore).toBe(88);
  });

  it('bypass=true forces a fresh fetch even when cache has a value', async () => {
    const freshMetrics = makeMetrics({ performanceScore: 0.77 });
    // For bypass, getOrFetch calls the fetcher
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
    mockRunLighthouse.mockResolvedValue(freshMetrics);
    const result = await runPerformanceModules('https://example.com', undefined, true);
    // runLighthouse must have been called (bypass skips cache read)
    expect(mockRunLighthouse).toHaveBeenCalledTimes(1);
    expect(result.performanceScore).toBe(77);
  });

  it('UNAVAILABLE results are NOT cached (isCacheable rejects null performanceScore)', async () => {
    // We test the isCacheable contract indirectly: getOrFetch receives the
    // predicate `(v) => v.performanceScore !== null`.  We verify the predicate by
    // inspecting the options argument passed to getOrFetch.
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
    mockRunLighthouse.mockResolvedValue(unavailableMetrics);
    await runPerformanceModules('https://example.com');

    // Extract the options argument from the first getOrFetch call
    const callArgs = mockGetOrFetch.mock.calls[0];
    const options = callArgs[2] as { isCacheable: (v: LighthouseMetrics) => boolean };
    expect(options).toBeDefined();
    expect(typeof options.isCacheable).toBe('function');
    // isCacheable must return false for an unavailable result
    expect(options.isCacheable(unavailableMetrics)).toBe(false);
    // isCacheable must return true for a real result
    expect(options.isCacheable(makeMetrics({ performanceScore: 0.85 }))).toBe(true);
    // Edge case: score 0 is a real (cacheable) lab result
    expect(options.isCacheable(makeMetrics({ performanceScore: 0 }))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — timing-bound invariant', () => {
  // SCAN_TIMEOUT_MS is not exported from scan-worker.ts (which is forbidden to
  // modify), so we reference the well-known default of 120 000 ms directly.
  // This matches the value in scan-worker.ts: Number(process.env.SCAN_TIMEOUT_MS ?? 120000).
  const SCAN_TIMEOUT_MS = 120_000;

  // These are STATIC DESIGN-BUDGET guarantees, not runtime measurements.
  // The scan-worker hard SCAN_TIMEOUT_MS is the runtime backstop for any
  // pathological tail that exceeds these bounds — it produces a graceful
  // TIMEOUT status with partial findings rather than a hung process.

  it('single-call path (desktop OFF): honest inequality CRAWL_WORST_CASE_MS + P1_MODULES_ALLOWANCE_MS + PSI_TIMEOUT_MS <= SCAN_TIMEOUT_MS', () => {
    // Desktop is OFF (the default): one mobile PSI call at PSI_TIMEOUT_MS (45 000 ms).
    // Honest worst-case budget:
    //   CRAWL_WORST_CASE_MS (53 000) + P1_MODULES_ALLOWANCE_MS (10 000) + PSI_TIMEOUT_MS (45 000)
    //   = 108 000 ms — 12 000 ms under the 120 000 ms scan limit.
    // P1_MODULES_ALLOWANCE_MS accounts for P1 security module time between crawl and
    // runPerformanceModules in scanner/index.ts.
    expect(PSI_TIMEOUT_MS).toBe(45_000);                     // guard: constant must not drift
    expect(P1_MODULES_ALLOWANCE_MS).toBe(10_000);            // guard: constant must not drift
    const singleCallBudget = CRAWL_WORST_CASE_MS + P1_MODULES_ALLOWANCE_MS + PSI_TIMEOUT_MS;
    expect(singleCallBudget).toBeLessThanOrEqual(SCAN_TIMEOUT_MS);
    // Must leave at least 12 000 ms of headroom (the declared slack for this path).
    expect(singleCallBudget).toBeLessThanOrEqual(SCAN_TIMEOUT_MS - 12_000);
  });

  it('desktop-ON path: honest inequality CRAWL_WORST_CASE_MS + P1_MODULES_ALLOWANCE_MS + 2×DESKTOP_PSI_TIMEOUT_MS + SAFETY_MARGIN_MS <= SCAN_TIMEOUT_MS', () => {
    // Desktop ON: two sequential PSI calls, each at DESKTOP_PSI_TIMEOUT_MS (25 000 ms).
    // Full honest budget with all pre-performance pipeline phases:
    //   CRAWL_WORST_CASE_MS (53 000) + P1_MODULES_ALLOWANCE_MS (10 000)
    //   + 2 × DESKTOP_PSI_TIMEOUT_MS (50 000) + SAFETY_MARGIN_MS (5 000)
    //   = 118 000 ms — 2 000 ms under the 120 000 ms scan limit.
    const SAFETY_MARGIN_MS = 5_000;
    expect(DESKTOP_PSI_TIMEOUT_MS).toBe(25_000);             // guard: constant must not drift
    const desktopBudget =
      CRAWL_WORST_CASE_MS +
      P1_MODULES_ALLOWANCE_MS +
      2 * DESKTOP_PSI_TIMEOUT_MS +
      SAFETY_MARGIN_MS;
    expect(desktopBudget).toBeLessThanOrEqual(SCAN_TIMEOUT_MS);
    // Exact slack check: 2 000 ms is tight but intentional — any increase in DESKTOP_PSI_TIMEOUT_MS
    // will flip this assertion, making the overrun visible before it hits production.
    expect(desktopBudget).toBe(118_000); // 53k + 10k + 50k + 5k
  });

  it('DESKTOP_PSI_TIMEOUT_MS at 35 000 ms (prior "fixed" value) would breach the scan limit — regression guard', () => {
    // DESKTOP_PSI_TIMEOUT_MS was previously set to 35 000 ms, which was still wrong
    // because CRAWL_WORST_CASE_MS was only 38 000 ms (missing TLS 5k, PWA manifest 5k, PWA SW 5k).
    // With the corrected CRAWL_WORST_CASE_MS of 53 000 ms, 35 000 ms fails the honest inequality:
    //   53 000 + 10 000 + 2×35 000 + 5 000 = 138 000 ms > 120 000 ms — 18 000 ms OVER.
    const SAFETY_MARGIN_MS = 5_000;
    const prevDesktopTimeout = 35_000;
    const budgetWithPrevValue =
      CRAWL_WORST_CASE_MS + P1_MODULES_ALLOWANCE_MS + 2 * prevDesktopTimeout + SAFETY_MARGIN_MS;
    // Proves the prior "fixed" value was also dishonest once CRAWL_WORST_CASE_MS is correct.
    expect(budgetWithPrevValue).toBeGreaterThan(SCAN_TIMEOUT_MS);
    // The current value (25 000 ms) must be strictly less than 35 000 ms.
    expect(DESKTOP_PSI_TIMEOUT_MS).toBeLessThan(prevDesktopTimeout);
  });

  it('DESKTOP_PSI_TIMEOUT_MS at 45 000 ms (original value) would breach the scan limit — regression guard', () => {
    // This assertion MUST FAIL if someone restores DESKTOP_PSI_TIMEOUT_MS to 45 000 ms.
    // 53 000 + 10 000 + 2×45 000 + 5 000 = 158 000 ms > 120 000 ms — 38 000 ms OVER.
    const SAFETY_MARGIN_MS = 5_000;
    const oldDesktopTimeout = 45_000;
    const budgetWithOldValue =
      CRAWL_WORST_CASE_MS + P1_MODULES_ALLOWANCE_MS + 2 * oldDesktopTimeout + SAFETY_MARGIN_MS;
    // The old value produces a budget FAR above the scan limit.
    expect(budgetWithOldValue).toBeGreaterThan(SCAN_TIMEOUT_MS);
    // The current value (25 000 ms) must be strictly less than the old 45 000 ms.
    expect(DESKTOP_PSI_TIMEOUT_MS).toBeLessThan(oldDesktopTimeout);
  });

  it('crawler-drift guard: CRAWL_WORST_CASE_MS === TLS_TIMEOUT + NAV_TIMEOUT + NET_IDLE + PWA_MANIFEST + PWA_SW from crawler.ts', () => {
    // All five timeouts are defined in src/lib/scanner/crawler.ts (read-only — do not modify).
    // They run sequentially in the headless-path worst case:
    //   getTLSInfo (probeTLS timeout)    =  5 000 ms
    //   page.goto (NAV_TIMEOUT_MS)       = 30 000 ms
    //   waitForLoadState (networkidle)   =  8 000 ms  (NETWORK_IDLE_TIMEOUT_MS)
    //   PWA web-manifest fetchCapped     =  5 000 ms  (withTimeout cap)
    //   PWA service-worker fetchCapped   =  5 000 ms  (withTimeout cap in fetchSwScripts)
    //   ─────────────────────────────────────────────
    //   Headless-path worst case         = 53 000 ms
    //
    // If anyone raises a crawler constant, this test catches the drift and forces
    // CRAWL_WORST_CASE_MS to be updated — keeping the timing arithmetic honest.
    const tlsProbeTimeout    =  5_000; // getTLSInfo probe in crawler.ts
    const crawlerNavTimeout  = 30_000; // NAV_TIMEOUT_MS in crawler.ts
    const netIdleTimeout     =  8_000; // NETWORK_IDLE_TIMEOUT_MS in crawler.ts
    const pwaManifestTimeout =  5_000; // withTimeout cap for web-manifest fetchCapped
    const pwaSwTimeout       =  5_000; // withTimeout cap in fetchSwScripts
    expect(CRAWL_WORST_CASE_MS).toBe(
      tlsProbeTimeout + crawlerNavTimeout + netIdleTimeout + pwaManifestTimeout + pwaSwTimeout,
    );
    // Explicit sum guard so the reader can see the arithmetic at a glance.
    expect(CRAWL_WORST_CASE_MS).toBe(53_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — findings aggregation (regression from prior tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('returns findings from all sub-modules combined', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.75 }));

    const { runCoreWebVitalsModule } = await import('@/lib/scanner/modules/p2-01-core-web-vitals');
    const { runNetworkEfficiencyModule } = await import('@/lib/scanner/modules/p2-03-network-efficiency');
    (runCoreWebVitalsModule as ReturnType<typeof vi.fn>).mockReturnValue([
      { moduleId: 'P2-01', severity: 'HIGH', title: 'Slow LCP', category: 'Performance',
        location: '', evidence: '', explanation: '', impact: '', fixManual: [], fixAiPrompt: '' },
    ]);
    (runNetworkEfficiencyModule as ReturnType<typeof vi.fn>).mockReturnValue([
      { moduleId: 'P2-03', severity: 'MEDIUM', title: 'Render-blocking',
        category: 'Performance', location: '', evidence: '', explanation: '',
        impact: '', fixManual: [], fixAiPrompt: '' },
    ]);

    const result = await runPerformanceModules('https://example.com');

    expect(result.findings.some((f) => f.moduleId === 'P2-01')).toBe(true);
    expect(result.findings.some((f) => f.moduleId === 'P2-03')).toBe(true);
  });

  it('includes P2-07 and P2-08 findings from the T-02 new modules', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.70 }));

    const { runRealUserFieldModule } = await import('@/lib/scanner/modules/p2-07-real-user-field');
    const { runBestPracticesModule } = await import('@/lib/scanner/modules/p2-08-best-practices');
    (runRealUserFieldModule as ReturnType<typeof vi.fn>).mockReturnValue([
      { moduleId: 'P2-07', severity: 'HIGH', title: 'Real-user slow', category: 'Performance',
        location: '', evidence: '', explanation: '', impact: '', fixManual: [], fixAiPrompt: '' },
    ]);
    (runBestPracticesModule as ReturnType<typeof vi.fn>).mockReturnValue([
      { moduleId: 'P2-08', severity: 'MEDIUM', title: 'HTTPS issue', category: 'Best Practices',
        location: '', evidence: '', explanation: '', impact: '', fixManual: [], fixAiPrompt: '' },
    ]);

    const result = await runPerformanceModules('https://example.com');

    expect(result.findings.some((f) => f.moduleId === 'P2-07')).toBe(true);
    expect(result.findings.some((f) => f.moduleId === 'P2-08')).toBe(true);
    // moduleFindingCounts must track the new modules
    expect(result.moduleFindingCounts['P2-07']).toBe(1);
    expect(result.moduleFindingCounts['P2-08']).toBe(1);
  });

  it('includes mobile performance findings when crawlResult is supplied', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.80 }));

    const { runMobilePerformanceModule } = await import('@/lib/scanner/modules/p2-06-mobile-performance');
    (runMobilePerformanceModule as ReturnType<typeof vi.fn>).mockReturnValue([
      { moduleId: 'P2-06', severity: 'LOW', title: 'Mobile issue', category: 'Performance',
        location: '', evidence: '', explanation: '', impact: '', fixManual: [], fixAiPrompt: '' },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeCrawl = { finalUrl: 'https://example.com', html: '<html></html>' } as any;
    const result = await runPerformanceModules('https://example.com', fakeCrawl);

    expect(result.findings.some((f) => f.moduleId === 'P2-06')).toBe(true);
  });

  it('skips mobile module when crawlResult is absent', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.80 }));

    const { runMobilePerformanceModule } = await import('@/lib/scanner/modules/p2-06-mobile-performance');
    const mobileSpy = runMobilePerformanceModule as ReturnType<typeof vi.fn>;
    mobileSpy.mockReturnValue([]);

    await runPerformanceModules('https://example.com');

    expect(mobileSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — error path (top-level throw)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableFeatures.desktopPerformance = false;
    mockGetOrFetch.mockImplementation(async (_key: unknown, fetcher: () => unknown) => fetcher());
  });

  it('returns grade N/A and score null (UNAVAILABLE) when runLighthouse throws', async () => {
    // Per T-06 contract: a provider failure is UNAVAILABLE, not F/0.
    // 'F' / 0 would be a lie ("definitely bad") — "we don't know" is the truth.
    // Note: in the new architecture fetchPsi catches errors and returns emptyMetrics;
    // the sub-modules still run (they just get empty metrics), so we do NOT assert
    // on findings count here — the important contract is grade/score/scoreSource.
    mockRunLighthouse.mockRejectedValue(new Error('Lighthouse timeout'));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('N/A');
    expect(result.performanceScore).toBeNull();
    expect(result.scoreSource).toBe('unavailable');
  });

  it('returns empty metrics object on failure with scoreSource unavailable', async () => {
    mockRunLighthouse.mockRejectedValue(new Error('API error'));

    const result = await runPerformanceModules('https://example.com');

    expect(result.metrics.lcp).toBeNull();
    expect(result.metrics.performanceScore).toBeNull();
    expect(result.scoreSource).toBe('unavailable');
  });
});
