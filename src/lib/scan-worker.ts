/**
 * Scan worker — orchestrates the full 15-module passive scan pipeline.
 * Phase 4: all modules implemented. No stubs remain.
 * Phase 8: Added 120s timeout enforcement.
 */

import { prisma } from './prisma';
import { publishEvent } from './events';
import { runScanner } from './scanner';
import { enrichFindingsWithLLM } from './llm/enrichment';
import { logger } from './logger';
import type { RawFinding } from './scanner/types';

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

// Emit placeholder progress events while the scanner crawls, so the UI
// doesn't stall on a blank progress bar during the initial HTTP fetch.
async function emitPlaceholderProgress(scanId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await sleep(350);
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

    const { findings: rawFindings, stack, moduleFindingCounts } = scannerResult;

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
        })),
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
