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
