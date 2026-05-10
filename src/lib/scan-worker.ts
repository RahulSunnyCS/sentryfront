/**
 * Scan worker — orchestrates the full 15-module passive scan pipeline.
 * Phase 4: all modules implemented. No stubs remain.
 */

import { prisma } from './prisma';
import { publishEvent } from './events';
import { runScanner } from './scanner';
import type { RawFinding } from './scanner/types';

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

    const { findings, stack, moduleFindingCounts } = scannerResult;

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
    console.error(`[worker] scan ${scanId} failed:`, err);
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'FAILED' },
    }).catch(() => {});
    await publishEvent(scanId, 'scan_failed', {
      scan_id: scanId,
      error: String(err),
    }).catch(() => {});
    throw err;
  }
}
