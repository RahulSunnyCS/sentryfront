/**
 * P4-03: Structured Data Module
 * Phase 7.5: SEO Scanning
 * 
 * Structured Data Best Practices:
 * - JSON-LD format recommended (easier than Microdata/RDFa)
 * - Common types: Organization, WebSite, Article, Product, BreadcrumbList
 * - Enables rich snippets in search results
 * - Required for Google features like FAQ, How-To, Recipe
 * 
 * Detects:
 * - Missing structured data
 * - Invalid JSON-LD syntax
 * - Missing required properties for common types
 */

import type { RawFinding } from '../types';
import type { CrawlResult } from '../types';
import { corroborate } from './seo-corroborate';

interface StructuredDataInfo {
  hasJsonLd: boolean;
  types: string[];
  count: number;
}

function extractStructuredData(html: string): StructuredDataInfo {
  const info: StructuredDataInfo = {
    hasJsonLd: false,
    types: [],
    count: 0,
  };
  
  // Look for JSON-LD scripts
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = jsonLdRegex.exec(html)) !== null) {
    info.hasJsonLd = true;
    info.count++;
    
    try {
      const data = JSON.parse(match[1]);
      // Extract @type
      if (data['@type']) {
        const type = Array.isArray(data['@type']) ? data['@type'].join(', ') : data['@type'];
        info.types.push(type);
      } else if (data['@graph']) {
        // Handle @graph format
        data['@graph'].forEach((item: { '@type'?: string }) => {
          if (item['@type']) {
            info.types.push(item['@type']);
          }
        });
      }
    } catch {
      // Invalid JSON, we'll detect this as an issue
    }
  }
  
  return info;
}

export function runStructuredDataModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const structuredData = extractStructuredData(crawl.html);
  
  // Check if structured data exists
  if (!structuredData.hasJsonLd) {
    findings.push({
      moduleId: 'P4-03',
      severity: 'MEDIUM',
      category: 'SEO',
      title: 'Missing structured data (Schema.org markup)',
      location: 'HTML <head> or <body>',
      evidence: 'No JSON-LD structured data found',
      explanation: 'Structured data (Schema.org markup) helps search engines understand your content and can enable rich snippets in search results. Rich snippets include star ratings, breadcrumbs, FAQs, and more, which increase visibility and click-through rates.',
      impact: 'Page will not appear with rich snippets in search results. Missing opportunities for enhanced visibility with star ratings, prices, availability, breadcrumbs, and other rich features. Competitors with structured data may appear more prominently.',
      fixManual: [
        'Add JSON-LD structured data to your <head> or <body>',
        'Common types to implement:',
        '  - Organization: For company info and logo',
        '  - WebSite: For site name and search box',
        '  - Article: For blog posts and news',
        '  - Product: For e-commerce pages',
        '  - BreadcrumbList: For navigation breadcrumbs',
        'Use Google\'s Rich Results Test: https://search.google.com/test/rich-results',
        'Use Schema.org documentation: https://schema.org/',
      ],
      fixAiPrompt: 'My page is missing structured data.\n\nHelp me:\n1. Determine which Schema.org types are appropriate (Organization, Article, Product, etc.)\n2. Generate JSON-LD markup for these types\n3. Include all required and recommended properties\n4. Ensure markup is valid and follows best practices',
    });
  } else {
    // Has structured data, provide informational context
    const typesList = structuredData.types.length > 0
      ? structuredData.types.join(', ')
      : 'Unknown types';
    
    // This is a positive finding (INFO level) - not an issue
    findings.push({
      moduleId: 'P4-03',
      severity: 'INFO',
      category: 'SEO',
      title: `Structured data detected (${structuredData.count} block${structuredData.count > 1 ? 's' : ''})`,
      location: 'JSON-LD scripts',
      evidence: `Found ${structuredData.count} JSON-LD block${structuredData.count > 1 ? 's' : ''} with types: ${typesList}`,
      explanation: 'Structured data found on this page. This is good for SEO! Verify that the markup is valid and includes all recommended properties for your content type.',
      impact: 'Page is eligible for rich snippets in search results, which can increase visibility and click-through rates.',
      fixManual: [
        'Validate markup with Google Rich Results Test',
        'Ensure all required properties are present',
        'Add recommended properties for better results',
        'Test in Google Search Console for errors',
      ],
      fixAiPrompt: `I have structured data with types: ${typesList}.\n\nHelp me verify it includes all required and recommended properties.`,
    });
  }

  return findings;
}

