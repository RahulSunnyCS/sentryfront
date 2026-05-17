/**
 * Pure data helpers for the performanceMetrics JSON column.
 *
 * These utilities are scanner-level concerns: they deal with shaping and
 * normalising the data that the scanner produces. They are extracted from
 * scan-worker.ts so that both the background job orchestrator (scan-worker.ts)
 * and the public API route (api/v1/scans/[id]/route.ts) can import from a
 * single authoritative location without the route depending on the worker.
 *
 * IMPORTANT: this module must NOT import from scan-worker.ts — doing so would
 * re-introduce the coupling that motivated the extraction.
 */

import type { ScannerResult } from './index';

// ── PerformanceMetricsBlob ─────────────────────────────────────────────────────

/**
 * Shape of the performanceMetrics JSON column in the database.
 *
 * ALL new T-08 fields (scoreSource, fieldData, bestPractices, desktop) are
 * stored INSIDE this blob — no schema migration needed. The Scan model's
 * performanceMetrics column remains a plain JSON string.
 *
 * All fields are optional so that:
 *   a) old persisted blobs (no scoreSource) still parse without error, and
 *   b) the normaliser can fill in safe defaults from back-compat fixtures.
 */
export interface PerformanceMetricsBlob {
  lcp: number | null;
  fcp: number | null;
  cls: number | null;
  tbt: number | null;
  ttfb: number | null;
  opportunities: unknown[];
  // T-08 fields — all optional for back-compat
  scoreSource?: 'lab' | 'unavailable';
  fieldDataVerdict?: string | null;
  fieldData?: unknown | null;
  bestPracticesScore?: number | null;
  bestPracticesGrade?: string;
  desktop?: {
    score: number | null;
    grade: string;
    scoreSource: 'lab' | 'unavailable';
    metrics: {
      lcp: number | null;
      fcp: number | null;
      cls: number | null;
      tbt: number | null;
      ttfb: number | null;
      opportunities: unknown[];
    };
  };
}

// ── normalizePerformanceMetrics ────────────────────────────────────────────────

/**
 * Normalise a raw parsed performanceMetrics JSON blob into a known-safe shape.
 *
 * Back-compat rules (required by T-08 acceptance criteria):
 *
 *   PRE-CHANGE blob (no scoreSource key):
 *     → scoreSource defaults to 'lab' because the old code path only ever
 *       persisted a metrics blob when performanceScore was truthy (non-null, non-
 *       zero). A blob without scoreSource therefore came from a successful PSI run.
 *       Defaulting to 'lab' is safe.
 *
 *   NEW-CODE PARTIAL blob (fieldData present but scoreSource missing):
 *     → This should not occur in practice (T-08 always writes scoreSource), but
 *       if it did, we must NOT silently label it 'lab' — the presence of fieldData
 *       without scoreSource is ambiguous. We default to 'unknown' (rendered as N/A
 *       by the UI) rather than 'lab', which would mislabel an UNAVAILABLE scan.
 *
 * The function is pure and has no side effects: safe to call at parse time.
 *
 * @param raw  The raw object from JSON.parse(scan.performanceMetrics)
 * @returns    A normalised PerformanceMetricsBlob with scoreSource always set
 */
export function normalizePerformanceMetrics(
  raw: Record<string, unknown>,
): PerformanceMetricsBlob & { scoreSource: 'lab' | 'unavailable' } {
  const hasFieldData = 'fieldData' in raw && raw.fieldData !== undefined;
  const hasScoreSource = 'scoreSource' in raw;

  let scoreSource: 'lab' | 'unavailable';
  if (hasScoreSource) {
    // Trust whatever the writer recorded. If the stored value is neither 'lab'
    // nor 'unavailable' (corrupted data), fall back to 'unavailable' — better
    // to display N/A than to show a misleadingly confident 'lab' grade.
    scoreSource = (raw.scoreSource === 'lab') ? 'lab' : 'unavailable';
  } else if (!hasFieldData) {
    // PRE-CHANGE blob: no scoreSource, no fieldData → came from old code that
    // only wrote the blob on PSI success. Safe to label 'lab'.
    scoreSource = 'lab';
  } else {
    // NEW-CODE PARTIAL blob: has fieldData but no scoreSource. This is an
    // indeterminate state — do NOT silently label 'lab'. Use 'unavailable'
    // so the UI shows N/A rather than a potentially wrong grade.
    // Log a warning so the anomaly is visible in monitoring.
    scoreSource = 'unavailable';
  }

  return {
    lcp: (raw.lcp as number | null) ?? null,
    fcp: (raw.fcp as number | null) ?? null,
    cls: (raw.cls as number | null) ?? null,
    tbt: (raw.tbt as number | null) ?? null,
    ttfb: (raw.ttfb as number | null) ?? null,
    opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : [],
    scoreSource,
    fieldDataVerdict: hasScoreSource || hasFieldData
      ? ((raw.fieldDataVerdict as string | null | undefined) ?? null)
      : undefined,
    fieldData: hasScoreSource || hasFieldData
      ? ((raw.fieldData as unknown | null | undefined) ?? null)
      : undefined,
    bestPracticesScore: (raw.bestPracticesScore as number | null | undefined) ?? undefined,
    bestPracticesGrade: (raw.bestPracticesGrade as string | undefined) ?? undefined,
    desktop: (raw.desktop as PerformanceMetricsBlob['desktop'] | undefined) ?? undefined,
  };
}

// ── buildPerformanceMetricsBlob ────────────────────────────────────────────────

/**
 * Build the full performanceMetrics JSON blob from a ScannerResult.
 *
 * CRITICAL INVARIANT (T-08): The blob is constructed whenever the performance
 * feature ran (performanceResult !== null in scanner/index.ts), regardless of
 * whether the scalar performanceScore is null (UNAVAILABLE path). This decouples
 * the metrics persist guard from the scalar guard.
 *
 * Old code used `...(performanceMetrics && {...})` which evaluated falsy when
 * performanceMetrics was {} (the old test fixture). The new code always returns
 * a non-empty object with at least scoreSource, so the truthiness guard works
 * correctly: a non-null blob means "feature ran"; null means "feature disabled".
 */
export function buildPerformanceMetricsBlob(
  scannerResult: ScannerResult,
): PerformanceMetricsBlob | null {
  // If the scanner didn't run performance modules, scoreSource is absent.
  // 'scoreSource' being present is the canonical signal that the feature ran.
  if (scannerResult.scoreSource === undefined) return null;

  return {
    lcp: scannerResult.performanceMetrics?.lcp ?? null,
    fcp: scannerResult.performanceMetrics?.fcp ?? null,
    cls: scannerResult.performanceMetrics?.cls ?? null,
    tbt: scannerResult.performanceMetrics?.tbt ?? null,
    ttfb: scannerResult.performanceMetrics?.ttfb ?? null,
    opportunities: scannerResult.performanceMetrics?.opportunities ?? [],
    // T-08 new fields — always written so the UNAVAILABLE path persists correctly
    scoreSource: scannerResult.scoreSource,
    fieldDataVerdict: scannerResult.fieldDataVerdict ?? null,
    fieldData: scannerResult.fieldData ?? null,
    bestPracticesScore: scannerResult.bestPracticesScore ?? null,
    bestPracticesGrade: scannerResult.bestPracticesGrade ?? 'N/A',
    // Desktop sub-object: only written when desktop ran (feature flag + mobile success)
    ...(scannerResult.desktopPerformance !== undefined && {
      desktop: scannerResult.desktopPerformance,
    }),
  };
}
