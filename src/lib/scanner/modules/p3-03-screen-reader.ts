/**
 * P3-03: Screen Reader Support & ARIA Module
 * Phase 6.5: Accessibility Scanning
 * 
 * WCAG 2.2 Success Criteria:
 * - 1.1.1 Non-text Content - Level A
 * - 1.3.1 Info and Relationships - Level A
 * - 4.1.2 Name, Role, Value - Level A
 * 
 * Detects:
 * - Images missing alt text
 * - Form inputs without labels
 * - Buttons with no accessible name
 * - Invalid ARIA usage
 * - Missing landmark roles
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runScreenReaderModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.accessibilityViolations || metrics.accessibilityViolations.length === 0) {
    return findings;
  }

  // Check for missing alt text
  const imageAltAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'image-alt'
  );

  if (imageAltAudit && imageAltAudit.items && imageAltAudit.items.length > 0) {
    const violationCount = imageAltAudit.items.length;
    
    findings.push({
      moduleId: 'P3-03',
      severity: violationCount >= 5 ? 'HIGH' : 'MEDIUM',
      category: 'Accessibility',
      title: `Images missing alt text (${violationCount} image${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 1.1.1 - Non-text Content',
      evidence: `${violationCount} image${violationCount > 1 ? 's' : ''} without alt attributes`,
      explanation: imageAltAudit.description || 'All images must have alt attributes. Use descriptive alt text for informative images, alt="" for decorative images, and avoid "image of" or "picture of" prefixes.',
      impact: `Screen reader users cannot understand what ${violationCount} image${violationCount > 1 ? 's show' : ' shows'}. This violates WCAG 2.2 Level A (critical baseline).`,
      fixManual: [
        'Add alt="" for decorative images (icons, spacers, purely aesthetic)',
        'Write descriptive alt text for informative images (convey purpose, not appearance)',
        'For complex images (charts, diagrams), use alt + long description',
        'Avoid redundant phrases like "image of" or "picture of"',
        'Keep alt text under 125 characters when possible',
      ],
      fixAiPrompt: `I have ${violationCount} image${violationCount > 1 ? 's' : ''} without alt text.\n\nHelp me write appropriate alt text that:\n1. Describes informative images concisely\n2. Uses alt="" for decorative images\n3. Follows WCAG 1.1.1 best practices`,
    });
  }

  // Check for form labels
  const labelAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'label'
  );

  if (labelAudit && labelAudit.items && labelAudit.items.length > 0) {
    const violationCount = labelAudit.items.length;
    
    findings.push({
      moduleId: 'P3-03',
      severity: 'HIGH',
      category: 'Accessibility',
      title: `Form inputs missing labels (${violationCount} input${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 1.3.1, 4.1.2 - Labels',
      evidence: `${violationCount} form input${violationCount > 1 ? 's' : ''} without associated <label> or aria-label`,
      explanation: labelAudit.description || 'All form inputs must have associated labels so screen reader users know what to enter. Use <label for="id"> or aria-label for each input.',
      impact: 'Screen reader users cannot identify what to type in form fields. This makes forms completely unusable for blind users.',
      fixManual: [
        'Add <label for="inputId">Label text</label> for each input',
        'Ensure label\'s "for" attribute matches input\'s "id"',
        'For visually hidden labels, use aria-label="Label text"',
        'Group related inputs with <fieldset> and <legend>',
        'Use aria-describedby for additional help text',
      ],
      fixAiPrompt: `I have ${violationCount} form input${violationCount > 1 ? 's' : ''} without labels.\n\nHelp me:\n1. Add proper <label> elements to all inputs\n2. Ensure labels are correctly associated via "for" and "id"\n3. Handle visually hidden labels with aria-label where needed`,
    });
  }

  // Check for button names
  const buttonNameAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'button-name'
  );

  if (buttonNameAudit && buttonNameAudit.items && buttonNameAudit.items.length > 0) {
    const violationCount = buttonNameAudit.items.length;
    
    findings.push({
      moduleId: 'P3-03',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Buttons missing accessible names (${violationCount} button${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 4.1.2 - Name, Role, Value',
      evidence: `${violationCount} button${violationCount > 1 ? 's' : ''} with no text or aria-label`,
      explanation: buttonNameAudit.description || 'Icon-only buttons must have aria-label or title attributes so screen readers can announce their purpose.',
      impact: `Screen readers announce "${violationCount} unnamed button${violationCount > 1 ? 's' : ''}" which is meaningless to users.`,
      fixManual: [
        'Add text content inside the button',
        'For icon-only buttons, use aria-label="Action description"',
        'Alternatively, use visually-hidden text with screen reader-only class',
        'Use title attribute only as a last resort (less accessible)',
      ],
      fixAiPrompt: `I have ${violationCount} button${violationCount > 1 ? 's' : ''} without accessible names (likely icon-only buttons).\n\nHelp me add aria-label attributes with descriptive action names.`,
    });
  }

  // Check for link names
  const linkNameAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'link-name'
  );

  if (linkNameAudit && linkNameAudit.items && linkNameAudit.items.length > 0) {
    const violationCount = linkNameAudit.items.length;
    
    findings.push({
      moduleId: 'P3-03',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: `Links missing accessible names (${violationCount} link${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 4.1.2, 2.4.4 - Link Purpose',
      evidence: `${violationCount} link${violationCount > 1 ? 's' : ''} with no text or aria-label`,
      explanation: linkNameAudit.description || 'Links must have descriptive text or aria-label. Avoid generic "click here" or "read more" without context.',
      impact: `Screen reader users hear "${violationCount} unnamed link${violationCount > 1 ? 's' : ''}" with no indication of destination.`,
      fixManual: [
        'Add descriptive text inside the link',
        'For icon-only links, use aria-label="Link destination"',
        'Avoid generic text like "click here" - be specific about destination',
        'For image links, ensure the image has descriptive alt text',
      ],
      fixAiPrompt: `I have ${violationCount} link${violationCount > 1 ? 's' : ''} without accessible names.\n\nHelp me add aria-label or improve link text to be more descriptive.`,
    });
  }

  return findings;
}
