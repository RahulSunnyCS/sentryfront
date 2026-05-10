/**
 * Scan worker — orchestrates the full scan pipeline.
 *
 * Phase 3: P1-01 to P1-05 use real detection via the scanner.
 *          P1-06 to P1-15 are stubs (implemented in Phase 4).
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

// Modules not yet implemented — emitted as complete with 0 findings.
const STUB_MODULES = new Set(['P1-06', 'P1-07', 'P1-08', 'P1-09', 'P1-10', 'P1-11', 'P1-12', 'P1-13', 'P1-14', 'P1-15']);

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

export async function runScan(scanId: string): Promise<void> {
  let targetUrl = '';

  try {
    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan) throw new Error(`Scan ${scanId} not found`);
    targetUrl = scan.targetUrl;

    await prisma.scan.update({ where: { id: scanId }, data: { status: 'RUNNING' } });

    // Publish stub progress for modules 1-5 while the real scanner crawls
    // (gives the UI something to show during the ~10s crawl + analysis)
    const publishStubProgress = async (upTo: number) => {
      for (let i = 0; i < upTo; i++) {
        await sleep(400);
        await publishEvent(scanId, 'module_complete', {
          scan_id: scanId,
          module_id: ALL_MODULES[i],
          findings: 0,   // placeholder — real counts sent after scanner finishes
          index: i,
        });
      }
    };

    // Run scanner and stub progress in parallel
    const [scannerResult] = await Promise.all([
      runScanner(targetUrl),
      publishStubProgress(5),
    ]);

    const { findings, stack, moduleFindingCounts } = scannerResult;

    // Emit stub events for P1-06 to P1-15
    for (let i = 5; i < ALL_MODULES.length; i++) {
      const moduleId = ALL_MODULES[i];
      if (STUB_MODULES.has(moduleId)) {
        await sleep(200);
        await publishEvent(scanId, 'module_complete', {
          scan_id: scanId,
          module_id: moduleId,
          findings: 0,
          index: i,
        });
      }
    }

    // Persist real findings
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

    // Build summary
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
