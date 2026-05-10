/**
 * SEO Scanning Orchestrator
 * Phase 7.5: Search Engine Optimization Analysis
 * 
 * Coordinates all SEO detection modules (P4-01 to P4-05)
 * and calculates overall SEO grade.
 */

import type { RawFinding, CrawlResult } from '../types';
import type { LighthouseMetrics } from '../lighthouse';
import { runLighthouse } from '../lighthouse';
import { runMetaTagsModule } from './p4-01-meta-tags';
import { runSocialMetaModule } from './p4-02-social-meta';
import { runStructuredDataModule } from './p4-03-structured-data';
import { runCrawlabilityModule } from './p4-04-crawlability';
import { runMobileSEOModule } from './p4-05-mobile-seo';
import { logger } from '@/lib/logger';

export interface SEOResult {
  findings: RawFinding[];
  metrics: LighthouseMetrics;
  seoGrade: string; // A-F
  seoScore: number; // 0-100
}

/**
 * Calculate SEO grade based on Lighthouse SEO score
 * 
 * SEO Grading:
 * - A: 90-100 (Excellent SEO)
 * - B: 80-89 (Good SEO)
 * - C: 70-79 (Fair SEO)
 * - D: 60-69 (Poor SEO)
 * - F: 0-59 (Failing SEO)
 */
function calculateSEOGrade(score: number | null): string {
  if (score === null) return 'F';
  
  const scorePercent = Math.round(score * 100);
  
  if (scorePercent >= 90) return 'A';
  if (scorePercent >= 80) return 'B';
  if (scorePercent >= 70) return 'C';
  if (scorePercent >= 60) return 'D';
  return 'F';
}

/**
 * Run all SEO modules against the target URL
 */
export async function runSEOModules(
  targetUrl: string,
  crawlResult?: CrawlResult
): Promise<SEOResult> {
  try {
    logger.info('Running SEO scan', { url: targetUrl });

    // Get Lighthouse metrics with SEO audits
    const metrics = await runLighthouse(targetUrl);
    
    // Run all SEO modules
    // P4-01, P4-04, P4-05 use Lighthouse data
    // P4-02, P4-03 use crawl result for HTML parsing
    const [
      metaTagsFindings,
      crawlabilityFindings,
      mobileSEOFindings,
    ] = await Promise.all([
      runMetaTagsModule(metrics),
      runCrawlabilityModule(metrics),
      runMobileSEOModule(metrics),
    ]);

    // Run HTML-based modules if crawl result is available
    let socialMetaFindings: RawFinding[] = [];
    let structuredDataFindings: RawFinding[] = [];
    
    if (crawlResult) {
      socialMetaFindings = runSocialMetaModule(crawlResult);
      structuredDataFindings = runStructuredDataModule(crawlResult);
    }

    // Combine all findings
    const findings: RawFinding[] = [
      ...metaTagsFindings,
      ...socialMetaFindings,
      ...structuredDataFindings,
      ...crawlabilityFindings,
      ...mobileSEOFindings,
    ];

    // Calculate grade from Lighthouse SEO score
    const seoScore = metrics.seoScore !== null 
      ? Math.round(metrics.seoScore * 100)
      : 0;
    const seoGrade = calculateSEOGrade(metrics.seoScore);

    logger.info('SEO scan completed', {
      url: targetUrl,
      grade: seoGrade,
      score: seoScore,
      findingsCount: findings.length,
    });

    return {
      findings,
      metrics,
      seoGrade,
      seoScore,
    };
  } catch (error) {
    logger.error('SEO scan failed', { error, url: targetUrl });
    
    // Return empty result on failure
    return {
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
      seoGrade: 'F',
      seoScore: 0,
    };
  }
}
