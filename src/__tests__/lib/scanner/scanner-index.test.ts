/**
 * Unit tests for src/lib/scanner/index.ts (runScanner)
 *
 * Every external dependency is mocked so this file tests only the orchestration
 * logic: module fan-out, result aggregation, feature-flag branching, and
 * graceful module failure handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawFinding, CrawlResult } from '@/lib/scanner/types';

// ── Crawl ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/scanner/crawler', () => ({
  crawl: vi.fn(),
}));

// ── P1 Security modules ────────────────────────────────────────────────────
vi.mock('@/lib/scanner/modules/p1-01-secrets', () => ({ runSecretsModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-02-sourcemaps', () => ({ runSourcemapsModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-03-headers', () => ({ runHeadersModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-04-tls', () => ({ runTLSModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-05-cookies', () => ({ runCookiesModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-06-sensitive-paths', () => ({ runSensitivePathsModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-07-cors', () => ({ runCorsModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-08-mixed-content', () => ({ runMixedContentModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-09-third-party-scripts', () => ({ runThirdPartyScriptsModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-10-dns-email', () => ({ runDnsEmailModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-11-subdomain-takeover', () => ({ runSubdomainTakeoverModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-12-error-disclosure', () => ({ runErrorDisclosureModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-13-dev-interfaces', () => ({ runDevInterfacesModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-14-robots-sitemap', () => ({ runRobotsSitemapModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-15-cache', () => ({ runCacheModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-16-client-deps', () => ({ runClientDepsModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-17-service-worker', () => ({ runServiceWorkerModule: vi.fn() }));
vi.mock('@/lib/scanner/modules/p1-18-web-manifest', () => ({ runWebManifestModule: vi.fn() }));

// ── Phase orchestrators ────────────────────────────────────────────────────
vi.mock('@/lib/scanner/modules/performance', () => ({
  runPerformanceModules: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/accessibility', () => ({
  runAccessibilityModules: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/seo', () => ({
  runSEOModules: vi.fn(),
}));

// ── Feature flags — mutable object so individual tests can flip flags ─────
const mockFeatures = {
  performanceScanning: true,
  accessibilityScanning: true,
  seoScanning: true,
  exploitIntelSeverity: false,
  pwaSurfaceChecks: false,
  llmEnrichment: true,
  stripe: false,
};

vi.mock('@/lib/features', () => ({
  get features() {
    return mockFeatures;
  },
}));

// ── Logger ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Lazy imports after mocks ───────────────────────────────────────────────
import { runScanner } from '@/lib/scanner/index';
import { crawl } from '@/lib/scanner/crawler';
import { runSecretsModule } from '@/lib/scanner/modules/p1-01-secrets';
import { runSourcemapsModule } from '@/lib/scanner/modules/p1-02-sourcemaps';
import { runHeadersModule } from '@/lib/scanner/modules/p1-03-headers';
import { runTLSModule } from '@/lib/scanner/modules/p1-04-tls';
import { runCookiesModule } from '@/lib/scanner/modules/p1-05-cookies';
import { runSensitivePathsModule } from '@/lib/scanner/modules/p1-06-sensitive-paths';
import { runCorsModule } from '@/lib/scanner/modules/p1-07-cors';
import { runMixedContentModule } from '@/lib/scanner/modules/p1-08-mixed-content';
import { runThirdPartyScriptsModule } from '@/lib/scanner/modules/p1-09-third-party-scripts';
import { runDnsEmailModule } from '@/lib/scanner/modules/p1-10-dns-email';
import { runSubdomainTakeoverModule } from '@/lib/scanner/modules/p1-11-subdomain-takeover';
import { runErrorDisclosureModule } from '@/lib/scanner/modules/p1-12-error-disclosure';
import { runDevInterfacesModule } from '@/lib/scanner/modules/p1-13-dev-interfaces';
import { runRobotsSitemapModule } from '@/lib/scanner/modules/p1-14-robots-sitemap';
import { runCacheModule } from '@/lib/scanner/modules/p1-15-cache';
import { runClientDepsModule } from '@/lib/scanner/modules/p1-16-client-deps';
import { runServiceWorkerModule } from '@/lib/scanner/modules/p1-17-service-worker';
import { runWebManifestModule } from '@/lib/scanner/modules/p1-18-web-manifest';
import { runPerformanceModules } from '@/lib/scanner/modules/performance';
import { runAccessibilityModules } from '@/lib/scanner/modules/accessibility';
import { runSEOModules } from '@/lib/scanner/modules/seo';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid CrawlResult for tests that don't need field details */
function makeCrawlResult(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '<html></html>',
    tls: null,
    stack: 'Next.js',
    ...overrides,
  };
}

