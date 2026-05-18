import { crawl } from './crawler';
import { runSecretsModule } from './modules/p1-01-secrets';
import { runSourcemapsModule } from './modules/p1-02-sourcemaps';
import { runHeadersModule } from './modules/p1-03-headers';
import { runTLSModule } from './modules/p1-04-tls';
import { runCookiesModule } from './modules/p1-05-cookies';
import { runSensitivePathsModule } from './modules/p1-06-sensitive-paths';
import { runCorsModule } from './modules/p1-07-cors';
import { runMixedContentModule } from './modules/p1-08-mixed-content';
import { runThirdPartyScriptsModule } from './modules/p1-09-third-party-scripts';
import { runDnsEmailModule } from './modules/p1-10-dns-email';
import { runSubdomainTakeoverModule } from './modules/p1-11-subdomain-takeover';
import { runErrorDisclosureModule } from './modules/p1-12-error-disclosure';
import { runDevInterfacesModule } from './modules/p1-13-dev-interfaces';
import { runRobotsSitemapModule } from './modules/p1-14-robots-sitemap';
import { runCacheModule } from './modules/p1-15-cache';
import { runClientDepsModule } from './modules/p1-16-client-deps';
import { runServiceWorkerModule } from './modules/p1-17-service-worker';
import { runWebManifestModule } from './modules/p1-18-web-manifest';
import { runDomXssModule } from './modules/p1-19-dom-xss';
import { runPerformanceModules, type PerformanceResult } from './modules/performance';
import { runAccessibilityModules, type AccessibilityResult } from './modules/accessibility';
import { runSEOModules, type SEOResult } from './modules/seo';
import { runComplianceModules } from './modules/compliance';
import type { RawFinding, ComplianceFrameworkSummary } from './types';
import type { ParsedAudit } from './audit-parser';
import type { CrUXFieldData } from './lighthouse';
import { features } from '@/lib/features';
import { logger } from '@/lib/logger';

/**
 * Sub-object for desktop performance data. Mirrors the FormFactorResult shape
 * from modules/performance.ts but is re-declared here (stripped of the internal
 * LighthouseMetrics reference) so ScannerResult stays self-contained and the
 * full metrics blob doesn't leak into the scanner-level interface.
 *
 * All fields are optional for backward compat with old persisted scans.
 */
export interface DesktopPerformanceData {
  score: number | null;
  grade: string;
  scoreSource: 'lab' | 'unavailable';
  metrics: {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    ttfb: number | null;
    opportunities: ParsedAudit[];
  };
}

export interface ScannerResult {
  findings: RawFinding[];
  stack: string;
  moduleFindingCounts: Record<string, number>;
  // Performance scanning results (Phase 5.5 / T-06 / T-08)
  performanceGrade?: string; // A-F or 'N/A'
  // 0-100 integer on success; null on PSI failure.
  // null is a valid value (UNAVAILABLE path), so we carry it explicitly rather
  // than omitting it — scan-worker needs to distinguish "feature disabled"
  // (field absent) from "feature ran but PSI failed" (field present, null).
  performanceScore?: number | null;
  /**
   * 'lab' when a real Lighthouse score was returned; 'unavailable' when PSI
   * failed. Optional so old pre-T-06 ScannerResult shapes typecheck.
   */
  scoreSource?: 'lab' | 'unavailable';
  /**
   * CrUX real-user verdict for the mobile result.
   * Null when the CrUX block was absent from the PSI response.
   */
  fieldDataVerdict?: CrUXFieldData['overallCategory'] | null;
  /** Full URL-level CrUX field data. Null when absent. */
  fieldData?: CrUXFieldData | null;
  /** Best-practices Lighthouse category score (0-100). Null when absent or PSI failed. */
  bestPracticesScore?: number | null;
  /** A-F grade for best practices; 'N/A' when score is null. */
  bestPracticesGrade?: string;
  /**
   * Desktop sub-object. Only present when features.desktopPerformance is true
   * AND mobile succeeded. Never drives the headline grade.
   */
  desktopPerformance?: DesktopPerformanceData;
  performanceMetrics?: {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    ttfb: number | null;
    opportunities: ParsedAudit[];
  };
  // Accessibility scanning results (Phase 6.5)
  accessibilityGrade?: string; // A-F
  accessibilityScore?: number; // 0-100
  accessibilityMetrics?: {
    violations: ParsedAudit[];
  };
  // SEO scanning results (Phase 7.5)
  seoGrade?: string; // A-F
  seoScore?: number; // 0-100
  seoMetrics?: {
    issues: ParsedAudit[];
  };
  // Compliance scanning results (Phase 5 — P5 group)
  // Optional so flag-off scans (features.complianceScanning === false) produce
  // a ScannerResult that is byte-identical to pre-Phase-5 output. The key is
  // absent entirely (not null) because the return uses a conditional spread.
  complianceFrameworkSummary?: ComplianceFrameworkSummary;
}

