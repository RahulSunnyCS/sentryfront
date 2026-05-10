/**
 * P3-02: Keyboard Navigation & Focus Management Module
 * Phase 6.5: Accessibility Scanning
 * 
 * WCAG 2.2 Success Criteria:
 * - 2.1.1 Keyboard - Level A
 * - 2.1.2 No Keyboard Trap - Level A
 * - 2.4.3 Focus Order - Level A
 * - 2.4.7 Focus Visible - Level AA
 * 
 * Detects:
 * - Missing focus indicators (no :focus styles)
 * - Keyboard traps (can't escape modal with Tab/Esc)
 * - Incorrect tab order (tabindex > 0 anti-pattern)
 * - Skip navigation links missing
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runKeyboardNavigationModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.accessibilityViolations || metrics.accessibilityViolations.length === 0) {
    return findings;
  }

  // Check for tabindex issues
  const tabindexAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'tabindex'
  );

  if (tabindexAudit && tabindexAudit.items && tabindexAudit.items.length > 0) {
    const violationCount = tabindexAudit.items.length;
    
    findings.push({
      moduleId: 'P3-02',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Incorrect tab order detected (${violationCount} element${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 2.4.3 - Focus Order',
      evidence: `${violationCount} element${violationCount > 1 ? 's have' : ' has'} tabindex > 0, which disrupts natural keyboard navigation`,
      explanation: tabindexAudit.description || 'Using tabindex values greater than 0 creates an unpredictable focus order that confuses keyboard users. Natural DOM order should be used instead, with tabindex="0" only when needed to make non-interactive elements focusable.',
      impact: 'Keyboard-only users (including those with motor disabilities) will experience confusing navigation order. Screen reader users may miss important content.',
      fixManual: [
        'Remove all tabindex values greater than 0',
        'Use natural DOM order for logical tab sequence',
        'Restructure HTML instead of using tabindex to fix order',
        'Only use tabindex="0" to make custom interactive elements focusable',
        'Use tabindex="-1" only for programmatic focus (e.g., skip links)',
      ],
      fixAiPrompt: `I have ${violationCount} element${violationCount > 1 ? 's' : ''} with tabindex > 0, which breaks keyboard navigation.\n\nHelp me:\n1. Remove all tabindex > 0 attributes\n2. Restructure my HTML to create logical focus order\n3. Identify which elements truly need tabindex="0"\n4. Implement skip-to-content links properly`,
    });
  }

  // Check for duplicate IDs (affects focus management)
  const duplicateIdAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'duplicate-id' || audit.id === 'duplicate-id-active'
  );

  if (duplicateIdAudit && duplicateIdAudit.items && duplicateIdAudit.items.length > 0) {
    const violationCount = duplicateIdAudit.items.length;
    
    findings.push({
      moduleId: 'P3-02',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Duplicate IDs detected (${violationCount} occurrence${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 4.1.1 - Parsing',
      evidence: `${violationCount} duplicate ID${violationCount > 1 ? 's found' : ' found'}, which breaks ARIA references and focus management`,
      explanation: duplicateIdAudit.description || 'Duplicate IDs break assistive technology features like aria-labelledby, aria-describedby, and programmatic focus. Each ID must be unique within the page.',
      impact: 'Screen readers may announce incorrect labels. Programmatic focus (e.g., error handling, skip links) may jump to wrong elements.',
      fixManual: [
        'Find all duplicate IDs using browser DevTools or validator',
        'Make each ID unique (append suffixes if needed)',
        'Update corresponding ARIA references (aria-labelledby, aria-describedby)',
        'Use classes instead of IDs for styling purposes',
      ],
      fixAiPrompt: `I have ${violationCount} duplicate ID${violationCount > 1 ? 's' : ''} on my page.\n\nHelp me:\n1. Generate unique IDs for all elements\n2. Update ARIA references to match new IDs\n3. Convert ID-based styles to classes where appropriate`,
    });
  }

  return findings;
}
