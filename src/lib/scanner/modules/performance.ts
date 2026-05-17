/**
 * Performance Scanning Module Aggregator
 * Phase 5.5: Performance Scanning
 *
 * Orchestrates all performance detection modules (P2-01 to P2-08).
 *
 * Scoring contract (T-06):
 *   - headline score = Math.round(metrics.performanceScore * 100)  — the ONLY *100 in this file
 *   - metrics.performanceScore is ALWAYS kept in 0-1 range when passed to sub-modules
 *   - UNAVAILABLE (PSI failed) → grade 'N/A', score null, scoreSource 'unavailable'
 *   - genuine score 0.0 → integer 0 (never null)
 *
 * Desktop orchestration (features.desktopPerformance):
 *   - FALSE (default): single mobile PSI call, no `desktop` key — byte-identical to pre-T-06
 *   - TRUE: mobile first; if mobile is UNAVAILABLE (rate-limited/quota), skip desktop
 *           otherwise run desktop and store it as subordinate `desktop` sub-object
 *   Mobile is ALWAYS the headline; desktop never drives grade/score/findings.
 *
 * Cache: every PSI fetch goes through psi-cache getOrFetch, keyed per strategy.
 *   - Only success results (non-null performanceScore) are cached.
 *   - Optional bypassCache param forces a fresh fetch (for re-scan, wired downstream by T-08).
 */

import type { LighthouseMetrics, CrUXFieldData } from '../lighthouse';
import { runCoreWebVitalsModule } from './p2-01-core-web-vitals';
import { runResourceOptimizationModule } from './p2-02-resource-optimization';
import { runNetworkEfficiencyModule } from './p2-03-network-efficiency';
import { runJavaScriptPerformanceModule } from './p2-04-javascript-performance';
import { runServerResponseTimeModule } from './p2-05-server-response-time';
import { runMobilePerformanceModule } from './p2-06-mobile-performance';
// T-02: new modules wired in here (T-06 task scope)
import { runRealUserFieldModule } from './p2-07-real-user-field';
import { runBestPracticesModule } from './p2-08-best-practices';
import type { RawFinding, CrawlResult } from '../types';
import { features } from '@/lib/features';
import { getOrFetch, buildPsiCacheKey } from '../psi-cache';
import type { PsiStrategy } from '../psi-cache';
import { logger } from '@/lib/logger';

// ─── Public timeout constant ──────────────────────────────────────────────────
/**
 * Worst-case wall-clock budget for a SINGLE PageSpeed Insights call (ms).
 * Matches the PAGESPEED_TIMEOUT_MS constant in lighthouse.ts (45 000 ms / 0 retries).
 * When desktop is enabled, two sequential calls are made; their combined budget is
 * 2 × PSI_TIMEOUT_MS = 90 000 ms, comfortably under SCAN_TIMEOUT_MS (120 000 ms).
 * Exported so the timing-bound test can assert the invariant without hard-coding numbers.
 */
export const PSI_TIMEOUT_MS = 45_000;

// ─── PerformanceResult ────────────────────────────────────────────────────────

/**
 * The shape of one form-factor result (mobile or desktop).
 * When PSI failed for this form factor, grade is 'N/A', score is null,
 * scoreSource is 'unavailable', and the metrics object is NON-EMPTY (carries
 * scoreSource so downstream JSON serialisation cannot silently drop it).
 */
export interface FormFactorResult {
  /** 0-100 integer on success; null on PSI failure (never 0-for-failure). */
  score: number | null;
  /** A–F on success; 'N/A' when PSI failed (never 'F' for a provider failure). */
  grade: string;
  /** 'lab' when a real Lighthouse score was returned; 'unavailable' when PSI failed. */
  scoreSource: 'lab' | 'unavailable';
  /** The raw LighthouseMetrics object passed to / returned from this form factor. */
  metrics: LighthouseMetrics;
}

