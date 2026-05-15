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

import * as cheerio from 'cheerio';
import { XMLValidator, XMLParser } from 'fast-xml-parser';
import robotsParser from 'robots-parser';
import type { CrawlResult, RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';
import { corroborate, type SourceObservation } from './seo-corroborate';
import { fetchTextSafe } from '../tools/seo-fetch';

const SITEMAP_MAX_URLS = 50_000;
const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;
const BCP47 = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

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

// ── Phase 3.11 depth checks: hreflang, sitemap validity, sitemap-in-robots ──

function parseSitemapStructure(xml: string): {
  ok: boolean;
  reason: string;
  urlCount: number;
} {
  if (xml.length > SITEMAP_MAX_BYTES) {
    return { ok: false, reason: `exceeds ${SITEMAP_MAX_BYTES} bytes`, urlCount: 0 };
  }
  if (XMLValidator.validate(xml) !== true) {
    return { ok: false, reason: 'not well-formed XML', urlCount: 0 };
  }
  const parser = new XMLParser({ ignoreAttributes: true });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'XML parse failed', urlCount: 0 };
  }
  const rootKey = Object.keys(doc).find((k) => k !== '?xml');
  if (rootKey !== 'urlset' && rootKey !== 'sitemapindex') {
    return {
      ok: false,
      reason: `root element <${rootKey ?? 'none'}> is not <urlset> or <sitemapindex>`,
      urlCount: 0,
    };
  }
  const root = doc[rootKey] as Record<string, unknown>;
  const entries = rootKey === 'urlset' ? root.url : root.sitemap;
  const count = Array.isArray(entries) ? entries.length : entries ? 1 : 0;
  if (count > SITEMAP_MAX_URLS) {
    return {
      ok: false,
      reason: `${count} entries exceeds the ${SITEMAP_MAX_URLS}-URL sitemap limit`,
      urlCount: count,
    };
  }
  return { ok: true, reason: '', urlCount: count };
}

/**
 * Phase 3.11 depth checks for P4-04. Crawl-driven so they run even when the
 * PageSpeed API is down; `metrics` is an optional corroboration source for the
 * hreflang signal. Additive to the legacy Lighthouse-derived findings.
 */
