/**
 * P4-04: Crawlability & Indexing Module  
 * Phase 7.5: SEO Scanning
 * 
 * Crawlability Best Practices:
 * - robots.txt should allow search engine access
 * - Sitemap.xml should exist and be accessible
 * - No noindex tags unless intentional
 * - Links should be crawlable (not JavaScript-only)
 * 
 * Detects:
 * - Blocking robots.txt rules
 * - Missing sitemap
 * - noindex meta tags
 * - JavaScript-only navigation
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runCrawlabilityModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.seoIssues || metrics.seoIssues.length === 0) {
    return findings;
  }

  // Check for robots.txt issues
  const robotsTxtAudit = metrics.seoIssues.find(audit => audit.id === 'robots-txt');
  
  if (robotsTxtAudit && robotsTxtAudit.score !== null && robotsTxtAudit.score < 1) {
    findings.push({
      moduleId: 'P4-04',
      severity: 'MEDIUM',
      category: 'SEO',
      title: 'robots.txt has issues',
      location: '/robots.txt',
      evidence: robotsTxtAudit.displayValue || 'robots.txt is invalid or blocks search engines',
      explanation: robotsTxtAudit.description || 'robots.txt file controls which parts of your site search engines can crawl. Invalid syntax or overly restrictive rules can prevent search engines from indexing your content.',
      impact: 'Search engines may be unable to crawl important pages, resulting in missing or incomplete search results. Invalid robots.txt can cause indexing errors.',
      fixManual: [
        'Check robots.txt syntax for errors',
        'Ensure important pages are not disallowed',
        'Use User-agent: * for general rules',
        'Add sitemap location: Sitemap: https://example.com/sitemap.xml',
        'Test with Google Search Console robots.txt Tester',
      ],
      fixAiPrompt: 'My robots.txt has issues.\n\nHelp me create a proper robots.txt file that allows search engines while protecting sensitive paths.',
    });
  }

  // Check if page is crawlable
  const isCrawlableAudit = metrics.seoIssues.find(audit => audit.id === 'is-crawlable');
  
  if (isCrawlableAudit && isCrawlableAudit.score !== null && isCrawlableAudit.score < 1) {
    findings.push({
      moduleId: 'P4-04',
      severity: 'HIGH',
      category: 'SEO',
      title: 'Page is not crawlable',
      location: 'HTTP response or meta tags',
      evidence: isCrawlableAudit.displayValue || 'Page blocks search engine crawlers',
      explanation: isCrawlableAudit.description || 'Page has noindex tag, X-Robots-Tag header, or robots.txt blocks crawlers. This prevents search engines from indexing the page.',
      impact: 'Page will not appear in search results. All SEO value is lost. Users cannot find this page via search engines.',
      fixManual: [
        'Remove <meta name="robots" content="noindex"> if present',
        'Remove X-Robots-Tag: noindex HTTP header',
        'Check robots.txt doesn\'t block this URL',
        'Ensure the page is intended to be indexed',
      ],
      fixAiPrompt: 'My page is blocked from search engine crawlers.\n\nHelp me identify and remove the blocking directive while keeping intentional restrictions.',
    });
  }

  // Check for crawlable anchors (JavaScript links)
  const crawlableAnchorsAudit = metrics.seoIssues.find(audit => audit.id === 'crawlable-anchors');
  
  if (crawlableAnchorsAudit && crawlableAnchorsAudit.score !== null && crawlableAnchorsAudit.score < 1) {
    const linkCount = crawlableAnchorsAudit.items?.length || 0;
    
    findings.push({
      moduleId: 'P4-04',
      severity: 'MEDIUM',
      category: 'SEO',
      title: `JavaScript-only links detected (${linkCount} link${linkCount !== 1 ? 's' : ''})`,
      location: 'Navigation links',
      evidence: `${linkCount} link${linkCount !== 1 ? 's use' : ' uses'} JavaScript instead of proper <a href> tags`,
      explanation: crawlableAnchorsAudit.description || 'Links that only work with JavaScript (e.g., onClick handlers without href) cannot be followed by search engine crawlers. This prevents search engines from discovering linked pages.',
      impact: 'Search engines cannot discover or index pages only accessible via JavaScript links. Internal link equity is not passed. Site structure is invisible to search engines.',
      fixManual: [
        'Convert JavaScript links to proper <a href="..."> tags',
        'Add href attribute even if using onClick handlers',
        'Use progressive enhancement (href works without JS)',
        'For SPAs, ensure navigation URLs are in href attributes',
        'Implement proper routing with pushState/replaceState',
      ],
      fixAiPrompt: `I have ${linkCount} JavaScript-only link${linkCount !== 1 ? 's' : ''} that search engines can't crawl.\n\nHelp me convert these to proper anchor tags with href attributes while maintaining functionality.`,
    });
  }

  // Check for link text quality
  const linkTextAudit = metrics.seoIssues.find(audit => audit.id === 'link-text');
  
  if (linkTextAudit && linkTextAudit.score !== null && linkTextAudit.score < 1) {
    const linkCount = linkTextAudit.items?.length || 0;
    
    findings.push({
      moduleId: 'P4-04',
      severity: 'LOW',
      category: 'SEO',
      title: `Generic link text detected (${linkCount} link${linkCount !== 1 ? 's' : ''})`,
      location: 'Anchor text',
      evidence: `${linkCount} link${linkCount !== 1 ? 's use' : ' uses'} generic text like "click here" or "read more"`,
      explanation: linkTextAudit.description || 'Descriptive link text helps search engines understand the destination page\'s content. Generic phrases like "click here" provide no context.',
      impact: 'Reduced SEO value of internal links. Search engines cannot determine linked page topics from context. Lower accessibility for screen reader users.',
      fixManual: [
        'Replace "click here" with descriptive text',
        'Replace "read more" with specific action or topic',
        'Include keywords that describe the destination',
        'Make link text meaningful out of context',
        'Example: "Learn about SEO optimization" instead of "Click here"',
      ],
      fixAiPrompt: `I have ${linkCount} link${linkCount !== 1 ? 's' : ''} with generic text.\n\nHelp me write descriptive link text that provides context and includes relevant keywords.`,
    });
  }

  return findings;
}
