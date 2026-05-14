import { describe, it, expect, vi } from 'vitest';
import { writeFpRateSnapshots } from '@/lib/fp-rates/snapshots';
import type { ModuleRate } from '@/lib/fp-rates/aggregate';

function makePrisma(existingForDay: { id: string } | null = null) {
  const findFirst = vi.fn().mockResolvedValue(existingForDay);
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    client: { fpRateSnapshot: { findFirst, createMany } },
    findFirst,
    createMany,
  };
}

function rate(moduleId: string, confidence: string | null = null): ModuleRate {
  return {
    moduleId,
    confidence,
    total: 10,
    helpfulCount: 5,
    dismissedCount: 2,
    fpCount: 2,
    fixDidntHelpCount: 1,
    missedOtherCount: 0,
    fpRate: 0.2,
    helpfulRate: 0.5,
  };
}

describe('writeFpRateSnapshots', () => {
  it('returns false and skips write when rates is empty', async () => {
    const { client, createMany } = makePrisma();
    const wrote = await writeFpRateSnapshots(
      client as never,
      [],
      new Date('2026-05-14T09:00:00Z'),
    );
    expect(wrote).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('returns false when a snapshot already exists for the same UTC day', async () => {
    const { client, createMany } = makePrisma({ id: 'existing' });
    const wrote = await writeFpRateSnapshots(
      client as never,
      [rate('P1-05', 'high')],
      new Date('2026-05-14T23:30:00Z'),
    );
    expect(wrote).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('writes one row per rate when no snapshot exists yet for the day', async () => {
    const { client, createMany } = makePrisma(null);
    const wrote = await writeFpRateSnapshots(
      client as never,
      [rate('P1-05', 'high'), rate('P1-12')],
      new Date('2026-05-14T09:00:00Z'),
    );
    expect(wrote).toBe(true);
    expect(createMany).toHaveBeenCalledTimes(1);
    const call = createMany.mock.calls[0][0] as { data: unknown[] };
    expect(call.data).toHaveLength(2);
  });

  it('queries with a UTC day window aligned to midnight', async () => {
    const { client, findFirst } = makePrisma(null);
    await writeFpRateSnapshots(
      client as never,
      [rate('P1-05', 'high')],
      new Date('2026-05-14T23:30:00Z'),
    );
    const where = (findFirst.mock.calls[0][0] as { where: { snapshotAt: { gte: Date; lt: Date } } })
      .where;
    expect(where.snapshotAt.gte.toISOString()).toBe('2026-05-14T00:00:00.000Z');
    expect(where.snapshotAt.lt.toISOString()).toBe('2026-05-15T00:00:00.000Z');
  });
});
