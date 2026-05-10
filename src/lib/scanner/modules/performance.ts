/**
 * Performance Scanning Module Aggregator
 * Phase 5.5: Performance Scanning
 * 
 * Orchestrates all performance detection modules (P2-01 to P2-06)
 */

import type { LighthouseMetrics } from '../lighthouse';
import { runCoreWebVitalsModule } from './p2-01-core-web-vitals';
import { runResourceOptimizationModule } from './p2-02-resource-optimization';
import { runNetworkEfficiencyModule } from './p2-03-network-efficiency';
import { runJavaScriptPerformanceModule } from './p2-04-javascript-performance';
import { runServerResponseTimeModule } from './p2-05-server-response-time';
import { runMobilePerformanceModule } from './p2-06-mobile-performance';
import type { RawFinding, CrawlResult } from '../types';
import { logger } from '@/lib/logger';

export interface PerformanceResult {
  findings: RawFinding[];
  metrics: LighthouseMetrics;
  performanceGrade: string; // A-F
  performanceScore: number; // 0-100
}

/**
 * Calculate performance grade based on Lighthouse score and Core Web Vitals
 */
function calculatePerformanceGrade(metrics: LighthouseMetrics): { grade: string; score: number } {
  // Use Lighthouse performance score as base (0-1 range)
  const lighthouseScore = metrics.performanceScore || 0;
  
  // Adjust based on Core Web Vitals
  let adjustedScore = lighthouseScore;
  
  // LCP penalty
  if (metrics.lcp !== null) {
    if (metrics.lcp >= 4000) {
      adjustedScore -= 0.15; // POOR LCP
    } else if (metrics.lcp >= 2000) {
      adjustedScore -= 0.05; // NEEDS IMPROVEMENT
    }
  }
  
  // CLS penalty
  if (metrics.cls !== null) {
    if (metrics.cls >= 0.25) {
      adjustedScore -= 0.10; // POOR CLS
    } else if (metrics.cls >= 0.08) {
      adjustedScore -= 0.03; // NEEDS IMPROVEMENT
    }
  }
  
  // Ensure score is in valid range
  adjustedScore = Math.max(0, Math.min(1, adjustedScore));
  
  // Convert to 0-100 scale
  const score = Math.round(adjustedScore * 100);
  
  // Calculate grade
  let grade: string;
  if (score >= 90) {
    grade = 'A';
  } else if (score >= 80) {
    grade = 'B';
  } else if (score >= 70) {
    grade = 'C';
  } else if (score >= 60) {
    grade = 'D';
  } else {
    grade = 'F';
  }
  
  return { grade, score };
}

/**
 * Run all performance modules
 */
export async function runPerformanceModules(
  targetUrl: string,
  crawlResult?: CrawlResult
): Promise<PerformanceResult> {
  try {
    logger.info('Starting performance scan', { url: targetUrl });

    // Dynamically import Lighthouse to avoid import.meta issues during Next.js build
    const { runLighthouse } = await import('../lighthouse');

    // Run Lighthouse audit
    const metrics = await runLighthouse(targetUrl, {
      onlyCategories: ['performance'],
      formFactor: 'mobile', // Mobile-first (can make configurable)
    });

    // Run all performance detection modules
    const coreWebVitalsFindings = runCoreWebVitalsModule(metrics);
    const resourceOptimizationFindings = runResourceOptimizationModule(metrics);
    const networkEfficiencyFindings = runNetworkEfficiencyModule(metrics);
    const jsPerformanceFindings = runJavaScriptPerformanceModule(metrics);
    const serverResponseFindings = runServerResponseTimeModule(metrics);

    // Mobile performance needs crawl result (HTML analysis)
    const mobilePerformanceFindings = crawlResult
      ? runMobilePerformanceModule(crawlResult)
      : [];

    // Combine all findings
    const allFindings = [
      ...coreWebVitalsFindings,
      ...resourceOptimizationFindings,
      ...networkEfficiencyFindings,
      ...jsPerformanceFindings,
      ...serverResponseFindings,
      ...mobilePerformanceFindings,
    ];
    
    // Calculate grade
    const { grade, score } = calculatePerformanceGrade(metrics);
    
    logger.info('Performance scan completed', {
      url: targetUrl,
      grade,
      score,
      findingsCount: allFindings.length,
      lcp: metrics.lcp,
      cls: metrics.cls,
    });
    
    return {
      findings: allFindings,
      metrics,
      performanceGrade: grade,
      performanceScore: score,
    };
  } catch (error) {
    logger.error('Performance scan failed', { error, url: targetUrl });
    
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
      performanceGrade: 'F',
      performanceScore: 0,
    };
  }
}
