/**
 * Phase 3.7.1 — daily FpRateSnapshot writer.
 *
 * Persists one row per (moduleId, confidence) bucket so the admin
 * /internal/fp-rates page can render sparklines without rescanning the
 * full FindingDisposition table on every page load.
 *
 * Idempotent per UTC day: if any snapshot row already exists for the
 * day of `generatedAt`, this is a no-op. That makes the existing cron
 * AND the admin force-run endpoint safe to invoke repeatedly.
 */

import type { PrismaClient } from '@prisma/client';
import type { ModuleRate } from './aggregate';

type SnapshotPrisma = Pick<PrismaClient, 'fpRateSnapshot'>;

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDayEnd(date: Date): Date {
  const start = utcDayStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export async function writeFpRateSnapshots(
  prisma: SnapshotPrisma | PrismaClient,
  rates: ModuleRate[],
  generatedAt: Date,
): Promise<boolean> {
  if (rates.length === 0) return false;

  const dayStart = utcDayStart(generatedAt);
  const dayEnd = utcDayEnd(generatedAt);

  const existing = await (prisma as SnapshotPrisma).fpRateSnapshot.findFirst({
    where: {
      snapshotAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (existing) return false;

  await (prisma as SnapshotPrisma).fpRateSnapshot.createMany({
    data: rates.map((r) => ({
      snapshotAt: generatedAt,
      moduleId: r.moduleId,
      confidence: r.confidence,
      total: r.total,
      fpCount: r.fpCount,
      helpfulCount: r.helpfulCount,
      dismissedCount: r.dismissedCount,
      fixDidntHelpCount: r.fixDidntHelpCount,
      missedOtherCount: r.missedOtherCount,
      fpRate: r.fpRate,
      helpfulRate: r.helpfulRate,
    })),
  });

  return true;
}
