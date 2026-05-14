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
import { runPerformanceModules, type PerformanceResult } from './modules/performance';
import { runAccessibilityModules, type AccessibilityResult } from './modules/accessibility';
import { runSEOModules, type SEOResult } from './modules/seo';
import type { RawFinding } from './types';
import type { ParsedAudit } from './audit-parser';
import { features } from '@/lib/features';
import { logger } from '@/lib/logger';

export interface ScannerResult {
  findings: RawFinding[];
  stack: string;
  moduleFindingCounts: Record<string, number>;
  // Performance scanning results (Phase 5.5)
  performanceGrade?: string; // A-F
  performanceScore?: number; // 0-100
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

  return {
    findings,
    stack: crawlResult.stack,
    moduleFindingCounts,
    // Performance results (only if feature is enabled and scan succeeded)
    ...(performanceResult && {
      performanceGrade: performanceResult.performanceGrade,
      performanceScore: performanceResult.performanceScore,
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
  };
}
