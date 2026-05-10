/**
 * PageSpeed Insights API Integration
 * Phase 5.5: Performance Scanning
 * Phase 6.5: Accessibility Scanning
 *
 * Uses Google PageSpeed Insights API to get Lighthouse performance and accessibility data.
 * This replaces direct Lighthouse integration to work in serverless environments.
 *
 * API Documentation: https://developers.google.com/speed/docs/insights/v5/get-started
 * Free Tier: 25,000 requests/day (no API key needed for basic usage)
 *
 * Categories supported:
 * - performance: Core Web Vitals, resource optimization, network efficiency
 * - accessibility: WCAG 2.2 Level AA compliance checking
 * - seo: Search engine optimization (Phase 7.5)
 * - best-practices: General web standards (Phase 9.5)
 */

import { logger } from '../logger';
import { parseAudit, type ParsedAudit } from './audit-parser';

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY; // Optional: increases quota
const PAGESPEED_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 1; // Retry once on transient failures

export interface LighthouseMetrics {
  // Core Web Vitals (2025 thresholds)
  lcp: number | null; // Largest Contentful Paint (ms) - GOOD < 2000ms
  fcp: number | null; // First Contentful Paint (ms) - GOOD < 1500ms
  cls: number | null; // Cumulative Layout Shift - GOOD < 0.08
  tbt: number | null; // Total Blocking Time (ms) - GOOD < 200ms
  tti: number | null; // Time to Interactive (ms)
  si: number | null;  // Speed Index (ms)

  // Additional performance metrics
  ttfb: number | null; // Time to First Byte (ms) - GOOD < 800ms

  // Scores (0-1 range)
  performanceScore: number | null; // Overall Lighthouse performance score
  accessibilityScore: number | null; // Accessibility score (WCAG 2.2 Level AA)
  seoScore: number | null; // SEO score

  // Opportunities for improvement (with full parsed audit data)
  opportunities: ParsedAudit[];

  // Accessibility violations (WCAG audits)
  accessibilityViolations: ParsedAudit[];

  // SEO issues (meta tags, structured data, crawlability)
  seoIssues: ParsedAudit[];
}

export interface LighthouseConfig {
  onlyCategories?: string[];
  throttling?: {
    rttMs: number;
    throughputKbps: number;
    cpuSlowdownMultiplier: number;
  };
  formFactor?: 'mobile' | 'desktop';
}

/**
 * Run PageSpeed Insights API audit on target URL
 *
 * FAIL-SAFE: Returns empty metrics if API fails (rate limit, network error, etc.)
 * This allows security scanning to continue even if performance scanning fails.
 */
