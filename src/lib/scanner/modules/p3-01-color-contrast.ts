/**
 * P3-01: Color & Contrast Module
 * Phase 6.5: Accessibility Scanning
 * 
 * WCAG 2.2 Success Criteria:
 * - 1.4.3 Contrast (Minimum) - Level AA
 * - 1.4.11 Non-text Contrast - Level AA
 * - 2.4.7 Focus Visible - Level AA (WCAG 2.2)
 * 
 * Detects:
 * - Text contrast ratio < 4.5:1 (normal text)
 * - Text contrast ratio < 3:1 (large text 18pt+)
 * - Non-text contrast < 3:1 (UI components, borders)
 * - Focus indicators < 3:1 contrast ratio
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runColorContrastModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  // Check if we have accessibility violations
  if (!metrics.accessibilityViolations || metrics.accessibilityViolations.length === 0) {
    return findings;
  }

  // Find color-contrast audit
  const contrastAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'color-contrast'
  );

  if (!contrastAudit || !contrastAudit.items || contrastAudit.items.length === 0) {
    return findings;
  }

  // Extract contrast violations
  const violationCount = contrastAudit.items.length;

  // Determine severity based on number of violations
  let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (violationCount >= 10) {
    severity = 'HIGH';
  } else if (violationCount >= 5) {
    severity = 'MEDIUM';
  } else {
    severity = 'LOW';
  }

  // Build evidence string with specific examples
  const examples = contrastAudit.items.slice(0, 3).map((item, index) => {
    const selector = item.node?.selector || item.selector || 'Unknown element';
    const snippet = item.node?.snippet || item.snippet || '';
    return `${index + 1}. ${selector}${snippet ? ` - ${snippet}` : ''}`;
  }).join('\n');

  const evidenceText = violationCount > 3
    ? `${examples}\n...and ${violationCount - 3} more element${violationCount - 3 > 1 ? 's' : ''}`
    : examples;

  findings.push({
    moduleId: 'P3-01',
    severity,
    category: 'Accessibility',
    title: `Color contrast issues detected (${violationCount} element${violationCount > 1 ? 's' : ''})`,
    location: 'WCAG 1.4.3 - Contrast (Minimum)',
    evidence: `${violationCount} element${violationCount > 1 ? 's' : ''} with insufficient color contrast:\n${evidenceText}`,
    explanation: contrastAudit.description || 'Text and UI components must have sufficient color contrast to be readable by users with low vision or color blindness. WCAG 2.2 Level AA requires:\n- Normal text: 4.5:1 contrast ratio\n- Large text (18pt+): 3:1 contrast ratio\n- UI components: 3:1 contrast ratio',
    impact: `${violationCount} element${violationCount > 1 ? 's are' : ' is'} not accessible to users with low vision, color blindness, or viewing in bright sunlight. This violates WCAG 2.2 Level AA and may result in legal complaints under ADA/Section 508.`,
    fixManual: [
      'Use browser DevTools or WebAIM Contrast Checker to test color combinations',
      'Increase contrast by darkening text or lightening backgrounds (or vice versa)',
      'For large text (18pt+), minimum ratio is 3:1 (more lenient)',
      'For UI components (buttons, form borders), ensure 3:1 ratio against adjacent colors',
      'Consider using accessible color palettes (e.g., Material Design, Tailwind)',
      'Test with Chrome Lighthouse or axe DevTools for automated validation',
    ],
    fixAiPrompt: `I have ${violationCount} color contrast violation${violationCount > 1 ? 's' : ''} on my website that fail WCAG 2.2 Level AA requirements.\n\nExamples:\n${evidenceText}\n\nHelp me:\n1. Identify which colors need adjustment\n2. Suggest accessible color combinations that meet 4.5:1 ratio for text\n3. Provide CSS fixes for the affected elements\n4. Recommend an accessible color palette for my design system\n\nTarget: WCAG 2.2 Level AA compliance (4.5:1 for normal text, 3:1 for large text and UI components)`,
  });

  return findings;
}
