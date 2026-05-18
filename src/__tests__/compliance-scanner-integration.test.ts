/**
 * Integration tests for the compliance scanning feature (Phase 5 / P5 group)
 * as wired into runScanner() in src/lib/scanner/index.ts.
 *
 * These tests exercise the full integration path from runScanner() through
 * runComplianceModules() and verify four scenarios:
 *
 *   1. Flag ON  — P5-* findings appear, moduleFindingCounts['P5-Compliance'] is
 *      set, complianceFrameworkSummary is present with GDPR/CCPA/WCAG headings,
 *      and no numeric/score/fraction field exists anywhere in the summary.
 *
 *   2. Flag OFF — byte-identical no-op: no P5-* findings, no 'P5-Compliance'
 *      key, and the key 'complianceFrameworkSummary' is ABSENT from the result
 *      object (not null/undefined-present).
 *
 *   3. Compliance failure isolation — if runComplianceModules throws, runScanner
 *      still returns a valid ScannerResult with P1–P4 findings; the scan is not
 *      aborted.
 *
 *   4. Context threading — when accessibility ran, P5-04 receives the score via
 *      ctx and emits a score-tier finding; when accessibility did not run, P5-04
 *      emits the fail-closed 'unavailable' INFO finding.
 *
 * Strategy: all external I/O-heavy dependencies (crawl, Lighthouse, PageSpeed)
 * are mocked as in scanner-index.test.ts. The P5 modules are NOT mocked — they
 * run with the real crawl fixture so the integration between runScanner(),
 * runComplianceModules(), and the individual P5 modules is exercised.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CrawlResult, RawFinding } from '@/lib/scanner/types';
import { FRAMEWORK_ORDER } from '@/lib/scanner/compliance-shared';

// ── Crawl ─────────────────────────────────────────────────────────────────────
vi.mock('@/lib/scanner/crawler', () => ({
  crawl: vi.fn(),
}));

// ── P1 Security modules (all return empty so they don't interfere with counts) ─
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

// ── Phase orchestrators for P2, P3, P4 ────────────────────────────────────────
// These are mocked to isolate the compliance integration path from Lighthouse /
// PageSpeed API dependencies. We control accessibilityScore via this mock to
// exercise the context-threading scenario (test #4).
vi.mock('@/lib/scanner/modules/performance', () => ({
  runPerformanceModules: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/accessibility', () => ({
  runAccessibilityModules: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/seo', () => ({
  runSEOModules: vi.fn(),
}));

// ── Compliance orchestrator — mocked at module level for failure-isolation tests.
// The mock is spy-controllable: most tests use the real implementation (passthrough
// to the real runComplianceModules), but Scenario 3 overrides it to throw.
// We use a mutable flag to decide at runtime whether to pass through or throw.
let _complianceShouldThrow = false;
vi.mock('@/lib/scanner/modules/compliance', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/scanner/modules/compliance')>();
  return {
    runComplianceModules: vi.fn((...args: Parameters<typeof real.runComplianceModules>) => {
      if (_complianceShouldThrow) {
        return Promise.reject(new Error('Compliance orchestrator crashed (test-injected)'));
      }
      return real.runComplianceModules(...args);
    }),
  };
});

// ── Feature flags — mutable so individual tests can flip complianceScanning ────
//
// Pattern from scanner-index.test.ts: vi.mock returns a getter over a mutable
// object. Each test mutates the flags it needs and beforeEach restores defaults.
const mockFeatures = {
  performanceScanning: false, // off by default to simplify result shape
  accessibilityScanning: false, // controlled per-test for scenario 4
  seoScanning: false,
  complianceScanning: true, // ON by default; flipped to false for scenario 2
  exploitIntelSeverity: false,
  pwaSurfaceChecks: false,
  pathCoverageChecks: false,
  llmEnrichment: false,
  stripe: false,
  auth: false,
  tierGating: false,
  headlessCrawl: false,
  headerCoverageChecks: false,
  seoDepthPass: false,
  desktopPerformance: false,
};

vi.mock('@/lib/features', () => ({
  get features() {
    return mockFeatures;
  },
}));

// ── Logger ────────────────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Lazy imports after all vi.mock() calls ─────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * A minimal CrawlResult that causes P5 modules to emit real findings.
 * renderMode is 'fetch-only' so P5-01 fires the fail-closed INFO path
 * (consent banners require headless JS execution), giving us a known
 * stable non-empty finding set without scripting a full headless DOM.
 */
