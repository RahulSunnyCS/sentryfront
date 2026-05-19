/**
 * Extension scan worker — orchestrates the passive scan pipeline for
 * pre-collected artifacts submitted by the Chrome extension.
 */

import { prisma } from './prisma';
import { publishEvent } from './events';
import { runExtensionScanner, computeGrade } from './scanner/extension-pipeline';
import { enrichFindingsWithLLM } from './llm/enrichment';
import { logger } from './logger';
import type { ExtensionScanInput } from '@/types/extension';

const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS ?? 60_000); // 60s for extension scans

export async function runExtensionScan(
  scanId: string,
  input: ExtensionScanInput,
): Promise<void> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Extension scan timeout')), SCAN_TIMEOUT_MS),
  );

  try {
    await Promise.race([runExtensionScanInternal(scanId, input), timeout]);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes('timeout');
    logger.warn(isTimeout ? 'Extension scan timeout' : 'Extension scan failed', { scanId }, err as Error);

    await prisma.scan.update({
      where: { id: scanId },
      data: { status: isTimeout ? 'TIMEOUT' : 'FAILED', completedAt: new Date() },
    }).catch(() => {});

    await publishEvent(scanId, isTimeout ? 'scan_timeout' : 'scan_failed', {
      scan_id: scanId,
      error: String(err),
    }).catch(() => {});

    throw err;
  }
}

async function runExtensionScanInternal(
  scanId: string,
  input: ExtensionScanInput,
): Promise<void> {
  await prisma.scan.update({ where: { id: scanId }, data: { status: 'RUNNING' } });

  await publishEvent(scanId, 'scan_started', { scan_id: scanId });

  const { findings: rawFindings, stack, moduleFindingCounts } =
    await runExtensionScanner(input);

  await publishEvent(scanId, 'llm_enrichment_started', {
    scan_id: scanId,
    finding_count: rawFindings.length,
  });

  const enrichmentResult = await enrichFindingsWithLLM(rawFindings, {
    targetUrl: input.url,
    stack,
  });
  const findings = enrichmentResult.findings;

  await publishEvent(scanId, 'llm_enrichment_complete', {
    scan_id: scanId,
    used_llm: enrichmentResult.status.used,
    reason: enrichmentResult.status.reason ?? null,
    model: enrichmentResult.status.model ?? null,
  });

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
}
