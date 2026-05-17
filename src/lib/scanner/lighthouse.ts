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
 * - best-practices: General web standards
 */

import { logger } from '../logger';
import { parseAudit, type ParsedAudit } from './audit-parser';

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY; // Optional: increases quota

// Timeout reduced to 45 s so that PAGESPEED_TIMEOUT_MS × (MAX_RETRIES+1) = 45 000 ms,
// comfortably under the 120 000 ms scan-level hard timeout.
const PAGESPEED_TIMEOUT_MS = 45000; // 45 seconds

// Retries set to 0: a retry would add another 45 s, pushing the worst-case over the
// scan timeout budget. A single attempt with aggressive client-side timeout is safer.
const MAX_RETRIES = 0;

// ─── CrUX field-data types ────────────────────────────────────────────────────
// These mirror the PSI v5 response shape exactly so consumers can forward Google's
// verbatim category labels without any self-computed bucketing.

/** One bucket entry in a CrUX metric distribution */
export interface CrUXDistribution {
  min: number;
  max?: number;
  proportion: number;
}

/**
 * A single CrUX metric as returned by PSI.
 * `percentile` is Google's p75 value.
 * `category` is Google's verbatim verdict: 'FAST' | 'AVERAGE' | 'SLOW'.
 * We never re-compute or rename these values.
 *
 * NOTE on CLS: PSI returns CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile as an
 * integer scaled ×100 (e.g. 10 means 0.10). The parser divides by 100 before
 * storing it in CrUXMetric so consumers receive the true decimal value.
 */
export interface CrUXMetric {
  percentile: number;
  category: 'FAST' | 'AVERAGE' | 'SLOW';
  distributions: CrUXDistribution[];
}

/** URL-level or origin-level CrUX block from PSI */
export interface CrUXFieldData {
  /** Google's verbatim overall verdict for this URL / origin */
  overallCategory: 'FAST' | 'AVERAGE' | 'SLOW';
  lcp: CrUXMetric | null;  // LARGEST_CONTENTFUL_PAINT_MS
  /**
   * INP (INTERACTION_TO_NEXT_PAINT) — present only in newer CrUX data.
   * Explicitly null when absent; FID is NEVER substituted here.
   */
  inp: CrUXMetric | null;  // INTERACTION_TO_NEXT_PAINT (null if absent — no FID fallback)
  /** CLS percentile is already ÷100 (PSI raw × 100 integer → true decimal) */
  cls: CrUXMetric | null;  // CUMULATIVE_LAYOUT_SHIFT_SCORE
  fcp: CrUXMetric | null;  // FIRST_CONTENTFUL_PAINT_MS
  ttfb: CrUXMetric | null; // EXPERIENCE_TIME_TO_FIRST_BYTE
}

// ─── Main metrics interface ───────────────────────────────────────────────────

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

  /**
   * Lighthouse best-practices category score (0-1) or null when absent.
   * Mirrors the pattern used by performanceScore / accessibilityScore / seoScore.
   */
  bestPracticesScore?: number | null;

  // Opportunities for improvement (with full parsed audit data)
  opportunities: ParsedAudit[];

  // Accessibility violations (WCAG audits)
  accessibilityViolations: ParsedAudit[];

  // SEO issues (meta tags, structured data, crawlability)
  seoIssues: ParsedAudit[];

  /**
   * Failed best-practices audits (score < 1, score !== null).
   * Parsed via the existing parseAudit helper.
   * Empty array when none fail or when the category is absent from the response.
   */
  bestPracticesIssues?: ParsedAudit[];

  /**
   * URL-level CrUX real-user field data (data.loadingExperience).
   * null when the block is absent from the PSI response (normal for low-traffic URLs).
   */
  fieldData?: CrUXFieldData | null;

  /**
   * Origin-level CrUX real-user field data (data.originLoadingExperience).
   * null when absent. Less precise than fieldData but available for more origins.
   */
  originFieldData?: CrUXFieldData | null;
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

// ─── CrUX parsing helper ──────────────────────────────────────────────────────