export interface PerformanceResult {
  findings: RawFinding[];
  /** The mobile LighthouseMetrics object. Passed to sub-modules in its original 0-1 form. */
  metrics: LighthouseMetrics;
  /** A–F or 'N/A'. Mobile headline. */
  performanceGrade: string;
  /** 0-100 or null. Mobile headline. null only on PSI failure. */
  performanceScore: number | null;
  /** 'lab' | 'unavailable'. Mobile headline. */
  scoreSource: 'lab' | 'unavailable';
  /**
   * Mobile CrUX real-user verdict from Google, verbatim. Null when absent.
   * This is Google's overallCategory from loadingExperience (FAST/AVERAGE/SLOW).
   */
  fieldDataVerdict: CrUXFieldData['overallCategory'] | null;
  /**
   * Full URL-level CrUX field data block for the mobile result. Null when absent.
   * Forwarded verbatim — T-08 threads this into ScannerResult for persistence.
   */
  fieldData: CrUXFieldData | null;
  /**
   * Best-practices Lighthouse category score (0-100 integer) from the mobile run.
   * Null when the category was absent or PSI failed.
   */
  bestPracticesScore: number | null;
  /** A–F grade for best practices; 'N/A' when score is null. */
  bestPracticesGrade: string;
  /**
   * Desktop sub-object — only present when features.desktopPerformance is true
   * AND mobile succeeded (non-UNAVAILABLE). NEVER averaged into headline;
   * NEVER drives grade/banner/findings severity.
   * T-08 persists this as a subordinate JSON blob.
   */
  desktop?: FormFactorResult;
  /**
   * Per-module finding counts, for diagnostic logging and T-08 persistence.
   * Keys are module IDs ('P2-01' … 'P2-08').
   */
  moduleFindingCounts: Record<string, number>;
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

/**
 * Map a 0-100 integer score to an A–F grade.
 * The A–F buckets are unchanged from pre-T-06.
 */
function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Convert a 0-1 Lighthouse performanceScore to a 0-100 integer and an A–F grade.
 *
 * This is the ONLY place the *100 conversion happens for the performance headline.
 * Any genuine score of 0.0 maps to integer 0, NOT null.
 * The old ad-hoc LCP/CLS deductions have been removed entirely — Lighthouse
 * already accounts for CWV in its score; double-penalising produced scores
 * lower than Google's own tool would show, misleading users.
 *
 * @param performanceScore  0-1 Lighthouse score (never null when called from success path)
 */
function calculatePerformanceGrade(performanceScore: number): { grade: string; score: number } {
  // Round to integer on the 0-100 scale — this is the ONLY *100 conversion.
  const score = Math.round(performanceScore * 100);
  return { grade: scoreToGrade(score), score };
}

/**
 * Determine whether a PSI result is UNAVAILABLE (provider failure).
 *
 * lighthouse.ts returns emptyMetrics for ALL failure paths: 429 (rate-limit),
 * 403 (quota/key), timeout, network error.  The discriminating signal is
 * `performanceScore === null` — on a real response lighthouse.ts uses `?? null`
 * (not `|| null`) so a genuine score of 0 comes through as the number 0, not null.
 *
 * Therefore: null → unavailable; number (including 0) → real lab score.
 *
 * This function intentionally does NOT inspect HTTP status codes directly because
 * runLighthouse (forbidden to edit) already abstracts those away; we work from
 * the contract it exposes.
 */
function isUnavailable(metrics: LighthouseMetrics): boolean {
  return metrics.performanceScore === null;
}

/**
 * Build a FormFactorResult for one PSI outcome.
 * Handles both the success and UNAVAILABLE paths.
 */
function buildFormFactorResult(metrics: LighthouseMetrics): FormFactorResult {
  if (isUnavailable(metrics)) {
    return {
      score: null,
      grade: 'N/A',
      scoreSource: 'unavailable',
      metrics,
    };
  }
  // performanceScore is a number here (including genuine 0)
  const { grade, score } = calculatePerformanceGrade(metrics.performanceScore as number);
  return {
    score,
    grade,
    scoreSource: 'lab',
    metrics,
  };
}

// ─── Best-practices grade helper ──────────────────────────────────────────────

function bestPracticesScoreAndGrade(metrics: LighthouseMetrics): { score: number | null; grade: string } {
  const raw = metrics.bestPracticesScore ?? null;
  if (raw === null) return { score: null, grade: 'N/A' };
  const score = Math.round(raw * 100);
  return { score, grade: scoreToGrade(score) };
}

// ─── URL normalisation for cache keys ────────────────────────────────────────

/**
 * Minimal URL normalisation for cache key construction.
 * Lowercases scheme+host, strips trailing slash from path.
 * This is the minimum needed so "https://Example.com/" and "https://example.com"
 * hash to the same key.  Full canonicalisation (query reordering, fragment removal)
 * is deliberately out of scope — the cache key only needs to be consistent for
 * the same URL as typed by the scanner, not across all possible URL forms.
 */
function normalizeUrlForCacheKey(url: string): string {
  try {
    const u = new URL(url);
    // Lowercase the scheme and host (URL constructor already lowercases host,
    // but we be explicit about scheme too).
    const scheme = u.protocol.toLowerCase();
    const host = u.hostname.toLowerCase();
    const port = u.port ? `:${u.port}` : '';
    // pathname preserves case (some servers are case-sensitive); only strip trailing slash
    const path = u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : u.pathname;
    const search = u.search;
    return `${scheme}//${host}${port}${path}${search}`;
  } catch {
    // If the URL is unparseable, return it as-is.  The cache will still work;
    // it just may not deduplicate equivalent but differently-typed forms.
    return url;
  }
}

// ─── PSI fetch wrapper ────────────────────────────────────────────────────────

/**
 * Run a single PSI call for the given URL + strategy, routed through the cache.
 *
 * Uses Promise.allSettled-style isolation: any thrown error (including from the
 * cache wrapper) is caught here and converted to emptyMetrics so a failure for
 * one form factor never collapses the other.
 *
 * @param runLighthouse  Dynamically-imported runLighthouse function
 * @param targetUrl      The URL being scanned
 * @param normalizedUrl  Normalised URL used as cache key prefix
 * @param strategy       'mobile' | 'desktop'
 * @param bypass         If true, skip cache read (force fresh fetch)
 */
async function fetchPsi(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runLighthouse: (url: string, config: any) => Promise<LighthouseMetrics>,
  targetUrl: string,
  normalizedUrl: string,
  strategy: PsiStrategy,
  bypass: boolean,
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
    bestPracticesScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    bestPracticesIssues: [],
    fieldData: null,
    originFieldData: null,
  };