export async function runCrawlabilityDepthChecks(
  crawl: CrawlResult,
  metrics?: LighthouseMetrics,
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  let origin: string;
  try {
    origin = new URL(crawl.finalUrl).origin;
  } catch {
    return findings;
  }

  const html =
    crawl.renderedHtml && crawl.renderMode !== 'fetch-only'
      ? crawl.renderedHtml
      : crawl.html;

  // ── hreflang ──────────────────────────────────────────────────────────────
  const lhHreflang = metrics?.seoIssues?.find(
    (a) => a.id === 'hreflang' && a.score !== null && a.score < 1,
  );
  let cheerioHreflangBad = false;
  let badCode = '';
  if (html) {
    const $ = cheerio.load(html);
    $('link[rel="alternate"][hreflang]').each((_, el) => {
      const code = ($(el).attr('hreflang') ?? '').trim();
      if (code && code.toLowerCase() !== 'x-default' && !BCP47.test(code)) {
        cheerioHreflangBad = true;
        if (!badCode) badCode = code;
      }
    });
  }
  if (lhHreflang || cheerioHreflangBad) {
    const observations: SourceObservation[] = [];
    if (metrics?.seoIssues) observations.push({ source: 'lighthouse', failed: !!lhHreflang });
    if (html) observations.push({ source: 'cheerio', failed: cheerioHreflangBad });
    const { severity, confidence } = corroborate(observations, 'MEDIUM');
    findings.push({
      moduleId: 'P4-04',
      severity,
      confidence,
      category: 'SEO',
      title: 'hreflang annotations have issues',
      location: 'HTML <head> / HTTP headers',
      evidence: cheerioHreflangBad
        ? `Invalid hreflang value: "${badCode}"`
        : lhHreflang?.displayValue || 'Lighthouse flagged invalid/incomplete hreflang',
      explanation:
        'hreflang tells Google which language/region variant to serve. Invalid BCP-47 codes or missing return links cause Google to ignore the annotations and may surface the wrong variant.',
      impact:
        'Wrong-language pages shown in regional search results; duplicate-content dilution across locales.',
      fixManual: [
        'Use valid BCP-47 codes (en, en-GB, es-419, x-default).',
        'Every variant must reference every other variant, including itself.',
        'Keep hreflang consistent between HTML, headers, and sitemap.',
      ],
      fixAiPrompt:
        'My hreflang annotations are invalid/incomplete. Help me generate a correct, fully reciprocal hreflang set (with x-default) for my locale variants.',
    });
  }

  // ── sitemap.xml structural validity + sitemap-in-robots ───────────────────
  const [sitemapXml, robotsTxt] = await Promise.all([
    fetchTextSafe(`${origin}/sitemap.xml`),
    fetchTextSafe(`${origin}/robots.txt`),
  ]);

  if (sitemapXml) {
    const structure = parseSitemapStructure(sitemapXml);
    if (!structure.ok) {
      const { severity, confidence } = corroborate(
        [{ source: 'direct-fetch', failed: true }],
        'MEDIUM',
      );
      findings.push({
        moduleId: 'P4-04',
        severity,
        confidence,
        category: 'SEO',
        title: 'sitemap.xml is structurally invalid',
        location: '/sitemap.xml',
        evidence: `sitemap.xml ${structure.reason}`,
        explanation:
          'A sitemap must be well-formed XML with a <urlset> or <sitemapindex> root and at most 50,000 URLs / 50 MB per the sitemaps.org protocol. Search engines reject sitemaps that violate this.',
        impact:
          'Search engines may ignore the entire sitemap, slowing discovery of new/updated pages.',
        fixManual: [
          'Ensure the root element is <urlset> or <sitemapindex>.',
          'Split into a sitemap index if over 50,000 URLs or 50 MB.',
          'Validate the XML is well-formed (no unescaped & or stray tags).',
        ],
        fixAiPrompt: `My sitemap.xml is invalid: ${structure.reason}. Help me produce a spec-compliant sitemap (or sitemap index) for my URLs.`,
      });
    } else {
      // sitemap valid → check it is referenced from robots.txt
      let referenced = false;
      if (robotsTxt) {
        try {
          referenced = robotsParser(`${origin}/robots.txt`, robotsTxt)
            .getSitemaps()
            .length > 0;
        } catch {
          referenced = /^\s*sitemap:\s*\S+/im.test(robotsTxt);
        }
      }
      if (!referenced) {
        const { severity, confidence } = corroborate(
          [{ source: 'direct-fetch', failed: true }],
          'LOW',
        );
        findings.push({
          moduleId: 'P4-04',
          severity,
          confidence,
          category: 'SEO',
          title: 'sitemap.xml exists but is not referenced in robots.txt',
          location: '/robots.txt',
          evidence: robotsTxt
            ? 'robots.txt has no "Sitemap:" directive'
            : 'no robots.txt found to reference the sitemap',
          explanation:
            'A valid sitemap.xml was found, but robots.txt does not advertise it via a "Sitemap:" directive. Crawlers that read robots.txt first may not discover the sitemap.',
          impact:
            'Slower or incomplete crawl discovery, especially for crawlers that do not probe /sitemap.xml directly.',
          fixManual: [
            `Add "Sitemap: ${origin}/sitemap.xml" to robots.txt.`,
            'Use the absolute URL; multiple Sitemap: lines are allowed.',
          ],
          fixAiPrompt: `My sitemap.xml is valid but not referenced in robots.txt. Add the correct "Sitemap:" directive (absolute URL) to my robots.txt.`,
        });
      }
    }
  }

  return findings;
}
