import { prisma } from '@/lib/prisma';
import { FpRatesView } from './fp-rates-view';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;
const SAMPLE_SIZE_FLOOR = 30;
const FLAG_FP_RATE = 0.05;

export default async function FpRatesPage() {
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

  const buckets = Array.from(grouped.values())
    .map((group) => {
      const sorted = [...group].sort(
        (a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime(),
      );
      const last = sorted[sorted.length - 1];
      const series = sorted.map((r) => ({
        date: r.snapshotAt.toISOString().slice(0, 10),
        fpRate: r.fpRate,
        samples: r.total,
      }));
      const sampleSizeReady = last.total >= SAMPLE_SIZE_FLOOR;
      return {
        moduleId: last.moduleId,
        confidence: last.confidence,
        series,
        latest: {
          fpRate: last.fpRate,
          helpfulRate: last.helpfulRate,
          samples: last.total,
          fpCount: last.fpCount,
          helpfulCount: last.helpfulCount,
          dismissedCount: last.dismissedCount,
          fixDidntHelpCount: last.fixDidntHelpCount,
          missedOtherCount: last.missedOtherCount,
        },
        sampleSizeReady,
        flagged: sampleSizeReady && last.fpRate >= FLAG_FP_RATE,
      };
    })
    .sort((a, b) => {
      if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
      return (a.confidence ?? '').localeCompare(b.confidence ?? '');
    });

  return (
    <FpRatesView
      buckets={buckets}
      windowDays={WINDOW_DAYS}
      sampleSizeFloor={SAMPLE_SIZE_FLOOR}
      flagFpRate={FLAG_FP_RATE}
    />
  );
}
