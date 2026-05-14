/**
 * Phase 3.7.1 — GET /api/internal/fp-rates
 *
 * Reads the last 30 days of FpRateSnapshot rows (written by the existing
 * aggregate-fp-rates cron) and groups them by (moduleId, confidence) so the
 * admin page can render a sparkline + a latest-day snapshot per bucket.
 *
 * The 30-sample gate lives here, not in src/lib/fp-rates/aggregate.ts. The
 * aggregator stays pure; rendering decisions like "should we flag this red"
 * are owned by the consumer.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FLAG_FP_RATE = 0.05;
const SAMPLE_SIZE_FLOOR = 30;
const WINDOW_DAYS = 30;

interface SeriesPoint {
  date: string; // ISO date (YYYY-MM-DD)
  fpRate: number;
  helpfulRate: number;
  samples: number;
}

interface ModuleBucket {
  moduleId: string;
  confidence: string | null;
  series: SeriesPoint[];
  latest: SeriesPoint & {
    fpCount: number;
    helpfulCount: number;
    dismissedCount: number;
    fixDidntHelpCount: number;
    missedOtherCount: number;
  };
  flagged: boolean;
  sampleSizeReady: boolean;
}

export async function GET() {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await prisma.fpRateSnapshot.findMany({
    where: { snapshotAt: { gte: cutoff } },
    orderBy: { snapshotAt: 'asc' },
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.moduleId}::${row.confidence ?? ''}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(row);
  }

  const buckets: ModuleBucket[] = [];
  for (const groupRows of Array.from(grouped.values())) {
    const sorted = [...groupRows].sort(
      (a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime(),
    );
    const series: SeriesPoint[] = sorted.map((r) => ({
      date: r.snapshotAt.toISOString().slice(0, 10),
      fpRate: r.fpRate,
      helpfulRate: r.helpfulRate,
      samples: r.total,
    }));
    const last = sorted[sorted.length - 1];
    const sampleSizeReady = last.total >= SAMPLE_SIZE_FLOOR;
    buckets.push({
      moduleId: last.moduleId,
      confidence: last.confidence,
      series,
      latest: {
        date: last.snapshotAt.toISOString().slice(0, 10),
        fpRate: last.fpRate,
        helpfulRate: last.helpfulRate,
        samples: last.total,
        fpCount: last.fpCount,
        helpfulCount: last.helpfulCount,
        dismissedCount: last.dismissedCount,
        fixDidntHelpCount: last.fixDidntHelpCount,
        missedOtherCount: last.missedOtherCount,
      },
      flagged: sampleSizeReady && last.fpRate >= FLAG_FP_RATE,
      sampleSizeReady,
    });
  }

  buckets.sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
    return (a.confidence ?? '').localeCompare(b.confidence ?? '');
  });

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    sampleSizeFloor: SAMPLE_SIZE_FLOOR,
    flagFpRate: FLAG_FP_RATE,
    buckets,
  });
}