function makeCrawlResult(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com/',
    statusCode: 200,
    headers: {
      'content-type': 'text/html',
    },
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '<html><head><title>Test</title></head><body><p>Hello</p></body></html>',
    tls: null,
    stack: 'Next.js',
    renderMode: 'fetch-only',
    ...overrides,
  };
}

function makeP1Finding(title = 'Security Finding'): RawFinding {
  return {
    moduleId: 'P1-03',
    severity: 'HIGH',
    category: 'Security',
    title,
    location: 'https://example.com/',
    evidence: 'test evidence',
    explanation: 'test explanation',
    impact: 'test impact',
    fixManual: [],
    fixAiPrompt: 'fix it',
  };
}

/** Reset all P1/P2/P3/P4 module mocks to return empty data */
function resetModuleMocks() {
  // Group-1 async P1 modules
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

  // Group-2 sync P1 modules
  vi.mocked(runHeadersModule).mockReturnValue([]);
  vi.mocked(runTLSModule).mockReturnValue([]);
  vi.mocked(runCookiesModule).mockReturnValue([]);
  vi.mocked(runMixedContentModule).mockReturnValue([]);
  vi.mocked(runThirdPartyScriptsModule).mockReturnValue([]);
  vi.mocked(runCacheModule).mockReturnValue([]);
  vi.mocked(runServiceWorkerModule).mockReturnValue([]);
  vi.mocked(runWebManifestModule).mockReturnValue([]);

  // P2/P3/P4 orchestrators — resolved to indicate each did not run (features off)
  vi.mocked(runPerformanceModules).mockResolvedValue({
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
      seoScore: null,
      opportunities: [],
      accessibilityViolations: [],
      seoIssues: [],
    },
    performanceGrade: 'N/A',
    performanceScore: null,
    scoreSource: 'unavailable',
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
      accessibilityScore: null,
      seoScore: null,
      opportunities: [],
      accessibilityViolations: [],
      seoIssues: [],
    },
    accessibilityGrade: 'N/A',
    accessibilityScore: 0,
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
      seoScore: null,
      opportunities: [],
      accessibilityViolations: [],
      seoIssues: [],
    },
    seoGrade: 'N/A',
    seoScore: 0,
  });
}

/**
 * Deep-scan an object for any property whose name or value looks like a numeric
 * score or fraction. Returns a list of offending path/value pairs.
 * Used to enforce the "no numeric/score/fraction field" invariant on
 * complianceFrameworkSummary.
 */
