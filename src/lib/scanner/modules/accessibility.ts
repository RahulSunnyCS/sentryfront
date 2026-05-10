/**
 * Accessibility Scanning Orchestrator
 * Phase 6.5: WCAG 2.2 Level AA Compliance Checking
 * 
 * Coordinates all accessibility detection modules (P3-01 to P3-05)
 * and calculates overall accessibility grade.
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';
import { runLighthouse } from '../lighthouse';
import { runColorContrastModule } from './p3-01-color-contrast';
import { runKeyboardNavigationModule } from './p3-02-keyboard-navigation';
import { runScreenReaderModule } from './p3-03-screen-reader';
import { runSemanticHTMLModule } from './p3-04-semantic-html';
import { runFormsInteractiveModule } from './p3-05-forms-interactive';
import { logger } from '@/lib/logger';

export interface AccessibilityResult {
  findings: RawFinding[];
  metrics: LighthouseMetrics;
  accessibilityGrade: string; // A-F
  accessibilityScore: number; // 0-100
}

/**
 * Calculate accessibility grade based on Lighthouse score
 * 
 * WCAG 2.2 Level AA Grading:
 * - A: 95-100 (Excellent - full WCAG 2.2 Level AA compliance)
 * - B: 85-94 (Good - minor issues)
 * - C: 70-84 (Fair - some violations)
 * - D: 50-69 (Poor - significant violations)
 * - F: 0-49 (Failing - critical accessibility barriers)
 */
function calculateAccessibilityGrade(score: number | null): string {
  if (score === null) return 'F';
  
  const scorePercent = Math.round(score * 100);
  
  if (scorePercent >= 95) return 'A';
  if (scorePercent >= 85) return 'B';
  if (scorePercent >= 70) return 'C';
  if (scorePercent >= 50) return 'D';
  return 'F';
}

/**
 * Run all accessibility modules against the target URL
 */
export async function runAccessibilityModules(
  targetUrl: string
): Promise<AccessibilityResult> {
  try {
    logger.info('Running accessibility scan', { url: targetUrl });

    // Get Lighthouse metrics with accessibility audits
    const metrics = await runLighthouse(targetUrl);
    
    // Run all accessibility modules in parallel
    const [
      colorContrastFindings,
      keyboardNavFindings,
      screenReaderFindings,
      semanticHTMLFindings,
      formsInteractiveFindings,
    ] = await Promise.all([
      runColorContrastModule(metrics),
      runKeyboardNavigationModule(metrics),
      runScreenReaderModule(metrics),
      runSemanticHTMLModule(metrics),
      runFormsInteractiveModule(metrics),
    ]);

    // Combine all findings
    const findings: RawFinding[] = [
      ...colorContrastFindings,
      ...keyboardNavFindings,
      ...screenReaderFindings,
      ...semanticHTMLFindings,
      ...formsInteractiveFindings,
    ];

    // Calculate grade from Lighthouse accessibility score
    const accessibilityScore = metrics.accessibilityScore !== null 
      ? Math.round(metrics.accessibilityScore * 100)
      : 0;
    const accessibilityGrade = calculateAccessibilityGrade(metrics.accessibilityScore);

    logger.info('Accessibility scan completed', {
      url: targetUrl,
      grade: accessibilityGrade,
      score: accessibilityScore,
      findingsCount: findings.length,
    });

    return {
      findings,
      metrics,
      accessibilityGrade,
      accessibilityScore,
    };
  } catch (error) {
    logger.error('Accessibility scan failed', { error, url: targetUrl });
    
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
      accessibilityGrade: 'F',
      accessibilityScore: 0,
    };
  }
}
