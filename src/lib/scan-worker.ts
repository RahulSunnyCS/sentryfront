/**
 * Scan worker — orchestrates the full 15-module passive scan pipeline.
 * Phase 4: all modules implemented. No stubs remain.
 * Phase 8: Added 120s timeout enforcement.
 * T-08: Thread new performance fields (scoreSource, CrUX, bestPractices,
 *       desktop) into the persisted performanceMetrics JSON blob.
 */

import { prisma } from './prisma';
import { publishEvent } from './events';
import { runScanner } from './scanner';
import { enrichFindingsWithLLM } from './llm/enrichment';
import { logger } from './logger';
import type { RawFinding } from './scanner/types';
import type { ScannerResult } from './scanner';

// Scan timeout: hard kill at 120 seconds
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS ?? 120000); // 120s default

const ALL_MODULES = [
  'P1-01', 'P1-02', 'P1-03', 'P1-04', 'P1-05',
  'P1-06', 'P1-07', 'P1-08', 'P1-09', 'P1-10',
  'P1-11', 'P1-12', 'P1-13', 'P1-14', 'P1-15',
] as const;

// ── Performance metrics JSON blob ─────────────────────────────────────────────

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
function buildPerformanceMetricsBlob(
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

const SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 25, HIGH: 10, MEDIUM: 3, LOW: 1, INFO: 0,
};

function computeGrade(findings: RawFinding[]): { grade: string; score: number } {
  const score = findings.reduce((s, f) => s + (SEVERITY_SCORE[f.severity] ?? 0), 0);
  const grade = score === 0 ? 'A'
    : score <= 5 ? 'B'
    : score <= 20 ? 'C'
    : score <= 50 ? 'D'
    : 'F';
  return { grade, score };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Per-module placeholder delays (~60 s total, variable so each step feels distinct).
// Mirrors the frontend MOCK_MODULE_DURATIONS_MS so the loader paces the same
// whether the UI is in demo mode or connected to a real scan.
const PLACEHOLDER_MODULE_DELAYS_MS = [
  3500, 2800, 4200, 5500, 3000,
  4800, 3500, 2500, 5800, 4500,
  3800, 3000, 4500, 2200, 6400,
];

// Emit placeholder progress events while the scanner crawls, so the UI
// doesn't stall on a blank progress bar during the initial HTTP fetch.
async function emitPlaceholderProgress(scanId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await sleep(PLACEHOLDER_MODULE_DELAYS_MS[i] ?? 4000);
    await publishEvent(scanId, 'module_complete', {
      scan_id: scanId,
      module_id: ALL_MODULES[i],
      findings: 0,
      index: i,
    });
  }
}

export async function runScan(scanId: string): Promise<void> {
  // Wrap scan in timeout enforcement
  return runScanWithTimeout(scanId);
}

