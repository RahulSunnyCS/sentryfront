/**
 * Tests for the Performance orchestrator (src/lib/scanner/modules/performance.ts).
 *
 * Strategy: the orchestrator dynamically imports runLighthouse (`await import('../lighthouse')`)
 * so we must mock the module path that resolves from inside performance.ts.
 * All six P2 sub-modules are also mocked to return controllable findings,
 * letting us test grade / score calculation and error handling in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the six P2 sub-modules ──────────────────────────────────────────────
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

import { runPerformanceModules } from '@/lib/scanner/modules/performance';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import { runLighthouse } from '@/lib/scanner/lighthouse';

const mockRunLighthouse = runLighthouse as ReturnType<typeof vi.fn>;

// Convenience: build a minimal LighthouseMetrics object
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
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('runPerformanceModules — grade calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grade A and score 90+ for a perfect Lighthouse score with no CWV penalties', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.95 }));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('A');
    expect(result.performanceScore).toBe(95);
  });

  it('returns grade B for score 80-89', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.85 }));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('B');
    expect(result.performanceScore).toBe(85);
  });

  it('returns grade C for score 70-79', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.75 }));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('C');
    expect(result.performanceScore).toBe(75);
  });

  it('returns grade D for score 60-69', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.65 }));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('D');
    expect(result.performanceScore).toBe(65);
  });

  it('returns grade F for score below 60', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.50 }));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('F');
    expect(result.performanceScore).toBe(50);
  });
});

describe('runPerformanceModules — LCP penalty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies -0.15 penalty for POOR LCP (>= 4000ms)', async () => {
    // 0.95 - 0.15 = 0.80 → grade B, score 80
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.95, lcp: 4000 }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('B');
    expect(result.performanceScore).toBe(80);
  });

  it('applies -0.05 penalty for NEEDS IMPROVEMENT LCP (2000-3999ms)', async () => {
    // 0.90 - 0.05 = 0.85 → grade B, score 85
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.90, lcp: 2000 }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceGrade).toBe('B');
    expect(result.performanceScore).toBe(85);
  });

  it('applies no LCP penalty when lcp is null', async () => {
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.90, lcp: null }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(90);
    expect(result.performanceGrade).toBe('A');
  });
});

describe('runPerformanceModules — CLS penalty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies -0.10 penalty for POOR CLS (>= 0.25)', async () => {
    // 0.90 - 0.10 = 0.80 → B/80
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.90, cls: 0.25 }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(80);
    expect(result.performanceGrade).toBe('B');
  });

  it('applies -0.03 penalty for NEEDS IMPROVEMENT CLS (0.08-0.24)', async () => {
    // 0.90 - 0.03 = 0.87 → B/87
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.90, cls: 0.08 }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(87);
    expect(result.performanceGrade).toBe('B');
  });

  it('applies no CLS penalty when cls is null', async () => {
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.80, cls: null }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(80);
  });
});

describe('runPerformanceModules — combined penalties clamp to 0', () => {
  beforeEach(() => vi.clearAllMocks());

  it('score never goes below 0 with combined LCP + CLS penalties', async () => {
    // 0.10 - 0.15 (LCP POOR) - 0.10 (CLS POOR) = -0.15 → clamped to 0
    mockRunLighthouse.mockResolvedValue(
      makeMetrics({ performanceScore: 0.10, lcp: 5000, cls: 0.30 }),
    );
    const result = await runPerformanceModules('https://example.com');
    expect(result.performanceScore).toBe(0);
    expect(result.performanceGrade).toBe('F');
  });
});

describe('runPerformanceModules — findings aggregation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns findings from all sub-modules combined', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.75 }));

    const { runCoreWebVitalsModule } = await import(
      '@/lib/scanner/modules/p2-01-core-web-vitals'
    );
    const { runNetworkEfficiencyModule } = await import(
      '@/lib/scanner/modules/p2-03-network-efficiency'
    );
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

  it('includes mobile performance findings when crawlResult is supplied', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.80 }));

    const { runMobilePerformanceModule } = await import(
      '@/lib/scanner/modules/p2-06-mobile-performance'
    );
    (runMobilePerformanceModule as ReturnType<typeof vi.fn>).mockReturnValue([
      { moduleId: 'P2-06', severity: 'LOW', title: 'Mobile issue',
        category: 'Performance', location: '', evidence: '', explanation: '',
        impact: '', fixManual: [], fixAiPrompt: '' },
    ]);

    const fakeCrawl = { finalUrl: 'https://example.com', html: '<html></html>' } as any;
    const result = await runPerformanceModules('https://example.com', fakeCrawl);

    expect(result.findings.some((f) => f.moduleId === 'P2-06')).toBe(true);
  });

  it('skips mobile module when crawlResult is absent', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics({ performanceScore: 0.80 }));

    const { runMobilePerformanceModule } = await import(
      '@/lib/scanner/modules/p2-06-mobile-performance'
    );
    const mobileSpy = runMobilePerformanceModule as ReturnType<typeof vi.fn>;
    mobileSpy.mockReturnValue([]);

    await runPerformanceModules('https://example.com');

    expect(mobileSpy).not.toHaveBeenCalled();
  });
});

describe('runPerformanceModules — error path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns grade F and empty findings when runLighthouse throws', async () => {
    mockRunLighthouse.mockRejectedValue(new Error('Lighthouse timeout'));

    const result = await runPerformanceModules('https://example.com');

    expect(result.performanceGrade).toBe('F');
    expect(result.performanceScore).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty metrics object on failure', async () => {
    mockRunLighthouse.mockRejectedValue(new Error('API error'));

    const result = await runPerformanceModules('https://example.com');

    expect(result.metrics.lcp).toBeNull();
    expect(result.metrics.performanceScore).toBeNull();
  });
});