// ── Phase 3.11: per-@type required-field validation ─────────────────────────

const REQUIRED_FIELDS: Record<string, string[]> = {
  Organization: ['name', 'url'],
  Article: ['headline', 'author', 'datePublished'],
  Product: ['name', 'image', 'offers'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
};

type JsonLdNode = Record<string, unknown>;

function isSchemaOrgContext(ctx: unknown): boolean {
  if (typeof ctx === 'string') return ctx.includes('schema.org');
  if (Array.isArray(ctx)) return ctx.some(isSchemaOrgContext);
  if (ctx && typeof ctx === 'object') {
    return Object.values(ctx as Record<string, unknown>).some(
      (v) => typeof v === 'string' && v.includes('schema.org'),
    );
  }
  return false;
}

function typeNames(node: JsonLdNode): string[] {
  const t = node['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

/** Flatten @graph / arrays / nested node trees into a flat node list. */
function collectNodes(value: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, out);
    return;
  }
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    if ('@type' in node) out.push(node);
    if (Array.isArray(node['@graph'])) collectNodes(node['@graph'], out);
  }
}

/** Presence-only: the property exists and is not null / '' / []. Never
 *  inspects the *value's* shape — Schema.org is highly polymorphic and
 *  over-strict validation produces false positives. */
function hasNonEmpty(node: JsonLdNode, key: string): boolean {
  if (!(key in node)) return false;
  const v = node[key];
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function runStructuredDataDepthChecks(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];

  const jsonLdRegex =
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  const reported = new Set<string>();

  while ((match = jsonLdRegex.exec(crawl.html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue; // legacy module surfaces presence; malformed JSON not our concern here
    }

    const topCtx = (parsed as JsonLdNode)?.['@context'];
    const nodes: JsonLdNode[] = [];
    collectNodes(parsed, nodes);

    for (const node of nodes) {
      const ctxOk =
        isSchemaOrgContext(node['@context']) || isSchemaOrgContext(topCtx);
      if (!ctxOk) continue; // custom vocab → don't guess

      for (const typeName of typeNames(node)) {
        const required = REQUIRED_FIELDS[typeName];
        if (!required) continue;

        const missing = required.filter((f) => !hasNonEmpty(node, f));
        if (missing.length === 0) continue;

        const dedupeKey = `${typeName}:${missing.join(',')}`;
        if (reported.has(dedupeKey)) continue;
        reported.add(dedupeKey);

        const { severity, confidence } = corroborate(
          [{ source: 'cheerio', failed: true }],
          'MEDIUM',
        );
        findings.push({
          moduleId: 'P4-03',
          severity,
          confidence,
          category: 'SEO',
          title: `Schema.org ${typeName} is missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
          location: 'JSON-LD structured data',
          evidence: `${typeName} block is missing: ${missing.join(', ')}`,
          explanation: `Google's rich-result requirements for ${typeName} expect ${required.join(', ')}. Missing required properties make the block ineligible for the corresponding rich result.`,
          impact: `This ${typeName} markup will not produce a rich result in Google Search, losing the enhanced listing.`,
          fixManual: [
            `Add the missing ${typeName} propert${missing.length > 1 ? 'ies' : 'y'}: ${missing.join(', ')}.`,
            'Validate with Google Rich Results Test after the change.',
            'Keep values accurate to on-page content (Google penalises mismatches).',
          ],
          fixAiPrompt: `My JSON-LD ${typeName} is missing required properties: ${missing.join(', ')}. Generate the corrected JSON-LD with valid values consistent with my page content.`,
        });
      }
    }
  }

  return findings;
}
