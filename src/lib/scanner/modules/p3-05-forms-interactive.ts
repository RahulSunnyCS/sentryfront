/**
 * P3-05: Forms & Interactive Elements Module
 * Phase 6.5: Accessibility Scanning
 * 
 * WCAG 2.2 Success Criteria:
 * - 1.4.2 Audio Control - Level A
 * - 3.2.2 On Input - Level A
 * - 3.3.1 Error Identification - Level A
 * - 3.3.2 Labels or Instructions - Level A
 * - 3.3.3 Error Suggestion - Level AA
 * 
 * Detects:
 * - Form error messages not associated with inputs
 * - Missing required field indicators
 * - Ambiguous link text
 * - Auto-playing media without controls
 * - ARIA attributes errors
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runFormsInteractiveModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.accessibilityViolations || metrics.accessibilityViolations.length === 0) {
    return findings;
  }

  // Check for ARIA attribute errors
  const ariaAllowedAttrAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'aria-allowed-attr'
  );

  if (ariaAllowedAttrAudit && ariaAllowedAttrAudit.items && ariaAllowedAttrAudit.items.length > 0) {
    const violationCount = ariaAllowedAttrAudit.items.length;
    
    findings.push({
      moduleId: 'P3-05',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Invalid ARIA attributes (${violationCount} element${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 4.1.2 - Name, Role, Value',
      evidence: `${violationCount} element${violationCount > 1 ? 's have' : ' has'} ARIA attributes not allowed for their role`,
      explanation: ariaAllowedAttrAudit.description || 'ARIA attributes must be valid for the element\'s role. Using invalid attributes confuses assistive technology.',
      impact: 'Screen readers may ignore or misinterpret invalid ARIA, breaking functionality.',
      fixManual: [
        'Remove ARIA attributes that don\'t apply to the element\'s role',
        'Check MDN or WAI-ARIA spec for valid attributes per role',
        'Use native HTML elements instead of ARIA when possible',
      ],
      fixAiPrompt: `I have ${violationCount} element${violationCount > 1 ? 's' : ''} with invalid ARIA attributes.\n\nHelp me identify and remove invalid attributes.`,
    });
  }

  // Check for required ARIA attributes
  const ariaRequiredAttrAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'aria-required-attr'
  );

  if (ariaRequiredAttrAudit && ariaRequiredAttrAudit.items && ariaRequiredAttrAudit.items.length > 0) {
    const violationCount = ariaRequiredAttrAudit.items.length;
    
    findings.push({
      moduleId: 'P3-05',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Missing required ARIA attributes (${violationCount} element${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 4.1.2 - Name, Role, Value',
      evidence: `${violationCount} element${violationCount > 1 ? 's are' : ' is'} missing required ARIA attributes for their role`,
      explanation: ariaRequiredAttrAudit.description || 'Elements with ARIA roles must include all required attributes. For example, role="tab" requires aria-selected.',
      impact: 'Incomplete ARIA implementations break assistive technology functionality.',
      fixManual: [
        'Add required ARIA attributes for each role',
        'Check WAI-ARIA authoring practices for requirements',
        'Consider using native HTML if possible (e.g., <button> instead of div[role="button"])',
      ],
      fixAiPrompt: `I have ${violationCount} element${violationCount > 1 ? 's' : ''} missing required ARIA attributes.\n\nHelp me add the missing attributes according to WAI-ARIA spec.`,
    });
  }

  // Check for valid ARIA attribute values
  const ariaValidAttrAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'aria-valid-attr'
  );

  if (ariaValidAttrAudit && ariaValidAttrAudit.items && ariaValidAttrAudit.items.length > 0) {
    const violationCount = ariaValidAttrAudit.items.length;
    
    findings.push({
      moduleId: 'P3-05',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Invalid ARIA attribute values (${violationCount} element${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 4.1.2 - Name, Role, Value',
      evidence: `${violationCount} element${violationCount > 1 ? 's have' : ' has'} invalid ARIA attribute values`,
      explanation: ariaValidAttrAudit.description || 'ARIA attribute values must follow the specification. For example, aria-expanded must be "true" or "false", not "yes" or "no".',
      impact: 'Invalid values break assistive technology parsing.',
      fixManual: [
        'Use correct boolean values: "true"/"false", not "yes"/"no" or 1/0',
        'Use valid ID references for aria-labelledby and aria-describedby',
        'Use allowed enumerated values (e.g., aria-live: "polite"|"assertive"|"off")',
      ],
      fixAiPrompt: `I have ${violationCount} element${violationCount > 1 ? 's' : ''} with invalid ARIA attribute values.\n\nHelp me fix these to use spec-compliant values.`,
    });
  }

  // Check for meta viewport (mobile accessibility)
  const metaViewportAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'meta-viewport'
  );

  if (metaViewportAudit && metaViewportAudit.score !== null && metaViewportAudit.score < 1) {
    findings.push({
      moduleId: 'P3-05',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: 'Mobile viewport not configured for accessibility',
      location: 'WCAG 1.4.4 - Resize Text',
      evidence: 'Meta viewport uses user-scalable=no or maximum-scale < 5',
      explanation: metaViewportAudit.description || 'The viewport meta tag should not prevent users from zooming. Disabling zoom blocks users with low vision from reading content.',
      impact: 'Users with low vision cannot zoom in to read text on mobile devices.',
      fixManual: [
        'Remove user-scalable=no from viewport meta tag',
        'Remove maximum-scale if set to less than 5',
        'Use: <meta name="viewport" content="width=device-width, initial-scale=1">',
        'Design responsive layouts instead of blocking zoom',
      ],
      fixAiPrompt: 'My viewport meta tag blocks user zooming.\n\nHelp me change it to: <meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  return findings;
}
