/**
 * Tests for the SEO orchestrator (src/lib/scanner/modules/seo.ts).
 *
 * Strategy: mock runLighthouse (static import in seo.ts), all six P4 sub-modules,
 * and the feature/flag helpers so we can test:
 *   - success path returns SEOResult with correct grade/score
 *   - grade boundaries (A=90+, B=80-89, C=70-79, D=60-69, F<60, F on null)
 *   - crawlResult gating (social/structured only run when crawl is present)
 *   - depth-pass gating (depthFindings only when flag enabled + crawl present)
 *   - error path returns grade F, score 0, empty findings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the logger ───────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Mock runLighthouse (seo.ts uses a static import) ─────────────────────────
vi.mock('@/lib/scanner/lighthouse', () => ({
  runLighthouse: vi.fn(),
}));

// ── Mock all P4 sub-modules ───────────────────────────────────────────────────
vi.mock('@/lib/scanner/modules/p4-01-meta-tags', () => ({
  runMetaTagsModule: vi.fn().mockResolvedValue([]),
  runMetaTagsDepthChecks: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/scanner/modules/p4-02-social-meta', () => ({
  runSocialMetaModule: vi.fn().mockReturnValue([]),
  runSocialMetaDepthChecks: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/scanner/modules/p4-03-structured-data', () => ({
  runStructuredDataModule: vi.fn().mockReturnValue([]),
  runStructuredDataDepthChecks: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/scanner/modules/p4-04-crawlability', () => ({
  runCrawlabilityModule: vi.fn().mockResolvedValue([]),
  runCrawlabilityDepthChecks: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/scanner/modules/p4-05-mobile-seo', () => ({
  runMobileSEOModule: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/scanner/modules/p4-06-ai-discoverability', () => ({
  runAiDiscoverabilityModule: vi.fn().mockResolvedValue([]),
}));

// ── Mock feature flags ────────────────────────────────────────────────────────
vi.mock('@/lib/features', () => ({
  features: { seoDepthPass: true },
}));
vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlag: vi.fn().mockResolvedValue({ enabled: true, value: null }),
}));

// ── Import after mocks are in place ──────────────────────────────────────────
import { runSEOModules } from '@/lib/scanner/modules/seo';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import { runLighthouse } from '@/lib/scanner/lighthouse';
import { runSocialMetaModule } from '@/lib/scanner/modules/p4-02-social-meta';
import { runStructuredDataModule } from '@/lib/scanner/modules/p4-03-structured-data';
import { runMetaTagsDepthChecks } from '@/lib/scanner/modules/p4-01-meta-tags';
import { runCrawlabilityDepthChecks } from '@/lib/scanner/modules/p4-04-crawlability';
import { getFeatureFlag } from '@/lib/feature-flags';

const mockRunLighthouse = runLighthouse as ReturnType<typeof vi.fn>;

function makeMetrics(seoScore: number | null, overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
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
    seoScore,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    ...overrides,
  };
}

// Minimal crawl result for gating tests
const fakeCrawl = {
  finalUrl: 'https://example.com',
  html: '<html><head></head><body></body></html>',
  renderedHtml: '<html><head></head><body></body></html>',
  renderMode: 'headless' as const,
  headers: {},
  cookies: [],
  jsBundleUrls: [],
  inlineScriptContent: '',
  statusCode: 200,
  tls: null,
  stack: '',
} as any;

// ─────────────────────────────────────────────────────────────────────────────

describe('runSEOModules — grade boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns grade A for seoScore >= 0.90', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.95));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('A');
    expect(result.seoScore).toBe(95);
  });

  it('assigns grade B for seoScore 0.80–0.89', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.82));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('B');
    expect(result.seoScore).toBe(82);
  });

  it('assigns grade C for seoScore 0.70–0.79', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.73));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('C');
    expect(result.seoScore).toBe(73);
  });

  it('assigns grade D for seoScore 0.60–0.69', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.60));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('D');
    expect(result.seoScore).toBe(60);
  });

  it('assigns grade F for seoScore < 0.60', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.45));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('F');
    expect(result.seoScore).toBe(45);
  });

  it('assigns grade F and score 0 for null seoScore', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(null));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('F');
    expect(result.seoScore).toBe(0);
  });

  it('assigns grade A at exact boundary 0.90', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.90));
    const result = await runSEOModules('https://example.com');
    expect(result.seoGrade).toBe('A');
  });
});

describe('runSEOModules — result shape', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a SEOResult with findings, metrics, seoGrade, seoScore', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.88));
    const result = await runSEOModules('https://example.com');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('seoGrade');
    expect(result).toHaveProperty('seoScore');
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('returns the metrics object from runLighthouse', async () => {
    const metrics = makeMetrics(0.80);
    mockRunLighthouse.mockResolvedValue(metrics);
    const result = await runSEOModules('https://example.com');
    expect(result.metrics).toBe(metrics);
  });
});

describe('runSEOModules — crawlResult gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT run socialMeta / structuredData when crawlResult is absent', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.80));
    await runSEOModules('https://example.com');
    expect(runSocialMetaModule as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(runStructuredDataModule as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('runs socialMeta and structuredData when crawlResult is present', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.80));
    await runSEOModules('https://example.com', fakeCrawl);
    expect(runSocialMetaModule as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(fakeCrawl);
    expect(runStructuredDataModule as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(fakeCrawl);
  });
});

describe('runSEOModules — depth-pass gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs depth-pass checks when flag is enabled and crawlResult is present', async () => {
    (getFeatureFlag as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true, value: null });
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.80));

    await runSEOModules('https://example.com', fakeCrawl);

    // runMetaTagsDepthChecks is one of the depth-pass steps
    expect(runMetaTagsDepthChecks as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    expect(runCrawlabilityDepthChecks as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it('skips depth-pass when flag is disabled', async () => {
    (getFeatureFlag as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: false, value: null });
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.80));

    await runSEOModules('https://example.com', fakeCrawl);

    expect(runMetaTagsDepthChecks as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('skips depth-pass even when flag is enabled but crawlResult is absent', async () => {
    (getFeatureFlag as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true, value: null });
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.80));

    await runSEOModules('https://example.com');

    expect(runMetaTagsDepthChecks as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});

describe('runSEOModules — findings aggregation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('combines findings from all modules', async () => {
    mockRunLighthouse.mockResolvedValue(makeMetrics(0.70));

    const { runMetaTagsModule } = await import('@/lib/scanner/modules/p4-01-meta-tags');
    const { runCrawlabilityModule } = await import('@/lib/scanner/modules/p4-04-crawlability');
    (runMetaTagsModule as ReturnType<typeof vi.fn>).mockResolvedValue([
      { moduleId: 'P4-01', severity: 'HIGH', title: 'Missing title', category: 'SEO',
        location: '', evidence: '', explanation: '', impact: '', fixManual: [], fixAiPrompt: '' },
    ]);
    (runCrawlabilityModule as ReturnType<typeof vi.fn>).mockResolvedValue([
      { moduleId: 'P4-04', severity: 'MEDIUM', title: 'robots.txt issue', category: 'SEO',
        location: '', evidence: '', explanation: '', impact: '', fixManual: [], fixAiPrompt: '' },
    ]);

    const result = await runSEOModules('https://example.com');

    expect(result.findings.some((f) => f.moduleId === 'P4-01')).toBe(true);
    expect(result.findings.some((f) => f.moduleId === 'P4-04')).toBe(true);
  });
});

describe('runSEOModules — error path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns grade F, score 0, and empty findings when runLighthouse throws', async () => {
    mockRunLighthouse.mockRejectedValue(new Error('API unavailable'));

    const result = await runSEOModules('https://example.com');

    expect(result.seoGrade).toBe('F');
    expect(result.seoScore).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty metrics with null fields on error', async () => {
    mockRunLighthouse.mockRejectedValue(new Error('timeout'));

    const result = await runSEOModules('https://example.com');

    expect(result.metrics.seoScore).toBeNull();
    expect(result.metrics.lcp).toBeNull();
  });
});
