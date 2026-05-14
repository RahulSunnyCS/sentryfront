import { describe, it, expect } from 'vitest';
import { aggregateFpRates } from '@/lib/fp-rates/aggregate';

type Row = {
  findingId: string;
  userId: string;
  disposition: string;
  createdAt: Date;
  finding: { moduleId: string; confidence: string | null } | null;
};

function makePrisma(rows: Row[]) {
  // Mimics Prisma's orderBy + select shape. The aggregator passes
  // `orderBy: { createdAt: 'desc' }` already, but to be safe in tests we
  // pre-sort the input the way real Prisma would.
  const sorted = [...rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return {
    findingDisposition: {
      findMany: async () => sorted,
    },
  } as unknown as Parameters<typeof aggregateFpRates>[0];
}

const f = (moduleId: string, confidence: string | null = null) => ({
  moduleId,
  confidence,
});

describe('aggregateFpRates', () => {
  it('returns empty array when there are no dispositions', async () => {
    const out = await aggregateFpRates(makePrisma([]));
    expect(out).toEqual([]);
  });

  it('groups by (moduleId, confidence) and computes both fpRate and helpfulRate', async () => {
    const rows: Row[] = [
      { findingId: 'a', userId: 'u1', disposition: 'fp', createdAt: new Date(3), finding: f('P1-08', 'high') },
      { findingId: 'b', userId: 'u2', disposition: 'helpful', createdAt: new Date(2), finding: f('P1-08', 'high') },
      { findingId: 'c', userId: 'u3', disposition: 'helpful', createdAt: new Date(1), finding: f('P1-08', 'high') },
      { findingId: 'd', userId: 'u4', disposition: 'fp', createdAt: new Date(4), finding: f('P1-12', null) },
    ];
    const out = await aggregateFpRates(makePrisma(rows));
    const p108 = out.find((r) => r.moduleId === 'P1-08' && r.confidence === 'high')!;
    expect(p108.total).toBe(3);
    expect(p108.fpCount).toBe(1);
    expect(p108.helpfulCount).toBe(2);
    expect(p108.fpRate).toBeCloseTo(1 / 3);
    expect(p108.helpfulRate).toBeCloseTo(2 / 3);

    const p112 = out.find((r) => r.moduleId === 'P1-12')!;
    expect(p112.confidence).toBeNull();
    expect(p112.total).toBe(1);
    expect(p112.fpRate).toBe(1);
  });

  it('latest-wins: only the most-recent disposition per (userId, findingId) counts', async () => {
    const rows: Row[] = [
      // User u1 changed their mind: first said 'fp', later said 'helpful'.
      { findingId: 'a', userId: 'u1', disposition: 'helpful', createdAt: new Date(100), finding: f('P1-08', 'high') },
      { findingId: 'a', userId: 'u1', disposition: 'fp', createdAt: new Date(50), finding: f('P1-08', 'high') },
    ];
    const out = await aggregateFpRates(makePrisma(rows));
    expect(out).toHaveLength(1);
    expect(out[0].total).toBe(1);
    expect(out[0].helpfulCount).toBe(1);
    expect(out[0].fpCount).toBe(0);
    expect(out[0].fpRate).toBe(0);
  });

  it('dismissed and fix_didnt_help do NOT count toward fpRate (recall guard)', async () => {
    const rows: Row[] = [
      { findingId: 'a', userId: 'u1', disposition: 'dismissed', createdAt: new Date(1), finding: f('P1-08', 'high') },
      { findingId: 'b', userId: 'u2', disposition: 'fix_didnt_help', createdAt: new Date(2), finding: f('P1-08', 'high') },
      { findingId: 'c', userId: 'u3', disposition: 'fp', createdAt: new Date(3), finding: f('P1-08', 'high') },
    ];
    const out = await aggregateFpRates(makePrisma(rows));
    const row = out[0];
    expect(row.total).toBe(3);
    expect(row.dismissedCount).toBe(1);
    expect(row.fixDidntHelpCount).toBe(1);
    expect(row.fpCount).toBe(1);
    // Only the explicit FP click moves fpRate.
    expect(row.fpRate).toBeCloseTo(1 / 3);
  });

  it('puts findings with null confidence in their own bucket', async () => {
    const rows: Row[] = [
      { findingId: 'a', userId: 'u1', disposition: 'fp', createdAt: new Date(1), finding: f('P1-08', null) },
      { findingId: 'b', userId: 'u2', disposition: 'fp', createdAt: new Date(2), finding: f('P1-08', 'high') },
    ];
    const out = await aggregateFpRates(makePrisma(rows));
    expect(out).toHaveLength(2);
    const nullBucket = out.find((r) => r.confidence === null)!;
    const highBucket = out.find((r) => r.confidence === 'high')!;
    expect(nullBucket.total).toBe(1);
    expect(highBucket.total).toBe(1);
  });
});