  try {
    const key = buildPsiCacheKey(normalizedUrl, strategy);
    const result = await getOrFetch(
      key,
      () => runLighthouse(targetUrl, { formFactor: strategy }),
      {
        bypass,
        // Only cache results where PSI returned a real performance score.
        // null → UNAVAILABLE (rate-limit, quota, timeout) → never cache.
        // 0 is a real score and IS cacheable.
        isCacheable: (v) => v.performanceScore !== null,
      },
    );
    // getOrFetch can return null if the fetcher returns null; treat that as unavailable.
    return result ?? emptyMetrics;
  } catch (err) {
    // Fail-soft: any error (including cache wrapper bugs) maps to emptyMetrics
    // so the other form factor can still succeed.
    logger.warn('PSI fetch failed for strategy, returning empty metrics', {
      strategy,
      url: targetUrl,
      error: (err as Error).message,
    });
    return emptyMetrics;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run all performance modules against the target URL.
 *
 * @param targetUrl   URL to scan
 * @param crawlResult Optional crawl result for P2-06 (mobile HTML analysis)
 * @param bypassCache If true, skip the PSI cache and force fresh fetch(es).
 *                    Default false. Threading the actual user re-scan signal
 *                    into this param is a downstream concern (T-08/scan-worker).
 */
export async function runPerformanceModules(
  targetUrl: string,
  crawlResult?: CrawlResult,
  bypassCache = false,
): Promise<PerformanceResult> {
  try {
    logger.info('Starting performance scan', { url: targetUrl });

    // Dynamically import Lighthouse to avoid import.meta issues during Next.js build
    const { runLighthouse } = await import('../lighthouse');

    const normalizedUrl = normalizeUrlForCacheKey(targetUrl);

    // ── MOBILE (always runs — it is the headline) ─────────────────────────────
    const mobileMetrics = await fetchPsi(runLighthouse, targetUrl, normalizedUrl, 'mobile', bypassCache);
    const mobileResult = buildFormFactorResult(mobileMetrics);

    // ── DESKTOP (only when feature flag is enabled) ───────────────────────────
    let desktopResult: FormFactorResult | undefined;

    if (features.desktopPerformance) {
      // If mobile is UNAVAILABLE (null performanceScore), we are being rate-limited
      // or quota-exceeded.  Running desktop would burn another API slot for no benefit
      // (it will also fail).  Skip it.
      if (mobileResult.scoreSource === 'unavailable') {
        logger.info('Skipping desktop PSI call: mobile result is UNAVAILABLE (rate-limit/quota)', {
          url: targetUrl,
        });
        // desktopResult stays undefined — no `desktop` key in the output
      } else {
        // Run desktop PSI — sequentially after mobile (T-01 established that
        // 2 × PSI_TIMEOUT_MS = 90 000 ms, within SCAN_TIMEOUT_MS = 120 000 ms).
        const desktopMetrics = await fetchPsi(
          runLighthouse, targetUrl, normalizedUrl, 'desktop', bypassCache,
        );
        desktopResult = buildFormFactorResult(desktopMetrics);
      }
    }

    // ── MODULE FINDINGS ───────────────────────────────────────────────────────
    // CRITICAL INVARIANT: pass mobileMetrics (0-1 performanceScore) to ALL
    // sub-modules — never the converted 0-100 integer.  P2-07 explicitly checks
    // performanceScore >= 0.5 (0-1 scale).  Do not mutate mobileMetrics.
    const cwvFindings          = runCoreWebVitalsModule(mobileMetrics);
    const resourceFindings     = runResourceOptimizationModule(mobileMetrics);
    const networkFindings      = runNetworkEfficiencyModule(mobileMetrics);
    const jsFindings           = runJavaScriptPerformanceModule(mobileMetrics);
    const serverFindings       = runServerResponseTimeModule(mobileMetrics);
    const mobileHtmlFindings   = crawlResult ? runMobilePerformanceModule(crawlResult) : [];
    // T-02 new modules (T-06 wires them in)
    const realUserFindings     = runRealUserFieldModule(mobileMetrics);
    const bestPracticesFindings = runBestPracticesModule(mobileMetrics);

    // Combine all findings
    const allFindings = [
      ...cwvFindings,
      ...resourceFindings,
      ...networkFindings,
      ...jsFindings,
      ...serverFindings,
      ...mobileHtmlFindings,
      ...realUserFindings,
      ...bestPracticesFindings,
    ];

    // Per-module finding counts for logging and downstream persistence
    const moduleFindingCounts: Record<string, number> = {
      'P2-01': cwvFindings.length,
      'P2-02': resourceFindings.length,
      'P2-03': networkFindings.length,
      'P2-04': jsFindings.length,
      'P2-05': serverFindings.length,
      'P2-06': mobileHtmlFindings.length,
      'P2-07': realUserFindings.length,
      'P2-08': bestPracticesFindings.length,
    };

    // ── Best-practices score ──────────────────────────────────────────────────
    const bpResult = bestPracticesScoreAndGrade(mobileMetrics);

    // ── CrUX verbatim verdict ─────────────────────────────────────────────────
    const fieldDataVerdict = mobileMetrics.fieldData?.overallCategory ?? null;

    logger.info('Performance scan completed', {
      url: targetUrl,
      grade: mobileResult.grade,
      score: mobileResult.score,
      scoreSource: mobileResult.scoreSource,
      findingsCount: allFindings.length,
      moduleFindingCounts,
      desktopEnabled: features.desktopPerformance,
      desktopScoreSource: desktopResult?.scoreSource ?? 'not-run',
    });

    // ── Build result ──────────────────────────────────────────────────────────
    const result: PerformanceResult = {
      findings: allFindings,
      // mobileMetrics is the canonical metrics object (0-1 performanceScore inside)
      metrics: mobileMetrics,
      performanceGrade: mobileResult.grade,
      performanceScore: mobileResult.score,
      scoreSource: mobileResult.scoreSource,
      fieldDataVerdict,
      fieldData: mobileMetrics.fieldData ?? null,
      bestPracticesScore: bpResult.score,
      bestPracticesGrade: bpResult.grade,
      moduleFindingCounts,
    };

    // Only add `desktop` key when desktop orchestration ran and produced a result.
    // When features.desktopPerformance is false this key is ABSENT — byte-identical
    // to pre-T-06 behaviour for flag-off consumers.
    if (desktopResult !== undefined) {
      result.desktop = desktopResult;
    }

    return result;

  } catch (error) {
    // Top-level catch: runLighthouse threw outside fetchPsi (should not happen,
    // but belt-and-suspenders).
    logger.error('Performance scan failed', { error, url: targetUrl });

    // UNAVAILABLE result: grade 'N/A', score null, scoreSource 'unavailable'.
    // The metrics object is NON-EMPTY and explicitly carries scoreSource so that
    // downstream JSON-blob persistence (T-08) cannot silently drop it.
    // We do NOT return grade 'F' / score 0 for a provider failure — that would
    // misrepresent "we don't know" as "definitely bad".
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

    return {
      findings: [],
      metrics: emptyMetrics,
      performanceGrade: 'N/A',
      performanceScore: null,
      scoreSource: 'unavailable',
      fieldDataVerdict: null,
      fieldData: null,
      bestPracticesScore: null,
      bestPracticesGrade: 'N/A',
      moduleFindingCounts: {
        'P2-01': 0, 'P2-02': 0, 'P2-03': 0, 'P2-04': 0,
        'P2-05': 0, 'P2-06': 0, 'P2-07': 0, 'P2-08': 0,
      },
    };
  }
}
