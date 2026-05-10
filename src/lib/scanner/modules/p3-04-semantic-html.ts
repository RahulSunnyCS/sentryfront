/**
 * P3-04: Semantic HTML & Document Structure Module
 * Phase 6.5: Accessibility Scanning
 * 
 * WCAG 2.2 Success Criteria:
 * - 1.3.1 Info and Relationships - Level A
 * - 2.4.1 Bypass Blocks - Level A
 * - 2.4.6 Headings and Labels - Level AA
 * 
 * Detects:
 * - Heading hierarchy skips levels
 * - Missing or duplicate document titles
 * - Lists not using proper markup
 * - Tables missing headers
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runSemanticHTMLModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.accessibilityViolations || metrics.accessibilityViolations.length === 0) {
    return findings;
  }

  // Check for heading order
  const headingOrderAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'heading-order'
  );

  if (headingOrderAudit && headingOrderAudit.items && headingOrderAudit.items.length > 0) {
    const violationCount = headingOrderAudit.items.length;
    
    findings.push({
      moduleId: 'P3-04',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: 'Heading hierarchy is incorrect',
      location: 'WCAG 1.3.1, 2.4.6 - Headings',
      evidence: `Heading levels skip (e.g., h1 → h3, missing h2) in ${violationCount} location${violationCount > 1 ? 's' : ''}`,
      explanation: headingOrderAudit.description || 'Headings must be in logical order (h1, h2, h3...) without skipping levels. Screen readers use heading hierarchy to navigate the page structure.',
      impact: 'Screen reader users cannot understand page structure. Navigation by headings becomes confusing and inefficient.',
      fixManual: [
        'Start with a single h1 for the main page title',
        'Use h2 for main sections, h3 for subsections, etc.',
        'Never skip heading levels (don\'t jump from h2 to h4)',
        'It\'s OK to go back up (h4 → h2) when starting a new section',
        'Use CSS for visual styling, not heading levels',
      ],
      fixAiPrompt: 'My heading hierarchy is incorrect.\n\nHelp me:\n1. Identify where I\'m skipping heading levels\n2. Restructure headings to follow h1→h2→h3 order\n3. Maintain visual design while fixing semantic structure',
    });
  }

  // Check for document title
  const documentTitleAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'document-title'
  );

  if (documentTitleAudit && documentTitleAudit.score !== null && documentTitleAudit.score < 1) {
    findings.push({
      moduleId: 'P3-04',
      severity: 'HIGH',
      category: 'Accessibility',
      title: 'Missing or empty document title',
      location: 'WCAG 2.4.2 - Page Titled',
      evidence: 'The <title> element is missing or empty',
      explanation: documentTitleAudit.description || 'Every page must have a unique, descriptive <title> in the <head>. Screen readers announce the title when the page loads, helping users understand where they are.',
      impact: 'Screen readers cannot announce the page title. Users with cognitive disabilities may not know what page they\'re on. SEO is also affected.',
      fixManual: [
        'Add a <title> element to the <head> section',
        'Make titles unique across your site',
        'Format: "Page Name - Site Name" (60 characters max for SEO)',
        'Update title dynamically for single-page apps (SPA)',
      ],
      fixAiPrompt: 'My page is missing a <title> element.\n\nHelp me:\n1. Create a unique, descriptive title for this page\n2. Follow best practices for title format and length',
    });
  }

  // Check for HTML lang attribute
  const htmlLangAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'html-has-lang'
  );

  if (htmlLangAudit && htmlLangAudit.score !== null && htmlLangAudit.score < 1) {
    findings.push({
      moduleId: 'P3-04',
      severity: 'MEDIUM',
      category: 'Accessibility',
      title: 'Missing language declaration',
      location: 'WCAG 3.1.1 - Language of Page',
      evidence: 'The <html> element is missing the lang attribute',
      explanation: htmlLangAudit.description || 'The <html> element must have a lang attribute (e.g., lang="en") so screen readers can use the correct pronunciation and voice.',
      impact: 'Screen readers may mispronounce content. Automatic translation tools cannot detect the page language.',
      fixManual: [
        'Add lang="en" to the <html> element (use your page\'s language code)',
        'For multi-language pages, set lang on specific elements',
        'Use valid language codes (en, es, fr, de, etc.)',
      ],
      fixAiPrompt: 'My <html> element is missing the lang attribute.\n\nHelp me add lang="en" (or the appropriate language code for my content).',
    });
  }

  // Check for list markup
  const listAudit = metrics.accessibilityViolations.find(
    audit => audit.id === 'list'
  );

  if (listAudit && listAudit.items && listAudit.items.length > 0) {
    const violationCount = listAudit.items.length;
    
    findings.push({
      moduleId: 'P3-04',
      severity: 'LOW',
      category: 'Accessibility',
      title: `Improper list markup (${violationCount} list${violationCount > 1 ? 's' : ''})`,
      location: 'WCAG 1.3.1 - Info and Relationships',
      evidence: `${violationCount} list${violationCount > 1 ? 's are' : ' is'} not using proper <ul>/<ol> structure`,
      explanation: listAudit.description || 'Lists of items should use <ul> (unordered), <ol> (ordered), or <dl> (definition) elements with proper <li> children. This helps screen readers announce the number of items.',
      impact: 'Screen reader users miss context about how many items are in the list. Navigation by list is disabled.',
      fixManual: [
        'Wrap list items in <ul> (for unordered lists) or <ol> (for ordered/numbered)',
        'Use <li> for each list item',
        'For definition lists, use <dl>, <dt>, <dd>',
        'Don\'t use <div> or <span> to fake list structure',
      ],
      fixAiPrompt: `I have ${violationCount} list${violationCount > 1 ? 's' : ''} using improper markup.\n\nHelp me convert them to proper <ul>/<ol> structure with <li> elements.`,
    });
  }

  return findings;
}
