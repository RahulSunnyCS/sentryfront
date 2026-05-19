/**
 * Scan worker — orchestrates the full 15-module passive scan pipeline.
 * Phase 4: all modules implemented. No stubs remain.
 * Phase 8: Added 120s timeout enforcement.
 * T-08: Thread new performance fields (scoreSource, CrUX, bestPractices,
 *       desktop) into the persisted performanceMetrics JSON blob.
 * T-02: Sentry span + measurement for scan-pipeline observability.
 */

import { createHash } from 'crypto';
import * as Sentry from '@sentry/nextjs';
import { prisma } from './prisma';
import { publishEvent } from './events';
import { runScanner } from './scanner';
import { enrichFindingsWithLLM } from './llm/enrichment';
import { logger } from './logger';
import type { RawFinding } from './scanner/types';
// Pure data helpers live in scanner/performance-metrics.ts (the canonical home).
// scan-worker only needs buildPerformanceMetricsBlob to assemble the blob for
// persistence; normalizePerformanceMetrics is imported directly by API routes.
import {
  buildPerformanceMetricsBlob,
} from './scanner/performance-metrics';

// Scan timeout: hard kill at 120 seconds
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS ?? 120000); // 120s default

const ALL_MODULES = [
  'P1-01', 'P1-02', 'P1-03', 'P1-04', 'P1-05',
  'P1-06', 'P1-07', 'P1-08', 'P1-09', 'P1-10',
  'P1-11', 'P1-12', 'P1-13', 'P1-14', 'P1-15',
] as const;

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

  // Fetch scan metadata for Sentry span attributes. This is a cheap read done
  // before the heavy scan work so we can tag the span even if the scan fails.
  // We avoid putting the raw URL as a Sentry attribute (privacy) — instead we
  // hash it so operators can correlate without exposing target URLs in Sentry.
  const scanMeta = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { targetUrl: true, tier: true },
  });
  const tier = scanMeta?.tier ?? 'unknown';
  // url_hash: first 8 hex chars of SHA-256(url). Enough for correlation, not
  // enough to reconstruct the URL. Node's built-in crypto, no new dependency.
  const urlHash = scanMeta?.targetUrl
    ? createHash('sha256').update(scanMeta.targetUrl).digest('hex').slice(0, 8)
    : 'unknown';

  await Sentry.startSpan(
    {
      name: 'scan',
      op: 'scan.run',
      attributes: {
        scan_id: scanId,
        tier,
        url_hash: urlHash,
      },
    },
    async () => {
      // Capture start time inside the span callback so elapsed time is measured
      // from when the span actually begins, not before.
      const startTime = Date.now();

      try {
        // Promise.race is the core unit of work. T-03 will add a try/finally
        // around this call for the activeScanCount counter — this structure
        // (startTime + try/catch below) is compatible with that future addition.
        await Promise.race([
          runScanInternal(scanId),
          timeoutPromise,
        ]);

        const durationMs = Date.now() - startTime;
        // setMeasurement attaches the elapsed time to the current Sentry
        // transaction so the Performance dashboard can chart scan durations.
        Sentry.setMeasurement('scan.duration_ms', durationMs, 'millisecond');
        logger.info('scan_complete', { scanId, durationMs, result: 'complete', tier });

      } catch (err) {
        const durationMs = Date.now() - startTime;
        // Measurement and log fire on ALL failure paths — timeout and error —
        // so the Performance dashboard always gets a data point.
        Sentry.setMeasurement('scan.duration_ms', durationMs, 'millisecond');

        const isTimeout = err instanceof Error && err.message.includes('Scan timeout');
        if (isTimeout) {
          logger.info('scan_complete', { scanId, durationMs, result: 'timeout', tier });
          logger.warn('Scan timeout', { scanId, timeout: SCAN_TIMEOUT_MS });
          await handleScanTimeout(scanId);
        } else {
          logger.info('scan_complete', { scanId, durationMs, result: 'error', tier });
        }

        throw err;
      }
    },
  );
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

    // Child span: LLM enrichment phase.
    // enrichFindingsWithLLM has its own internal feature-flag check and degrades
    // gracefully when the API key is absent — the span fires only when we call
    // it (which is always), but the span's result attribute tells you whether
    // the LLM was actually used. Named 'scan.llm_enrichment' for the dashboard.
    const enrichmentResult = await Sentry.startSpan(
      { name: 'llm_enrichment', op: 'scan.llm_enrichment' },
      () => enrichFindingsWithLLM(rawFindings, { targetUrl: scan.targetUrl, stack }),
    );
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