/**
 * Parse a PSI v5 loadingExperience / originLoadingExperience block into the
 * typed CrUXFieldData structure.
 *
 * Design decisions:
 * 1. Every field access is guarded — PSI omits the entire block for low-traffic
 *    URLs, and even present blocks may be missing individual metrics, so we must
 *    not throw on any absent key.
 * 2. CLS (CUMULATIVE_LAYOUT_SHIFT_SCORE) percentile is returned by PSI as an
 *    integer scaled ×100 (e.g. raw 10 → true 0.10).  We divide by 100 here so
 *    every consumer receives the real decimal value.
 * 3. INP is `INTERACTION_TO_NEXT_PAINT` — present only in newer CrUX data.
 *    When absent, `inp` is null.  We NEVER substitute FID into the INP slot
 *    because FID and INP measure different things and mixing them would produce
 *    misleading verdicts.
 * 4. We forward Google's verbatim `category` and `overall_category` labels
 *    (FAST / AVERAGE / SLOW) unchanged — no self-computed bucketing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCrUXBlock(block: any): CrUXFieldData | null {
  // The block may be absent (undefined) or an empty object — both mean no data.
  if (!block || typeof block !== 'object') return null;

  // overall_category must be present for the block to be usable.
  const overallCategory = block.overall_category as 'FAST' | 'AVERAGE' | 'SLOW';
  if (!overallCategory) return null;

  const m = block.metrics as Record<string, unknown> | undefined;

  // Parse one metric entry. Returns null if the key is missing or malformed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseMetric(raw: any, isCls = false): CrUXMetric | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.percentile === undefined || raw.percentile === null) return null;
    const category = raw.category as 'FAST' | 'AVERAGE' | 'SLOW';
    if (!category) return null;

    // CLS raw percentile is an integer scaled ×100; divide to get the true value.
    const percentile: number = isCls ? (raw.percentile as number) / 100 : (raw.percentile as number);

    const distributions: CrUXDistribution[] = Array.isArray(raw.distributions)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw.distributions.map((d: any) => ({
          min: d.min ?? 0,
          ...(d.max !== undefined ? { max: d.max } : {}),
          proportion: d.proportion ?? 0,
        }))
      : [];

    return { percentile, category, distributions };
  }

  return {
    overallCategory,
    lcp: parseMetric(m?.LARGEST_CONTENTFUL_PAINT_MS),
    // INP key is INTERACTION_TO_NEXT_PAINT — explicitly null when absent; no FID fallback.
    inp: parseMetric(m?.INTERACTION_TO_NEXT_PAINT),
    // Pass isCls=true so the ÷100 normalisation is applied.
    cls: parseMetric(m?.CUMULATIVE_LAYOUT_SHIFT_SCORE, true),
    fcp: parseMetric(m?.FIRST_CONTENTFUL_PAINT_MS),
    ttfb: parseMetric(m?.EXPERIENCE_TIME_TO_FIRST_BYTE),
  };
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
  // emptyMetrics is the fail-safe return for every error path (429, 403, timeout,
  // invalid response). ALL new optional fields must be present here so downstream
  // consumers never see undefined when they check fieldData, bestPracticesScore, etc.
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
    bestPracticesScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    bestPracticesIssues: [],
    fieldData: null,
    originFieldData: null,
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

    // Add categories (can add multiple).
    // best-practices is added here so one PSI call retrieves all four categories;
    // the PAGESPEED_TIMEOUT_MS / MAX_RETRIES values are sized to keep the combined
    // worst-case well under the 120 000 ms scan-level hard timeout.
    params.append('category', 'performance');
    params.append('category', 'accessibility');
    params.append('category', 'seo');
    params.append('category', 'best-practices');

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

        // Extract Core Web Vitals and performance metrics.
        // New nullable fields (bestPracticesScore, bestPracticesIssues, fieldData,
        // originFieldData) are initialised to null/[] here and populated below after
        // the existing audit-extraction blocks — keeping the happy path readable and
        // all fail-safe early-returns covered by emptyMetrics above.
        const metrics: LighthouseMetrics = {
          lcp: audits['largest-contentful-paint']?.numericValue || null,
          fcp: audits['first-contentful-paint']?.numericValue || null,
          cls: audits['cumulative-layout-shift']?.numericValue || null,
          tbt: audits['total-blocking-time']?.numericValue || null,
          tti: audits['interactive']?.numericValue || null,
          si: audits['speed-index']?.numericValue || null,
          ttfb: audits['server-response-time']?.numericValue || null,
          // Use ?? null (not || null) so a legitimate score of 0 is preserved as 0.
          // || null coerces 0 (falsy) to null, making a genuine "worst site" score
          // indistinguishable from "provider unavailable". ?? null coerces only
          // undefined/null, which matches the intent. bestPracticesScore already
          // uses this pattern — this brings performanceScore into line with it.
          performanceScore: lighthouseResult.categories?.performance?.score ?? null,
          accessibilityScore: lighthouseResult.categories?.accessibility?.score || null,
          seoScore: lighthouseResult.categories?.seo?.score || null,
          bestPracticesScore: null,
          opportunities: [],
          accessibilityViolations: [],
          seoIssues: [],
          bestPracticesIssues: [],
          fieldData: null,
          originFieldData: null,
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

        // ── Best-practices category ────────────────────────────────────────────
        // score is null for some Lighthouse versions — propagate null rather than 0.
        const bpCategory = lighthouseResult.categories?.['best-practices'];
        if (bpCategory) {
          // Use ?? null (not || null) so a legitimate score of 0 is preserved.
          metrics.bestPracticesScore = bpCategory.score ?? null;
        }

        // Curated set of best-practices audits worth surfacing as issues.
        // Tolerant: audits absent from the response (varies by Lighthouse version)
        // are simply skipped — we never throw on a missing key.
        // 'no-vulnerable-libraries' was removed from Lighthouse 12 and is intentionally
        // excluded to avoid referencing a retired audit ID.
        const bestPracticesAudits = [
          'is-on-https',
          'errors-in-console',
          'deprecations',
          'image-aspect-ratio',
          'image-size-responsive',
          'geolocation-on-start',
          'notification-on-start',
          'inspector-issues',
          'valid-source-maps',
          'doctype',
          'charset',
          'paste-preventing-inputs',
        ];

        for (const auditId of bestPracticesAudits) {
          const audit = audits[auditId];
          // score === null means N/A (informational only) — skip; only flag true failures.
          if (audit && audit.score !== null && audit.score < 1) {
            const parsed = parseAudit(auditId, audit);
            metrics.bestPracticesIssues!.push(parsed);
          }
        }

        // ── CrUX field data (real-user metrics) ───────────────────────────────
        // parseCrUXBlock returns null for absent/malformed blocks — both are the
        // normal case for low-traffic URLs, so no logging is needed here.
        metrics.fieldData = parseCrUXBlock(data.loadingExperience);
        metrics.originFieldData = parseCrUXBlock(data.originLoadingExperience);

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