function makeRawFinding(moduleId: string, title = 'Test Finding'): RawFinding {
  return {
    moduleId,
    severity: 'HIGH',
    category: 'Test',
    title,
    location: 'https://example.com',
    evidence: 'test evidence',
    explanation: 'test explanation',
    impact: 'test impact',
    fixManual: [],
    fixAiPrompt: 'fix it',
  };
}

/** Reset all module mocks to return empty arrays / standard shapes */
function resetAllModuleMocks() {
  // Group-1 async modules
  vi.mocked(runSecretsModule).mockResolvedValue([]);
  vi.mocked(runSourcemapsModule).mockResolvedValue([]);
  vi.mocked(runSensitivePathsModule).mockResolvedValue([]);
  vi.mocked(runCorsModule).mockResolvedValue([]);
  vi.mocked(runDnsEmailModule).mockResolvedValue([]);
  vi.mocked(runSubdomainTakeoverModule).mockResolvedValue([]);
  vi.mocked(runErrorDisclosureModule).mockResolvedValue([]);
  vi.mocked(runDevInterfacesModule).mockResolvedValue([]);
  vi.mocked(runRobotsSitemapModule).mockResolvedValue([]);
  vi.mocked(runClientDepsModule).mockResolvedValue([]);

  // Group-2 sync modules (runScanner calls them without await)
  vi.mocked(runHeadersModule).mockReturnValue([]);
  vi.mocked(runTLSModule).mockReturnValue([]);
  vi.mocked(runCookiesModule).mockReturnValue([]);
  vi.mocked(runMixedContentModule).mockReturnValue([]);
  vi.mocked(runThirdPartyScriptsModule).mockReturnValue([]);
  vi.mocked(runCacheModule).mockReturnValue([]);
  vi.mocked(runServiceWorkerModule).mockReturnValue([]);
  vi.mocked(runWebManifestModule).mockReturnValue([]);

  // Phase orchestrators
  vi.mocked(runPerformanceModules).mockResolvedValue({
    findings: [],
    metrics: {
      lcp: 1200,
      fcp: 900,
      cls: 0.05,
      tbt: 150,
      tti: 2000,
      si: 1800,
      ttfb: 200,
      performanceScore: 0.92,
      accessibilityScore: 0.88,
      seoScore: 0.95,
      opportunities: [],
      accessibilityViolations: [],
      seoIssues: [],
    },
    performanceGrade: 'A',
    performanceScore: 92,
  });

  vi.mocked(runAccessibilityModules).mockResolvedValue({
    findings: [],
    metrics: {
      lcp: null,
      fcp: null,
      cls: null,
      tbt: null,
      tti: null,
      si: null,
      ttfb: null,
      performanceScore: null,
      accessibilityScore: 0.88,
      seoScore: null,
      opportunities: [],
      accessibilityViolations: [],
      seoIssues: [],
    },
    accessibilityGrade: 'B',
    accessibilityScore: 88,
  });

  vi.mocked(runSEOModules).mockResolvedValue({
    findings: [],
    metrics: {
      lcp: null,
      fcp: null,
      cls: null,
      tbt: null,
      tti: null,
      si: null,
      ttfb: null,
      performanceScore: null,
      accessibilityScore: null,
      seoScore: 0.95,
      opportunities: [],
      accessibilityViolations: [],
      seoIssues: [],
    },
    seoGrade: 'A',
    seoScore: 95,
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('runScanner()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore all feature flags to enabled defaults
    mockFeatures.performanceScanning = true;
    mockFeatures.accessibilityScanning = true;
    mockFeatures.seoScanning = true;

    vi.mocked(crawl).mockResolvedValue(makeCrawlResult());
    resetAllModuleMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('happy path — all modules succeed', () => {
    it('returns a ScannerResult with findings combined from all modules', async () => {
      vi.mocked(runSecretsModule).mockResolvedValue([makeRawFinding('P1-01', 'Secret A')]);
      vi.mocked(runHeadersModule).mockReturnValue([makeRawFinding('P1-03', 'Header B')]);
      vi.mocked(runPerformanceModules).mockResolvedValue({
        findings: [makeRawFinding('P2', 'Slow LCP')],
        metrics: {
          lcp: 4000,
          fcp: 2000,
          cls: 0.2,
          tbt: 500,
          tti: 5000,
          si: 4000,
          ttfb: 800,
          performanceScore: 0.4,
          accessibilityScore: null,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        performanceGrade: 'D',
        performanceScore: 40,
      });

      const result = await runScanner('https://example.com');

      // Security + performance findings should all be present
      expect(result.findings).toHaveLength(3);
      const titles = result.findings.map((f) => f.title);
      expect(titles).toContain('Secret A');
      expect(titles).toContain('Header B');
      expect(titles).toContain('Slow LCP');
    });

    it('returns stack from the crawl result', async () => {
      vi.mocked(crawl).mockResolvedValue(makeCrawlResult({ stack: 'Vue.js' }));
      const result = await runScanner('https://example.com');
      expect(result.stack).toBe('Vue.js');
    });

    it('calls crawl() with the targetUrl', async () => {
      await runScanner('https://target.example.com');
      expect(crawl).toHaveBeenCalledWith('https://target.example.com');
    });
  });

  // ── moduleFindingCounts ───────────────────────────────────────────────────

  describe('moduleFindingCounts', () => {
    it('records count 0 for modules with no findings', async () => {
      const result = await runScanner('https://example.com');
      // All security modules return [] so every P1-* count should be 0
      expect(result.moduleFindingCounts['P1-01']).toBe(0);
      expect(result.moduleFindingCounts['P1-16']).toBe(0);
    });

    it('records correct finding count for a module that returns findings', async () => {
      vi.mocked(runSecretsModule).mockResolvedValue([
        makeRawFinding('P1-01', 'Secret 1'),
        makeRawFinding('P1-01', 'Secret 2'),
      ]);

      const result = await runScanner('https://example.com');
      expect(result.moduleFindingCounts['P1-01']).toBe(2);
    });

    it('records P2-Performance count when performance scan runs', async () => {
      vi.mocked(runPerformanceModules).mockResolvedValue({
        findings: [makeRawFinding('P2', 'Perf Finding')],
        metrics: {
          lcp: 1000,
          fcp: 500,
          cls: 0,
          tbt: 50,
          tti: 1500,
          si: 1200,
          ttfb: 100,
          performanceScore: 0.98,
          accessibilityScore: null,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        performanceGrade: 'A',
        performanceScore: 98,
      });

      const result = await runScanner('https://example.com');
      expect(result.moduleFindingCounts['P2-Performance']).toBe(1);
    });

    it('records P3-Accessibility count when accessibility scan runs', async () => {
      vi.mocked(runAccessibilityModules).mockResolvedValue({
        findings: [makeRawFinding('P3', 'A11y Finding'), makeRawFinding('P3', 'A11y Finding 2')],
        metrics: {
          lcp: null,
          fcp: null,
          cls: null,
          tbt: null,
          tti: null,
          si: null,
          ttfb: null,
          performanceScore: null,
          accessibilityScore: 0.6,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        accessibilityGrade: 'C',
        accessibilityScore: 60,
      });

      const result = await runScanner('https://example.com');
      expect(result.moduleFindingCounts['P3-Accessibility']).toBe(2);
    });

    it('records P4-SEO count when SEO scan runs', async () => {
      vi.mocked(runSEOModules).mockResolvedValue({
        findings: [makeRawFinding('P4', 'SEO Finding')],
        metrics: {
          lcp: null,
          fcp: null,
          cls: null,
          tbt: null,
          tti: null,
          si: null,
          ttfb: null,
          performanceScore: null,
          accessibilityScore: null,
          seoScore: 0.7,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        seoGrade: 'C',
        seoScore: 70,
      });

      const result = await runScanner('https://example.com');
      expect(result.moduleFindingCounts['P4-SEO']).toBe(1);
    });

    it('records all 18 P1 module IDs in moduleFindingCounts', async () => {
      const result = await runScanner('https://example.com');
      const ids = ['P1-01','P1-02','P1-03','P1-04','P1-05','P1-06','P1-07','P1-08',
                   'P1-09','P1-10','P1-11','P1-12','P1-13','P1-14','P1-15','P1-16',
                   'P1-17','P1-18'];
      for (const id of ids) {
        expect(result.moduleFindingCounts).toHaveProperty(id);
      }
    });
  });

  // ── Feature flags ─────────────────────────────────────────────────────────

  describe('feature flag — performanceScanning: false', () => {
    it('does not call runPerformanceModules when feature is disabled', async () => {
      mockFeatures.performanceScanning = false;

      const result = await runScanner('https://example.com');

      expect(runPerformanceModules).not.toHaveBeenCalled();
      // Performance fields should be absent from result
      expect(result.performanceGrade).toBeUndefined();
      expect(result.performanceScore).toBeUndefined();
      expect(result.performanceMetrics).toBeUndefined();
    });

    it('does not include P2-Performance key in moduleFindingCounts', async () => {
      mockFeatures.performanceScanning = false;

      const result = await runScanner('https://example.com');
      expect(result.moduleFindingCounts['P2-Performance']).toBeUndefined();
    });
  });

  describe('feature flag — accessibilityScanning: false', () => {
    it('does not call runAccessibilityModules when feature is disabled', async () => {
      mockFeatures.accessibilityScanning = false;

      const result = await runScanner('https://example.com');

      expect(runAccessibilityModules).not.toHaveBeenCalled();
      expect(result.accessibilityGrade).toBeUndefined();
      expect(result.accessibilityScore).toBeUndefined();
      expect(result.accessibilityMetrics).toBeUndefined();
    });
  });

  describe('feature flag — seoScanning: false', () => {
    it('does not call runSEOModules when feature is disabled', async () => {
      mockFeatures.seoScanning = false;

      const result = await runScanner('https://example.com');

      expect(runSEOModules).not.toHaveBeenCalled();
      expect(result.seoGrade).toBeUndefined();
      expect(result.seoScore).toBeUndefined();
      expect(result.seoMetrics).toBeUndefined();
    });
  });

  describe('all optional scans disabled', () => {
    it('still returns security findings and no optional fields', async () => {
      mockFeatures.performanceScanning = false;
      mockFeatures.accessibilityScanning = false;
      mockFeatures.seoScanning = false;

      vi.mocked(runSecretsModule).mockResolvedValue([makeRawFinding('P1-01', 'Sec A')]);

      const result = await runScanner('https://example.com');

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].title).toBe('Sec A');
      expect(result.performanceGrade).toBeUndefined();
      expect(result.accessibilityGrade).toBeUndefined();
      expect(result.seoGrade).toBeUndefined();
    });
  });

  // ── Optional phase results present when enabled ───────────────────────────

  describe('optional phase results are included in output when enabled', () => {
    it('includes performanceGrade, performanceScore and performanceMetrics when scan succeeds', async () => {
      const result = await runScanner('https://example.com');
      expect(result.performanceGrade).toBe('A');
      expect(result.performanceScore).toBe(92);
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.lcp).toBe(1200);
    });

    it('includes accessibilityGrade, accessibilityScore and accessibilityMetrics', async () => {
      const result = await runScanner('https://example.com');
      expect(result.accessibilityGrade).toBe('B');
      expect(result.accessibilityScore).toBe(88);
      expect(result.accessibilityMetrics).toBeDefined();
    });

    it('includes seoGrade, seoScore and seoMetrics', async () => {
      const result = await runScanner('https://example.com');
      expect(result.seoGrade).toBe('A');
      expect(result.seoScore).toBe(95);
      expect(result.seoMetrics).toBeDefined();
    });
  });

  // ── Module failure isolation ───────────────────────────────────────────────

  describe('graceful failure — optional phases failing do not abort the scan', () => {
    it('continues and omits performance results when runPerformanceModules throws', async () => {
      vi.mocked(runSecretsModule).mockResolvedValue([makeRawFinding('P1-01', 'Sec Finding')]);
      vi.mocked(runPerformanceModules).mockRejectedValue(new Error('Lighthouse crashed'));

      const result = await runScanner('https://example.com');

      // Security findings still present
      expect(result.findings.some((f) => f.title === 'Sec Finding')).toBe(true);
      // Performance section absent
      expect(result.performanceGrade).toBeUndefined();
    });

    it('continues and omits accessibility results when runAccessibilityModules throws', async () => {
      vi.mocked(runAccessibilityModules).mockRejectedValue(new Error('A11y scan exploded'));

      const result = await runScanner('https://example.com');

      expect(result.accessibilityGrade).toBeUndefined();
      // SEO should still run
      expect(result.seoGrade).toBeDefined();
    });

    it('continues and omits SEO results when runSEOModules throws', async () => {
      vi.mocked(runSEOModules).mockRejectedValue(new Error('SEO scan failed'));

      const result = await runScanner('https://example.com');

      expect(result.seoGrade).toBeUndefined();
      // Performance and accessibility should still have results
      expect(result.performanceGrade).toBeDefined();
      expect(result.accessibilityGrade).toBeDefined();
    });
  });

  // ── crawl() failure ───────────────────────────────────────────────────────

  describe('crawl() failure', () => {
    it('propagates the error from crawl() — the scanner does not swallow it', async () => {
      vi.mocked(crawl).mockRejectedValue(new Error('Network timeout'));

      await expect(runScanner('https://example.com')).rejects.toThrow('Network timeout');
    });
  });

  // ── Performance metrics shape ─────────────────────────────────────────────

  describe('performanceMetrics shape', () => {
    it('maps lcp, fcp, cls, tbt, ttfb from the PerformanceResult.metrics object', async () => {
      vi.mocked(runPerformanceModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: 3500,
          fcp: 1800,
          cls: 0.12,
          tbt: 300,
          tti: 4000,
          si: 3200,
          ttfb: 750,
          performanceScore: 0.55,
          accessibilityScore: null,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        performanceGrade: 'D',
        performanceScore: 55,
      });

      const result = await runScanner('https://example.com');
      expect(result.performanceMetrics?.lcp).toBe(3500);
      expect(result.performanceMetrics?.fcp).toBe(1800);
      expect(result.performanceMetrics?.cls).toBe(0.12);
      expect(result.performanceMetrics?.tbt).toBe(300);
      expect(result.performanceMetrics?.ttfb).toBe(750);
    });
  });

  // ── accessibilityMetrics shape ────────────────────────────────────────────

  describe('accessibilityMetrics shape', () => {
    it('exposes violations from accessibilityViolations in the metrics', async () => {
      const mockViolation = { id: 'color-contrast', title: 'Color contrast', description: '', score: 0, type: 'table', items: [] };

      vi.mocked(runAccessibilityModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
          performanceScore: null, accessibilityScore: 0.6, seoScore: null,
          opportunities: [],
          accessibilityViolations: [mockViolation],
          seoIssues: [],
        },
        accessibilityGrade: 'C',
        accessibilityScore: 60,
      });

      const result = await runScanner('https://example.com');
      expect(result.accessibilityMetrics?.violations).toHaveLength(1);
      expect(result.accessibilityMetrics?.violations[0].id).toBe('color-contrast');
    });
  });

  // ── seoMetrics shape ──────────────────────────────────────────────────────

  describe('seoMetrics shape', () => {
    it('exposes issues from seoIssues in the metrics', async () => {
      const mockIssue = { id: 'meta-description', title: 'Missing meta description', description: '', score: 0, type: 'table', items: [] };

      vi.mocked(runSEOModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
          performanceScore: null, accessibilityScore: null, seoScore: 0.7,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [mockIssue],
        },
        seoGrade: 'C',
        seoScore: 70,
      });

      const result = await runScanner('https://example.com');
      expect(result.seoMetrics?.issues).toHaveLength(1);
      expect(result.seoMetrics?.issues[0].id).toBe('meta-description');
    });
  });
});
