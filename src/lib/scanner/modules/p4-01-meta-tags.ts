/**
 * P4-01: Meta Tags & Titles Module
 * Phase 7.5: SEO Scanning
 * 
 * SEO Best Practices:
 * - Title: 50-60 characters, unique per page
 * - Meta description: 150-160 characters, compelling CTR copy
 * - Canonical URL: Prevents duplicate content issues
 * 
 * Detects:
 * - Missing or empty document title
 * - Missing or empty meta description
 * - Title too long/short
 * - Description too long/short
 * - Missing canonical URL
 */

import * as cheerio from 'cheerio';
import type { CrawlResult, RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';
import { corroborate, type SourceObservation } from './seo-corroborate';
import { resolveCanonicalChain } from '../tools/seo-fetch';

export async function runMetaTagsModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.seoIssues || metrics.seoIssues.length === 0) {
    return findings;
  }

  // Check for document title issues
  const titleAudit = metrics.seoIssues.find(audit => audit.id === 'document-title');
  
  if (titleAudit && titleAudit.score !== null && titleAudit.score < 1) {
    findings.push({
      moduleId: 'P4-01',
      severity: 'HIGH',
      category: 'SEO',
      title: 'Missing or improper document title',
      location: 'HTML <head> element',
      evidence: titleAudit.displayValue || 'Document does not have a <title> element',
      explanation: titleAudit.description || 'The title element is critical for SEO. It appears in search results as the clickable headline and in browser tabs. Google typically displays the first 50-60 characters of a title tag.',
      impact: 'Search engines may not properly index this page. Users won\'t see a descriptive title in search results, reducing click-through rate (CTR). Missing titles can result in Google using less relevant text from the page.',
      fixManual: [
        'Add a unique <title> element to the <head> section',
        'Keep it 50-60 characters (Google truncates longer titles)',
        'Include primary keyword near the beginning',
        'Make it compelling for users (improves CTR)',
        'Format: "Primary Keyword - Secondary Keyword | Brand Name"',
        'Each page should have a unique title',
      ],
      fixAiPrompt: 'My page is missing a proper <title> element.\n\nHelp me:\n1. Write an SEO-optimized title (50-60 characters)\n2. Include relevant keywords\n3. Make it compelling for users\n4. Follow current SEO best practices',
    });
  }

  // Check for meta description issues
  const descriptionAudit = metrics.seoIssues.find(audit => audit.id === 'meta-description');
  
  if (descriptionAudit && descriptionAudit.score !== null && descriptionAudit.score < 1) {
    findings.push({
      moduleId: 'P4-01',
      severity: 'MEDIUM',
      category: 'SEO',
      title: 'Missing or improper meta description',
      location: 'HTML <head> element',
      evidence: descriptionAudit.displayValue || 'Document does not have a meta description',
      explanation: descriptionAudit.description || 'Meta descriptions provide a summary of the page content in search results. While not a direct ranking factor, they significantly impact click-through rate (CTR). Google shows up to 155-160 characters.',
      impact: 'Google will auto-generate a description from page content, which may not be optimal. Lower CTR from search results as users don\'t see compelling preview text. Missed opportunity to include call-to-action.',
      fixManual: [
        'Add <meta name="description" content="..."> to <head>',
        'Keep it 150-160 characters (Google truncates longer)',
        'Write compelling copy that encourages clicks',
        'Include primary keyword naturally',
        'Add a call-to-action when appropriate',
        'Make each page\'s description unique',
      ],
      fixAiPrompt: 'My page is missing a meta description.\n\nHelp me write a compelling meta description that:\n1. Is 150-160 characters\n2. Includes relevant keywords naturally\n3. Encourages users to click\n4. Accurately describes the page content',
    });
  }

  // Check for canonical URL issues
  const canonicalAudit = metrics.seoIssues.find(audit => audit.id === 'canonical');
  
  if (canonicalAudit && canonicalAudit.score !== null && canonicalAudit.score < 1) {
    findings.push({
      moduleId: 'P4-01',
      severity: 'MEDIUM',
      category: 'SEO',
      title: 'Canonical URL issue detected',
      location: 'HTML <head> element',
      evidence: canonicalAudit.displayValue || 'Canonical URL issue',
      explanation: canonicalAudit.description || 'Canonical URLs tell search engines which version of a page is the "master" copy. This prevents duplicate content issues when the same content is accessible via multiple URLs (e.g., with/without www, http/https, trailing slash).',
      impact: 'Search engines may split ranking signals across duplicate URLs, weakening SEO performance. Risk of duplicate content penalties. Confusion about which URL to rank.',
      fixManual: [
        'Add <link rel="canonical" href="https://example.com/page"> to <head>',
        'Point to the preferred version of the URL',
        'Use absolute URLs (not relative)',
        'Ensure canonical URL is accessible (returns 200)',
        'Self-referencing canonical is OK and recommended',
        'Update internal links to use canonical version',
      ],
      fixAiPrompt: 'My page has canonical URL issues.\n\nHelp me:\n1. Determine the correct canonical URL for this page\n2. Add proper canonical link tag\n3. Fix any duplicate content issues\n4. Ensure all internal links use canonical URLs',
    });
  }

  // Check for HTTP status code issues
  const httpStatusAudit = metrics.seoIssues.find(audit => audit.id === 'http-status-code');
  
  if (httpStatusAudit && httpStatusAudit.score !== null && httpStatusAudit.score < 1) {
    findings.push({
      moduleId: 'P4-01',
      severity: 'HIGH',
      category: 'SEO',
      title: 'HTTP status code issue detected',
      location: 'Server response',
      evidence: httpStatusAudit.displayValue || 'Page returned unsuccessful HTTP status code',
      explanation: httpStatusAudit.description || 'Search engines cannot index pages that return unsuccessful HTTP status codes (4xx, 5xx). Pages should return 200 (OK) for normal content or 301 (permanent redirect) for moved content.',
      impact: 'Page will not be indexed by search engines. Users may see error pages. Existing search rankings will be lost.',
      fixManual: [
        'Ensure page returns HTTP 200 (OK) status',
        'Use 301 redirects for permanently moved pages',
        'Fix any 404 (Not Found) errors',
        'Resolve 5xx server errors immediately',
        'Check server configuration and routing',
      ],
      fixAiPrompt: 'My page is returning an unsuccessful HTTP status code.\n\nHelp me diagnose and fix the issue.',
    });
  }

  return findings;
}