export async function runLighthouse(
  targetUrl: string,
  config: LighthouseConfig = {}
): Promise<LighthouseMetrics> {
  const emptyMetrics: LighthouseMetrics = {
    lcp: null,
    fcp: null,
    cls: null,
    tbt: null,
    tti: null,
    si: null,
    ttfb: null,
    performanceScore: null,
    accessibilityScore: null,
    seoScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
  };

  try {
    logger.info('Calling PageSpeed Insights API', { url: targetUrl });

    const strategy = config.formFactor === 'desktop' ? 'desktop' : 'mobile';

    // Build PageSpeed Insights API URL
    // Request performance, accessibility, and SEO categories
    const params = new URLSearchParams({
      url: targetUrl,
      strategy,
    });

    // Add categories (can add multiple)
    params.append('category', 'performance');
    params.append('category', 'accessibility');
    params.append('category', 'seo');

    // Add API key if configured (optional but recommended for higher quota)
    if (PAGESPEED_API_KEY) {
      params.append('key', PAGESPEED_API_KEY);
    }

    const apiUrl = `${PAGESPEED_API_URL}?${params.toString()}`;

    // Call PageSpeed Insights API with timeout and retry logic
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= MAX_RETRIES) {
      attempt++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS);

        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'VibeSafe/1.0 (https://vibesafe.app)',
          },
        });

        clearTimeout(timeoutId);

        // Handle rate limiting (HTTP 429) - FAIL-SAFE
        if (response.status === 429) {
          logger.warn('PageSpeed Insights API rate limit exceeded', {
            url: targetUrl,
            attempt,
            retryAfter: response.headers.get('Retry-After'),
          });

          // If we have retries left, wait and retry
          if (attempt <= MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
            continue;
          }

          // Out of retries - return empty metrics (FAIL-SAFE: scan continues)
          logger.error('PageSpeed Insights API rate limit - returning empty metrics', { url: targetUrl });
          return emptyMetrics;
        }

        // Handle quota exceeded (HTTP 403) - FAIL-SAFE
        if (response.status === 403) {
          logger.error('PageSpeed Insights API quota exceeded or invalid API key', {
            url: targetUrl,
            hasApiKey: !!PAGESPEED_API_KEY,
          });
          return emptyMetrics; // FAIL-SAFE: scan continues without performance data
        }

        // Handle other API errors
        if (!response.ok) {
          throw new Error(`PageSpeed API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Parse PageSpeed Insights response
        const lighthouseResult = data.lighthouseResult;
        if (!lighthouseResult || !lighthouseResult.audits) {
          throw new Error('Invalid PageSpeed Insights API response format');
        }

        const { audits } = lighthouseResult;

        // Extract Core Web Vitals and performance metrics
        const metrics: LighthouseMetrics = {
          lcp: audits['largest-contentful-paint']?.numericValue || null,
          fcp: audits['first-contentful-paint']?.numericValue || null,
          cls: audits['cumulative-layout-shift']?.numericValue || null,
          tbt: audits['total-blocking-time']?.numericValue || null,
          tti: audits['interactive']?.numericValue || null,
          si: audits['speed-index']?.numericValue || null,
          ttfb: audits['server-response-time']?.numericValue || null,
          performanceScore: lighthouseResult.categories?.performance?.score || null,
          accessibilityScore: lighthouseResult.categories?.accessibility?.score || null,
          seoScore: lighthouseResult.categories?.seo?.score || null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
        };

        // Extract opportunities (top issues sorted by impact)
        const opportunityAudits = [
          'unused-javascript',
          'render-blocking-resources',
          'unminified-css',
          'unminified-javascript',
          'unused-css-rules',
          'modern-image-formats',
          'uses-optimized-images',
          'uses-responsive-images',
          'offscreen-images',
          'uses-text-compression',
          'uses-long-cache-ttl',
          'uses-http2',
        ];

        for (const auditId of opportunityAudits) {
          const audit = audits[auditId];
          if (audit && audit.score !== null && audit.score < 1) {
            // Parse audit with full details including items
            const parsed = parseAudit(auditId, audit);
            metrics.opportunities.push(parsed);
          }
        }

        // Sort opportunities by impact (bytes or ms)
        metrics.opportunities.sort((a, b) => {
          const aImpact = (a.overallSavingsBytes || 0) + (a.overallSavingsMs || 0) * 100;
          const bImpact = (b.overallSavingsBytes || 0) + (b.overallSavingsMs || 0) * 100;
          return bImpact - aImpact;
        });

        // Limit to top 10 opportunities
        metrics.opportunities = metrics.opportunities.slice(0, 10);

        // Extract accessibility violations (WCAG audits that failed)
        const accessibilityAudits = [
          'color-contrast',
          'image-alt',
          'label',
          'button-name',
          'link-name',
          'document-title',
          'html-has-lang',
          'meta-viewport',
          'aria-allowed-attr',
          'aria-required-attr',
          'aria-valid-attr',
          'heading-order',
          'list',
          'listitem',
          'tabindex',
          'duplicate-id',
        ];

        for (const auditId of accessibilityAudits) {
          const audit = audits[auditId];
          if (audit && audit.score !== null && audit.score < 1) {
            // Parse audit with full details including items
            const parsed = parseAudit(auditId, audit);
            metrics.accessibilityViolations.push(parsed);
          }
        }

        // Extract SEO issues (failed SEO audits)
        const seoAudits = [
          'document-title',
          'meta-description',
          'http-status-code',
          'link-text',
          'crawlable-anchors',
          'is-crawlable',
          'robots-txt',
          'image-alt',
          'hreflang',
          'canonical',
          'font-size',
          'tap-targets',
        ];

        for (const auditId of seoAudits) {
          const audit = audits[auditId];
          if (audit && audit.score !== null && audit.score < 1) {
            // Parse audit with full details
            const parsed = parseAudit(auditId, audit);
            metrics.seoIssues.push(parsed);
          }
        }

        logger.info('PageSpeed Insights API call successful', {
          url: targetUrl,
          performanceScore: metrics.performanceScore,
          accessibilityScore: metrics.accessibilityScore,
          seoScore: metrics.seoScore,
          lcp: metrics.lcp,
          cls: metrics.cls,
          opportunities: metrics.opportunities.length,
          seoIssues: metrics.seoIssues.length,
        });

        return metrics;

      } catch (error) {
        lastError = error as Error;

        // Check if it's a timeout/abort error
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('PageSpeed Insights API timeout', {
            url: targetUrl,
            attempt,
            timeoutMs: PAGESPEED_TIMEOUT_MS,
          });
        } else {
          logger.warn('PageSpeed Insights API error', {
            url: targetUrl,
            attempt,
            error: (error as Error).message,
          });
        }

        // If we have retries left, try again
        if (attempt <= MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          continue;
        }
      }
    }

    // All retries exhausted - return empty metrics (FAIL-SAFE)
    logger.error('PageSpeed Insights API failed after all retries - returning empty metrics', {
      url: targetUrl,
      attempts: MAX_RETRIES + 1,
      error: lastError?.message,
    });

    return emptyMetrics;
  } catch (error) {
    // Top-level error handler - should rarely trigger since we handle errors in the retry loop
    logger.error('Unexpected error in PageSpeed Insights integration', {
      error: (error as Error).message,
      url: targetUrl,
    });
    return emptyMetrics; // FAIL-SAFE
  }
}
