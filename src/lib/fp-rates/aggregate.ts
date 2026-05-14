/**
 * Phase 3.7 — per-module FP-rate aggregation.
 *
 * Reads append-only FindingDisposition rows, keeps the latest verdict per
 * (userId, findingId), joins with Finding for moduleId/confidence, then
 * tallies all four buckets per (moduleId, confidence) so we can show both
 * sides — `fpRate` AND `helpfulRate`. Dismissed and fix_didnt_help do NOT
 * count toward fpRate; only explicit "False positive" clicks do.
 *
 * Recall guardrail: this function is observation-only. Acting on a high
 * fpRate requires running the Phase 3.6 corpus first; see MODULE_QUALITY.md.
 */

import type { PrismaClient } from '@prisma/client';

export interface ModuleRate {
  moduleId: string;
  confidence: string | null;
  total: number;
  helpfulCount: number;
  dismissedCount: number;
  fpCount: number;
  fixDidntHelpCount: number;
  missedOtherCount: number;
  fpRate: number;
  helpfulRate: number;
}

type AggregatePrisma = Pick<PrismaClient, 'findingDisposition'> & {
  findingDisposition: {
    findMany: (args: unknown) => Promise<
      Array<{
        findingId: string;
        userId: string;
        disposition: string;
        createdAt: Date;
        finding: { moduleId: string; confidence: string | null } | null;
      }>
    >;
  };
};

export async function aggregateFpRates(
  prisma: AggregatePrisma | PrismaClient,
): Promise<ModuleRate[]> {
  // Pull every disposition ordered newest-first; reduce client-side so the
  // logic is portable across sqlite (dev) and postgres (prod) without
  // resorting to DISTINCT ON.
  const rows = await (prisma as AggregatePrisma).findingDisposition.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      findingId: true,
      userId: true,
      disposition: true,
      createdAt: true,
      finding: { select: { moduleId: true, confidence: true } },
    },
  });

  // Latest disposition per (userId, findingId).
  const latest = new Map<
    string,
    { disposition: string; finding: { moduleId: string; confidence: string | null } | null }
  >();
  for (const row of rows) {
    const key = `${row.userId}::${row.findingId}`;
    if (!latest.has(key)) {
      latest.set(key, { disposition: row.disposition, finding: row.finding });
    }
  }

  // Group by (moduleId, confidence).
  const buckets = new Map<string, ModuleRate>();
  for (const { disposition, finding } of latest.values()) {
    if (!finding) continue;
    const confidence = finding.confidence ?? null;
    const key = `${finding.moduleId}::${confidence ?? ''}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        moduleId: finding.moduleId,
        confidence,
        total: 0,
        helpfulCount: 0,
        dismissedCount: 0,
        fpCount: 0,
        fixDidntHelpCount: 0,
        missedOtherCount: 0,
        fpRate: 0,
        helpfulRate: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.total += 1;
    switch (disposition) {
      case 'helpful':
        bucket.helpfulCount += 1;
        break;
      case 'dismissed':
        bucket.dismissedCount += 1;
        break;
      case 'fp':
        bucket.fpCount += 1;
        break;
      case 'fix_didnt_help':
        bucket.fixDidntHelpCount += 1;
        break;
      case 'missed_other':
        bucket.missedOtherCount += 1;
        break;
    }
  }

  const out: ModuleRate[] = [];
  for (const b of buckets.values()) {
    b.fpRate = b.total === 0 ? 0 : b.fpCount / b.total;
    b.helpfulRate = b.total === 0 ? 0 : b.helpfulCount / b.total;
    out.push(b);
  }

  out.sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
    return (a.confidence ?? '').localeCompare(b.confidence ?? '');
  });
  return out;
}