export async function runScanner(targetUrl: string): Promise<ScannerResult> {
  const crawlResult = await crawl(targetUrl);

  // Group 1: async I/O-heavy modules — run fully in parallel
  const [
    secretsFindings,
    sourcemapFindings,
    sensitivePathFindings,
    corsFindings,
    dnsEmailFindings,
    subdomainFindings,
    errorDisclosureFindings,
    devInterfaceFindings,
    robotsSitemapFindings,
    clientDepsFindings,
  ] = await Promise.all([
    runSecretsModule(crawlResult),
    runSourcemapsModule(crawlResult),
    runSensitivePathsModule(crawlResult),
    runCorsModule(crawlResult),
    runDnsEmailModule(crawlResult),
    runSubdomainTakeoverModule(crawlResult),
    runErrorDisclosureModule(crawlResult),
    runDevInterfacesModule(crawlResult),
    runRobotsSitemapModule(crawlResult),
    runClientDepsModule(crawlResult),
  ]);

  // Group 2: synchronous modules — no extra I/O needed
  const headerFindings = runHeadersModule(crawlResult);
  const tlsFindings = runTLSModule(crawlResult);
  const cookieFindings = runCookiesModule(crawlResult);
  const mixedContentFindings = runMixedContentModule(crawlResult);
  const thirdPartyFindings = runThirdPartyScriptsModule(crawlResult);
  const cacheFindings = runCacheModule(crawlResult);
  // Phase 3.8.4: PWA surface (service worker + web manifest). These modules
  // operate on optional CrawlResult fields the crawler only populates when
  // `features.pwaSurfaceChecks` is on, so they're no-ops in flag-off scans.
  const serviceWorkerFindings = runServiceWorkerModule(crawlResult);
  const webManifestFindings = runWebManifestModule(crawlResult);
  // P1-19: DOM-based XSS. No-op on static-fetch fallback scans (loadedChunkContents absent).
  const domXssFindings = runDomXssModule(crawlResult);

  const allFindings: Array<{ id: string; findings: RawFinding[] }> = [
    { id: 'P1-01', findings: secretsFindings },
    { id: 'P1-02', findings: sourcemapFindings },
    { id: 'P1-03', findings: headerFindings },
    { id: 'P1-04', findings: tlsFindings },
    { id: 'P1-05', findings: cookieFindings },
    { id: 'P1-06', findings: sensitivePathFindings },
    { id: 'P1-07', findings: corsFindings },
    { id: 'P1-08', findings: mixedContentFindings },
    { id: 'P1-09', findings: thirdPartyFindings },
    { id: 'P1-10', findings: dnsEmailFindings },
    { id: 'P1-11', findings: subdomainFindings },
    { id: 'P1-12', findings: errorDisclosureFindings },
    { id: 'P1-13', findings: devInterfaceFindings },
    { id: 'P1-14', findings: robotsSitemapFindings },
    { id: 'P1-15', findings: cacheFindings },
    { id: 'P1-16', findings: clientDepsFindings },
    { id: 'P1-17', findings: serviceWorkerFindings },
    { id: 'P1-18', findings: webManifestFindings },
    { id: 'P1-19', findings: domXssFindings },
  ];

  const findings = allFindings.flatMap((m) => m.findings);
  const moduleFindingCounts = Object.fromEntries(
    allFindings.map((m) => [m.id, m.findings.length]),
  );

  // Phase 5.5: Performance scanning (optional, feature-flagged)
  let performanceResult: PerformanceResult | null = null;

  if (features.performanceScanning) {
    try {
      logger.info('Running performance scan', { url: targetUrl });
      performanceResult = await runPerformanceModules(targetUrl, crawlResult);

      // Add performance findings to overall findings
      findings.push(...performanceResult.findings);

      // Add performance module counts
      moduleFindingCounts['P2-Performance'] = performanceResult.findings.length;

      logger.info('Performance scan completed', {
        url: targetUrl,
        grade: performanceResult.performanceGrade,
        score: performanceResult.performanceScore,
        findingsCount: performanceResult.findings.length,
      });
    } catch (error) {
      logger.error('Performance scan failed, continuing with security scan', { error, url: targetUrl });
      // Don't fail the entire scan if performance scanning fails
    }
  }

  // Phase 6.5: Accessibility scanning (optional, feature-flagged)
  let accessibilityResult: AccessibilityResult | null = null;

  if (features.accessibilityScanning) {
    try {
      logger.info('Running accessibility scan', { url: targetUrl });
      accessibilityResult = await runAccessibilityModules(targetUrl);

      // Add accessibility findings to overall findings
      findings.push(...accessibilityResult.findings);

      // Add accessibility module counts
      moduleFindingCounts['P3-Accessibility'] = accessibilityResult.findings.length;

      logger.info('Accessibility scan completed', {
        url: targetUrl,
        grade: accessibilityResult.accessibilityGrade,
        score: accessibilityResult.accessibilityScore,
        findingsCount: accessibilityResult.findings.length,
      });
    } catch (error) {
      logger.error('Accessibility scan failed, continuing with remaining scan', { error, url: targetUrl });
      // Don't fail the entire scan if accessibility scanning fails
    }
  }

  // Phase 7.5: SEO scanning (optional, feature-flagged)
  let seoResult: SEOResult | null = null;

  if (features.seoScanning) {
    try {
      logger.info('Running SEO scan', { url: targetUrl });
      seoResult = await runSEOModules(targetUrl, crawlResult);

      // Add SEO findings to overall findings
      findings.push(...seoResult.findings);

      // Add SEO module counts
      moduleFindingCounts['P4-SEO'] = seoResult.findings.length;

      logger.info('SEO scan completed', {
        url: targetUrl,
        grade: seoResult.seoGrade,
        score: seoResult.seoScore,
        findingsCount: seoResult.findings.length,
      });
    } catch (error) {
      logger.error('SEO scan failed, continuing with remaining scan', { error, url: targetUrl });
      // Don't fail the entire scan if SEO scanning fails
    }
  }

  // Phase 5 (P5 group): Compliance scanning — appended strictly LAST so that
  // findings/moduleFindingCounts ordering is unchanged vs pre-Phase-5 when
  // this flag is off. Null when disabled; the conditional spread in the return
  // ensures the key is entirely absent on the result (byte-identical flag-off).
  let complianceResult: Awaited<ReturnType<typeof runComplianceModules>> | null = null;

  if (features.complianceScanning) {
    try {
      // Build ComplianceContext from whatever data is available at this point.
      // accessibilityScore comes from the P3 pass (may be undefined if it
      // did not run or failed). AccessibilityResult has no accessibilityScoreSource
      // field, so we intentionally omit accessibilityScoreSource from the context
      // rather than inventing a value — the type allows it to be absent.
      const complianceCtx = {
        accessibilityScore: accessibilityResult?.accessibilityScore,
        // accessibilityScoreSource is intentionally omitted: AccessibilityResult
        // does not expose a scoreSource, so we cannot populate it without
        // guessing. ComplianceContext accepts it as optional — leave it absent.
        renderMode: crawlResult.renderMode,
      };

      complianceResult = await runComplianceModules(crawlResult, complianceCtx);

      // Push P5 findings into the shared findings array.
      findings.push(...complianceResult.findings);

      // Record the per-group finding count under a stable P5 key.
      moduleFindingCounts['P5-Compliance'] = complianceResult.findings.length;
    } catch (error) {
      logger.error('Compliance scan failed, continuing with remaining scan', { error, url: targetUrl });
      // A compliance failure must never fail the entire scan — same pattern as
      // the sibling performance / accessibility / SEO blocks above.
    }
  }

  return {
    findings,
    stack: crawlResult.stack,
    moduleFindingCounts,
    // Performance results (only if feature is enabled and scan ran).
    // IMPORTANT: we spread even when performanceResult exists but PSI failed
    // (scoreSource === 'unavailable'). The scan-worker must persist scoreSource
    // so the UNAVAILABLE state survives the round-trip. Using a plain truthiness
    // guard on performanceResult (non-null) is correct here — it means "the
    // feature ran", not "PSI succeeded". scoreSource carries the success/fail
    // distinction within the result.
    ...(performanceResult && {
      performanceGrade: performanceResult.performanceGrade,
      performanceScore: performanceResult.performanceScore, // may be null (UNAVAILABLE)
      scoreSource: performanceResult.scoreSource,
      fieldDataVerdict: performanceResult.fieldDataVerdict,
      fieldData: performanceResult.fieldData,
      bestPracticesScore: performanceResult.bestPracticesScore,
      bestPracticesGrade: performanceResult.bestPracticesGrade,
      // Desktop sub-object: only present when the feature ran AND desktop is defined.
      // When features.desktopPerformance is false, performanceResult.desktop is
      // undefined, so this key is absent — byte-identical to pre-T-06 behaviour.
      ...(performanceResult.desktop !== undefined && {
        desktopPerformance: {
          score: performanceResult.desktop.score,
          grade: performanceResult.desktop.grade,
          scoreSource: performanceResult.desktop.scoreSource,
          metrics: {
            lcp: performanceResult.desktop.metrics.lcp,
            fcp: performanceResult.desktop.metrics.fcp,
            cls: performanceResult.desktop.metrics.cls,
            tbt: performanceResult.desktop.metrics.tbt,
            ttfb: performanceResult.desktop.metrics.ttfb,
            opportunities: performanceResult.desktop.metrics.opportunities,
          },
        },
      }),
      performanceMetrics: {
        lcp: performanceResult.metrics.lcp,
        fcp: performanceResult.metrics.fcp,
        cls: performanceResult.metrics.cls,
        tbt: performanceResult.metrics.tbt,
        ttfb: performanceResult.metrics.ttfb,
        opportunities: performanceResult.metrics.opportunities,
      },
    }),
    // Accessibility results (only if feature is enabled and scan succeeded)
    ...(accessibilityResult && {
      accessibilityGrade: accessibilityResult.accessibilityGrade,
      accessibilityScore: accessibilityResult.accessibilityScore,
      accessibilityMetrics: {
        violations: accessibilityResult.metrics.accessibilityViolations,
      },
    }),
    // SEO results (only if feature is enabled and scan succeeded)
    ...(seoResult && {
      seoGrade: seoResult.seoGrade,
      seoScore: seoResult.seoScore,
      seoMetrics: {
        issues: seoResult.metrics.seoIssues,
      },
    }),
    // Compliance results (only if feature is enabled and scan succeeded).
    // The key is absent entirely (not null) when complianceResult is null,
    // so flag-off output is byte-identical to pre-Phase-5 ScannerResult shapes.
    ...(complianceResult && {
      complianceFrameworkSummary: complianceResult.frameworkSummary,
    }),
  };
}