/**
 * Phase 3.11 depth checks for P4-01: viewport meta, <html lang>, and canonical
 * chain resolution. Crawl-driven so they still run when the PageSpeed API is
 * down; `metrics` is an optional corroboration source only. Returns findings
 * additive to the legacy Lighthouse-derived ones — never mutates them.
 */
export async function runMetaTagsDepthChecks(
  crawl: CrawlResult,
  metrics?: LighthouseMetrics,
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const html =
    crawl.renderedHtml && crawl.renderMode !== 'fetch-only'
      ? crawl.renderedHtml
      : crawl.html;
  if (!html) return findings;

  const $ = cheerio.load(html);

  // ── <meta name="viewport"> ────────────────────────────────────────────────
  const viewport = $('meta[name="viewport"]').attr('content')?.trim() ?? null;
  if (!viewport) {
    const { severity, confidence } = corroborate(
      [{ source: 'cheerio', failed: true }],
      'MEDIUM',
    );
    findings.push({
      moduleId: 'P4-01',
      severity,
      confidence,
      category: 'SEO',
      title: 'Missing responsive viewport meta tag',
      location: 'HTML <head> element',
      evidence: 'No <meta name="viewport"> found in the document head',
      explanation:
        'Without a viewport meta tag, mobile browsers render the page at a desktop width and zoom out. Google uses mobile-first indexing, so a non-responsive page is penalised in mobile search.',
      impact:
        'Lower mobile search ranking and a poor mobile UX (tiny, zoomed-out text).',
      fixManual: [
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.',
        'Verify the layout is responsive at the resulting widths.',
      ],
      fixAiPrompt:
        'My page has no responsive viewport meta tag. Add the correct <meta name="viewport"> tag and confirm my CSS layout is mobile-responsive.',
    });
  } else if (!/width\s*=\s*device-width/i.test(viewport)) {
    const { severity, confidence } = corroborate(
      [{ source: 'cheerio', failed: true }],
      'MEDIUM',
    );
    findings.push({
      moduleId: 'P4-01',
      severity,
      confidence,
      category: 'SEO',
      title: 'Viewport meta tag is not responsive',
      location: 'HTML <head> element',
      evidence: `<meta name="viewport" content="${viewport}">`,
      explanation:
        'The viewport tag is present but does not set width=device-width, so mobile browsers will not scale the layout to the device. Google mobile-first indexing expects a responsive viewport.',
      impact: 'Degraded mobile UX and mobile search ranking.',
      fixManual: [
        'Set content to "width=device-width, initial-scale=1".',
        'Avoid fixed pixel widths or user-scalable=no.',
      ],
      fixAiPrompt: `My viewport meta tag is "${viewport}" which is not responsive. Fix it to "width=device-width, initial-scale=1" and check my layout still works.`,
    });
  }

  // ── <html lang="…"> ───────────────────────────────────────────────────────
  const lang = $('html').attr('lang')?.trim() ?? '';
  if (!lang) {
    const { severity, confidence } = corroborate(
      [{ source: 'cheerio', failed: true }],
      'MEDIUM',
    );
    findings.push({
      moduleId: 'P4-01',
      severity,
      confidence,
      category: 'SEO',
      title: 'Missing <html lang> attribute',
      location: '<html> element',
      evidence: 'The <html> element has no lang attribute',
      explanation:
        'The lang attribute tells search engines and assistive tech which language the page is in. It affects language-targeted search results and is a baseline accessibility/SEO signal.',
      impact:
        'Search engines may mis-classify the page language; screen readers may use the wrong pronunciation.',
      fixManual: [
        'Add a lang attribute to <html>, e.g. <html lang="en">.',
        'Use a valid BCP-47 code (en, en-US, fr, de-DE, …).',
      ],
      fixAiPrompt:
        'My <html> element is missing the lang attribute. Add the correct BCP-47 language code for my site content.',
    });
  }

  // ── Canonical chain resolution ────────────────────────────────────────────
  const canonicalHref = $('link[rel="canonical"]').attr('href')?.trim();
  if (canonicalHref) {
    let canonicalAbs: string | null = null;
    try {
      canonicalAbs = new URL(canonicalHref, crawl.finalUrl).href;
    } catch {
      canonicalAbs = null;
    }

    if (canonicalAbs) {
      const chain = await resolveCanonicalChain(canonicalAbs);
      const lhCanonicalFailed = !!metrics?.seoIssues?.find(
        (a) => a.id === 'canonical' && a.score !== null && a.score < 1,
      );

      let problem: string | null = null;
      if (chain.loop) problem = 'redirect loop';
      else if (chain.blocked) problem = 'points to a private/blocked address';
      else if (
        chain.finalStatus !== null &&
        (chain.finalStatus < 200 || chain.finalStatus >= 300)
      ) {
        problem = `resolves to HTTP ${chain.finalStatus}`;
      }

      if (problem) {
        const observations: SourceObservation[] = [
          { source: 'cheerio', failed: true },
          { source: 'direct-fetch', failed: true },
        ];
        if (metrics?.seoIssues) {
          observations.push({ source: 'lighthouse', failed: lhCanonicalFailed });
        }
        const { severity, confidence } = corroborate(observations, 'HIGH');
        findings.push({
          moduleId: 'P4-01',
          severity,
          confidence,
          category: 'SEO',
          title: `Canonical URL ${problem}`,
          location: 'HTML <head> element',
          evidence: `<link rel="canonical" href="${canonicalHref}"> → ${problem} (after ${chain.hops} hop${chain.hops === 1 ? '' : 's'})`,
          explanation:
            'A canonical URL must resolve to a single, stable 2xx page. Loops, redirects to blocked hosts, or non-2xx canonicals leave search engines unable to pick the authoritative URL, splitting or dropping ranking signals.',
          impact:
            'Search engines may ignore the canonical and index duplicates, or drop the page entirely.',
          fixManual: [
            'Point rel=canonical at the final, self-resolving 2xx URL.',
            'Remove redirect chains on the canonical target.',
            'Use an absolute https URL that returns 200.',
          ],
          fixAiPrompt: `My canonical URL "${canonicalHref}" ${problem}. Help me set rel=canonical to the correct stable 200 URL and remove the redirect chain.`,
        });
      }
    }
  }

  return findings;
}