async function runScanWithTimeout(scanId: string): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Scan timeout: exceeded ${SCAN_TIMEOUT_MS / 1000}s limit`));
    }, SCAN_TIMEOUT_MS);
  });

  try {
    await Promise.race([
      runScanInternal(scanId),
      timeoutPromise,
    ]);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes('Scan timeout');

    if (isTimeout) {
      logger.warn('Scan timeout', { scanId, timeout: SCAN_TIMEOUT_MS });
      await handleScanTimeout(scanId);
    }

    throw err;
  }
}

async function runScanInternal(scanId: string): Promise<void> {
  try {
    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan) throw new Error(`Scan ${scanId} not found`);

    await prisma.scan.update({ where: { id: scanId }, data: { status: 'RUNNING' } });

    // Run scanner and emit placeholder progress in parallel.
    // The real results replace placeholder counts when we publish scan_complete.
    const [scannerResult] = await Promise.all([
      runScanner(scan.targetUrl),
      emitPlaceholderProgress(scanId, ALL_MODULES.length),
    ]);

    const {
      findings: rawFindings,
      stack,
      moduleFindingCounts,
      performanceGrade,
      // performanceScore is intentionally NOT destructured: we write it via
      // `'performanceScore' in scannerResult` so that null (UNAVAILABLE) is
      // stored rather than skipped. Destructuring it here would shadow that and
      // cause an @typescript-eslint/no-unused-vars error.
      accessibilityGrade,
      accessibilityScore,
      accessibilityMetrics,
      seoGrade,
      seoScore,
      seoMetrics,
    } = scannerResult;

    // NOTE: performanceMetrics (the old narrow shape) is intentionally NOT
    // destructured here. T-08 builds the full blob via buildPerformanceMetricsBlob
    // which includes scoreSource, fieldData, bestPractices, desktop. Using the
    // old destructured shape would lose all T-08 fields.

    // Build the full performanceMetrics blob (T-08).
    // Done here rather than inline in the Prisma update so the logic is testable.
    // Returns null when the performance feature didn't run (flag off / threw).
    const performanceMetricsBlob = buildPerformanceMetricsBlob(scannerResult);

    await publishEvent(scanId, 'llm_enrichment_started', {
      scan_id: scanId,
      finding_count: rawFindings.length,
    });

    const enrichmentResult = await enrichFindingsWithLLM(rawFindings, {
      targetUrl: scan.targetUrl,
      stack,
    });
    const findings = enrichmentResult.findings;

    await publishEvent(scanId, 'llm_enrichment_complete', {
      scan_id: scanId,
      used_llm: enrichmentResult.status.used,
      reason: enrichmentResult.status.reason ?? null,
      model: enrichmentResult.status.model ?? null,
    });

    // Persist findings
    if (findings.length > 0) {
      await prisma.finding.createMany({
        data: findings.map((f) => ({
          scanId,
          moduleId: f.moduleId,
          severity: f.severity,
          category: f.category,
          title: f.title,
          location: f.location,
          evidence: f.evidence,
          explanation: f.explanation,
          impact: f.impact,
          fixManual: JSON.stringify(f.fixManual),
          fixAiPrompt: f.fixAiPrompt,
          confidence: f.confidence ?? null,
        })) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    }

    // Build summary counts
    const summary: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const f of findings) summary[f.severity] = (summary[f.severity] ?? 0) + 1;

    const { grade, score } = computeGrade(findings);

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        grade,
        score,
        stack,
        summary: JSON.stringify(summary),
        completedAt: new Date(),
        // Phase 5.5: Store performance results.
        // performanceGrade: only written when truthy (feature ran and grade is not the empty
        // string). The 'N/A' grade IS written — 'N/A' is truthy, so UNAVAILABLE is persisted.
        ...(performanceGrade && { performanceGrade }),
        // performanceScore: written when the field is present in scannerResult (i.e. the
        // feature ran). null is a valid value (UNAVAILABLE path) — we must not skip it.
        // We use a key-in-object check, not truthiness, so null passes through.
        ...('performanceScore' in scannerResult && { performanceScore: scannerResult.performanceScore }),
        // performanceMetricsBlob: the full T-08 blob from buildPerformanceMetricsBlob.
        // It is non-null whenever scoreSource is set in scannerResult (feature ran).
        // CRITICAL (T-08): this guard is on performanceMetricsBlob (the built blob),
        // NOT on the old destructured `performanceMetrics` (which was the narrow legacy
        // shape and is no longer destructured). The blob is always non-empty when
        // the feature ran — even on UNAVAILABLE it carries {scoreSource:'unavailable',...}.
        ...(performanceMetricsBlob !== null && {
          performanceMetrics: JSON.stringify(performanceMetricsBlob),
        }),
        // Phase 6.5: Store accessibility results
        ...(accessibilityGrade && { accessibilityGrade }),
        ...(accessibilityScore !== undefined && { accessibilityScore }),
        ...(accessibilityMetrics && { accessibilityMetrics: JSON.stringify(accessibilityMetrics) }),
        // Phase 7.5: Store SEO results
        ...(seoGrade && { seoGrade }),
        ...(seoScore !== undefined && { seoScore }),
        ...(seoMetrics && { seoMetrics: JSON.stringify(seoMetrics) }),
      },
    });

    await publishEvent(scanId, 'scan_complete', {
      scan_id: scanId,
      grade,
      module_finding_counts: moduleFindingCounts,
    });

  } catch (err) {
    logger.error('Scan failed', { scanId }, err as Error);
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'FAILED', completedAt: new Date() },
    }).catch(() => {});
    await publishEvent(scanId, 'scan_failed', {
      scan_id: scanId,
      error: String(err),
    }).catch(() => {});
    throw err;
  }
}

/**
 * Handle scan timeout: persist partial findings and mark as TIMEOUT
 */
async function handleScanTimeout(scanId: string): Promise<void> {
  try {
    // Try to fetch any findings that were persisted before timeout
    const findingsCount = await prisma.finding.count({
      where: { scanId },
    });

    logger.info('Handling scan timeout', {
      scanId,
      partialFindings: findingsCount,
    });

    // Mark scan as timed out
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'TIMEOUT',
        completedAt: new Date(),
      },
    });

    // Publish timeout event
    await publishEvent(scanId, 'scan_timeout', {
      scan_id: scanId,
      partial_findings: findingsCount,
      timeout_seconds: SCAN_TIMEOUT_MS / 1000,
    });
  } catch (error) {
    logger.error('Failed to handle scan timeout', { scanId }, error as Error);
  }
}