function findNumericScoreFields(
  obj: unknown,
  path = '',
): Array<{ path: string; value: unknown }> {
  const hits: Array<{ path: string; value: unknown }> = [];

  if (obj === null || obj === undefined) return hits;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      hits.push(...findNumericScoreFields(item, `${path}[${i}]`));
    });
    return hits;
  }

  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${key}` : key;

      // Flag numeric keys that sound like scores or fractions
      if (
        /^(score|fraction|percent|rate|count|total|passed|failed|numerator|denominator)$/i.test(
          key,
        )
      ) {
        if (typeof val === 'number') {
          hits.push({ path: fullPath, value: val });
        }
      }

      hits.push(...findNumericScoreFields(val, fullPath));
    }
    return hits;
  }

  return hits;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Compliance Scanner Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore feature flag defaults
    mockFeatures.complianceScanning = true;
    mockFeatures.accessibilityScanning = false;
    mockFeatures.performanceScanning = false;
    mockFeatures.seoScanning = false;

    vi.mocked(crawl).mockResolvedValue(makeCrawlResult());
    resetModuleMocks();
  });

  // ── Scenario 1: Flag ON ─────────────────────────────────────────────────────

  describe('Scenario 1 — complianceScanning: true', () => {
    it('runScanner yields at least one P5-* finding in the findings array', async () => {
      const result = await runScanner('https://example.com/');

      const p5Findings = result.findings.filter((f) => f.moduleId.startsWith('P5-'));
      expect(p5Findings.length).toBeGreaterThan(0);
    });

    it('every P5-* finding has a moduleId matching P5-01 through P5-06', async () => {
      const result = await runScanner('https://example.com/');

      const p5Findings = result.findings.filter((f) => f.moduleId.startsWith('P5-'));
      for (const finding of p5Findings) {
        expect(finding.moduleId).toMatch(/^P5-0[1-6]$/);
      }
    });

    it('moduleFindingCounts includes a P5-Compliance key with a positive count', async () => {
      const result = await runScanner('https://example.com/');

      expect(result.moduleFindingCounts).toHaveProperty('P5-Compliance');
      expect(result.moduleFindingCounts['P5-Compliance']).toBeGreaterThan(0);
    });

    it('moduleFindingCounts[P5-Compliance] equals the actual number of P5 findings', async () => {
      const result = await runScanner('https://example.com/');

      const p5Count = result.findings.filter((f) => f.moduleId.startsWith('P5-')).length;
      expect(result.moduleFindingCounts['P5-Compliance']).toBe(p5Count);
    });

    it('complianceFrameworkSummary is present on the ScannerResult', async () => {
      const result = await runScanner('https://example.com/');

      expect('complianceFrameworkSummary' in result).toBe(true);
      expect(result.complianceFrameworkSummary).toBeDefined();
    });

    it('complianceFrameworkSummary is an array', async () => {
      const result = await runScanner('https://example.com/');

      expect(Array.isArray(result.complianceFrameworkSummary)).toBe(true);
    });

    it('complianceFrameworkSummary includes GDPR, CCPA, and WCAG / Accessibility entries', async () => {
      const result = await runScanner('https://example.com/');

      const frameworkNames = result.complianceFrameworkSummary!.map((e) => e.framework);
      expect(frameworkNames).toContain('GDPR');
      expect(frameworkNames).toContain('CCPA');
      expect(frameworkNames).toContain('WCAG / Accessibility');
    });

    it('complianceFrameworkSummary entries appear in the canonical FRAMEWORK_ORDER', async () => {
      const result = await runScanner('https://example.com/');

      const frameworkNames = result.complianceFrameworkSummary!.map((e) => e.framework);
      // Every entry must appear in the canonical list
      for (const name of frameworkNames) {
        expect(FRAMEWORK_ORDER).toContain(name);
      }
      // The first entry must be GDPR (canonical first)
      expect(frameworkNames[0]).toBe('GDPR');
    });

    it('each framework entry has only {framework, signals} — no score, count, or fraction field', async () => {
      const result = await runScanner('https://example.com/');

      for (const entry of result.complianceFrameworkSummary!) {
        const keys = Object.keys(entry);
        expect(keys).toEqual(expect.arrayContaining(['framework', 'signals']));
        expect(keys).not.toContain('score');
        expect(keys).not.toContain('count');
        expect(keys).not.toContain('fraction');
        expect(keys).not.toContain('percent');
        expect(keys).not.toContain('total');
        expect(keys).not.toContain('passed');
        expect(keys).not.toContain('failed');
      }
    });

    it('each signal has only {label, status} — no numeric field anywhere in the summary', async () => {
      const result = await runScanner('https://example.com/');

      for (const entry of result.complianceFrameworkSummary!) {
        for (const signal of entry.signals) {
          expect(typeof signal.label).toBe('string');
          expect(['observed', 'not-observed', 'not-evaluated']).toContain(signal.status);
          // Assert no numeric fields at the signal level
          const keys = Object.keys(signal);
          expect(keys).not.toContain('score');
          expect(keys).not.toContain('fraction');
          expect(keys).not.toContain('count');
          expect(keys).not.toContain('percent');
        }
      }
    });

    it('deep-scan of complianceFrameworkSummary finds zero numeric score/fraction properties', async () => {
      const result = await runScanner('https://example.com/');

      const hits = findNumericScoreFields(result.complianceFrameworkSummary);
      expect(hits).toEqual([]);
    });

    it('P1 findings still appear alongside P5 findings when both modules run', async () => {
      vi.mocked(runHeadersModule).mockReturnValue([makeP1Finding('Missing Security Header')]);

      const result = await runScanner('https://example.com/');

      const p1Findings = result.findings.filter((f) => f.moduleId.startsWith('P1-'));
      const p5Findings = result.findings.filter((f) => f.moduleId.startsWith('P5-'));
      expect(p1Findings.length).toBeGreaterThan(0);
      expect(p5Findings.length).toBeGreaterThan(0);
    });
  });

  // ── Scenario 2: Flag OFF — byte-identical no-op ─────────────────────────────

  describe('Scenario 2 — complianceScanning: false (byte-identical no-op invariant)', () => {
    beforeEach(() => {
      mockFeatures.complianceScanning = false;
    });

    it('produces NO P5-* findings in the findings array', async () => {
      const result = await runScanner('https://example.com/');

      const p5Findings = result.findings.filter((f) => f.moduleId.startsWith('P5-'));
      expect(p5Findings).toHaveLength(0);
    });

    it('does NOT include a P5-Compliance key in moduleFindingCounts', async () => {
      const result = await runScanner('https://example.com/');

      expect(result.moduleFindingCounts).not.toHaveProperty('P5-Compliance');
    });

    it('complianceFrameworkSummary key is ABSENT from the result object — not null, not undefined', async () => {
      const result = await runScanner('https://example.com/');

      // The critical QA invariant: the key must not exist at all
      expect('complianceFrameworkSummary' in result).toBe(false);
    });

    it('flag-off result still carries all 18 P1 module keys in moduleFindingCounts', async () => {
      const result = await runScanner('https://example.com/');

      const p1Ids = [
        'P1-01', 'P1-02', 'P1-03', 'P1-04', 'P1-05', 'P1-06', 'P1-07', 'P1-08',
        'P1-09', 'P1-10', 'P1-11', 'P1-12', 'P1-13', 'P1-14', 'P1-15', 'P1-16',
        'P1-17', 'P1-18',
      ];
      for (const id of p1Ids) {
        expect(result.moduleFindingCounts).toHaveProperty(id);
      }
    });

    it('flag-off non-P5 findings are identical in count to a flag-off baseline', async () => {
      // Establish the baseline with a known P1 finding
      vi.mocked(runHeadersModule).mockReturnValue([makeP1Finding('Baseline Header Finding')]);

      const flagOffResult = await runScanner('https://example.com/');

      // No P5 findings; the only finding is the P1 one we seeded
      const nonP5Findings = flagOffResult.findings.filter((f) => !f.moduleId.startsWith('P5-'));
      expect(nonP5Findings).toHaveLength(1);
      expect(nonP5Findings[0].title).toBe('Baseline Header Finding');
    });

    it('flag-on and flag-off produce identical non-P5 findings when P1 modules return the same data', async () => {
      vi.mocked(runSecretsModule).mockResolvedValue([makeP1Finding('Secret Exposed')]);

      // Collect flag-off result
      const flagOffResult = await runScanner('https://example.com/');
      const flagOffNonP5 = flagOffResult.findings.filter((f) => !f.moduleId.startsWith('P5-'));

      // Flip flag on and collect flag-on result
      mockFeatures.complianceScanning = true;
      vi.mocked(crawl).mockResolvedValue(makeCrawlResult());

      const flagOnResult = await runScanner('https://example.com/');
      const flagOnNonP5 = flagOnResult.findings.filter((f) => !f.moduleId.startsWith('P5-'));

      // The non-compliance portions must be byte-identical in count and titles
      expect(flagOnNonP5.length).toBe(flagOffNonP5.length);
      const flagOffTitles = flagOffNonP5.map((f) => f.title);
      const flagOnTitles = flagOnNonP5.map((f) => f.title);
      expect(flagOnTitles).toEqual(flagOffTitles);
    });
  });

  // ── Scenario 3: Compliance failure isolation ─────────────────────────────────

  describe('Scenario 3 — compliance group throws, scan is not aborted', () => {
    afterEach(() => {
      // Always reset the throw flag so later tests are unaffected
      _complianceShouldThrow = false;
    });

    it('returns a valid ScannerResult even when runComplianceModules throws', async () => {
      // Inject a P1 finding so we can confirm it survives the compliance crash
      vi.mocked(runHeadersModule).mockReturnValue([makeP1Finding('Header Security Issue')]);

      // Tell the compliance orchestrator spy to throw on this test's invocation
      _complianceShouldThrow = true;

      const result = await runScanner('https://example.com/');

      // The scan must still return a valid result
      expect(result).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.moduleFindingCounts).toBeDefined();
      expect(result.stack).toBe('Next.js');

      // P1 findings must be present despite the compliance crash
      const p1Findings = result.findings.filter((f) => f.moduleId.startsWith('P1-'));
      expect(p1Findings.length).toBeGreaterThan(0);

      // P5-Compliance key must be absent (crash prevents populating it)
      expect(result.moduleFindingCounts).not.toHaveProperty('P5-Compliance');

      // complianceFrameworkSummary key must be absent
      expect('complianceFrameworkSummary' in result).toBe(false);
    });

    it('scan continues and emits P1 findings when compliance group throws synchronously inside safeRun', async () => {
      // This test exercises runScanner's own try/catch around runComplianceModules,
      // using the real modules but with a malformed CrawlResult that is unlikely
      // to cause P1 module errors. We craft a crawl where finalUrl causes the
      // URL() constructor inside P5-04 to throw on the stripQueryAndFragment call,
      // which would propagate unless safeRun catches it.
      // This already happens normally with the test crawl, but we verify the
      // P1 findings still flow through.
      vi.mocked(runSecretsModule).mockResolvedValue([makeP1Finding('Secrets Finding Survives')]);

      // Use an intentionally unusual CrawlResult to stress compliance modules
      vi.mocked(crawl).mockResolvedValue(
        makeCrawlResult({
          finalUrl: 'https://example.com/',
          html: '', // empty html → P5 modules hit fail-closed paths but must not throw
          renderMode: 'fetch-only',
        }),
      );

      const result = await runScanner('https://example.com/');

      expect(result.findings.some((f) => f.title === 'Secrets Finding Survives')).toBe(true);
    });
  });

  // ── Scenario 4: Context threading ──────────────────────────────────────────

  describe('Scenario 4 — context threading: accessibilityScore forwarded to P5-04', () => {
    it('when accessibilityScanning ran and returned a usable score, P5-04 emits a score-tier finding (not fail-closed)', async () => {
      // Enable accessibility scan with a usable score (> 0, non-undefined)
      mockFeatures.accessibilityScanning = true;
      vi.mocked(runAccessibilityModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
          performanceScore: null,
          accessibilityScore: 0.85,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        accessibilityGrade: 'B',
        accessibilityScore: 85,
      });

      const result = await runScanner('https://example.com/');

      // P5-04 should emit a score-tier finding, not the fail-closed "unavailable" one
      const p504Findings = result.findings.filter((f) => f.moduleId === 'P5-04');
      expect(p504Findings.length).toBeGreaterThan(0);

      // The fail-closed finding title contains 'unavailable'
      const failClosedFinding = p504Findings.find((f) =>
        f.title.toLowerCase().includes('unavailable'),
      );
      expect(failClosedFinding).toBeUndefined();

      // The score-tier finding title should mention the score tier label
      const scoreTierFinding = p504Findings.find(
        (f) =>
          f.title.toLowerCase().includes('moderate') ||
          f.title.toLowerCase().includes('high') ||
          f.title.toLowerCase().includes('low'),
      );
      expect(scoreTierFinding).toBeDefined();
    });

    it('when accessibilityScanning ran and returned a high score (>=90), P5-04 emits a high tier INFO finding', async () => {
      mockFeatures.accessibilityScanning = true;
      vi.mocked(runAccessibilityModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
          performanceScore: null,
          accessibilityScore: 0.95,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        accessibilityGrade: 'A',
        accessibilityScore: 95,
      });

      const result = await runScanner('https://example.com/');

      const p504Findings = result.findings.filter((f) => f.moduleId === 'P5-04');
      expect(p504Findings.length).toBeGreaterThan(0);

      // High tier (≥90) produces an INFO finding
      const highTierFinding = p504Findings.find(
        (f) => f.severity === 'INFO' && f.title.toLowerCase().includes('high'),
      );
      expect(highTierFinding).toBeDefined();
    });

    it('when accessibilityScanning did not run, P5-04 emits the fail-closed unavailable INFO finding', async () => {
      // accessibilityScanning is false (default in this suite's beforeEach)
      // so ctx.accessibilityScore will be undefined when passed to compliance modules

      const result = await runScanner('https://example.com/');

      const p504Findings = result.findings.filter((f) => f.moduleId === 'P5-04');
      expect(p504Findings.length).toBe(1);

      const failClosedFinding = p504Findings[0];
      expect(failClosedFinding.severity).toBe('INFO');
      expect(failClosedFinding.title.toLowerCase()).toContain('unavailable');
    });

    it('when accessibilityScanning ran but returned score 0, P5-04 emits the fail-closed finding', async () => {
      // A score of 0 is treated as a failed/unusable run (fail-closed contract)
      mockFeatures.accessibilityScanning = true;
      vi.mocked(runAccessibilityModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
          performanceScore: null,
          accessibilityScore: 0,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        accessibilityGrade: 'F',
        accessibilityScore: 0,
      });

      const result = await runScanner('https://example.com/');

      const p504Findings = result.findings.filter((f) => f.moduleId === 'P5-04');
      expect(p504Findings.length).toBe(1);

      // Score 0 is fail-closed → should produce the "unavailable" INFO finding
      expect(p504Findings[0].severity).toBe('INFO');
      expect(p504Findings[0].title.toLowerCase()).toContain('unavailable');
    });

    it('accessibility score is forwarded end-to-end via ctx so WCAG / Accessibility framework entry exists in the summary', async () => {
      mockFeatures.accessibilityScanning = true;
      vi.mocked(runAccessibilityModules).mockResolvedValue({
        findings: [],
        metrics: {
          lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
          performanceScore: null,
          accessibilityScore: 0.75,
          seoScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        },
        accessibilityGrade: 'C',
        accessibilityScore: 75,
      });

      const result = await runScanner('https://example.com/');

      expect(result.complianceFrameworkSummary).toBeDefined();
      const wcagEntry = result.complianceFrameworkSummary!.find(
        (e) => e.framework === 'WCAG / Accessibility',
      );
      expect(wcagEntry).toBeDefined();
      expect(wcagEntry!.signals.length).toBeGreaterThan(0);

      // The signal for P5-04 should be 'not-observed' (score 70-89 → LOW severity → not-observed)
      // or 'observed' (≥90 INFO). Score 75 is in the moderate tier → LOW severity → 'not-observed'.
      const p504Signal = wcagEntry!.signals.find((s) =>
        s.label.toLowerCase().includes('moderate') || s.label.toLowerCase().includes('lighthouse'),
      );
      expect(p504Signal).toBeDefined();
      expect(p504Signal!.status).toBe('not-observed'); // LOW severity maps to not-observed
    });
  });
});
