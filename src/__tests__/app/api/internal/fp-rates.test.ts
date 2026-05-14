import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { assertAdminApi, findMany } = vi.hoisted(() => ({
  assertAdminApi: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock('@/lib/auth/helpers', () => ({ assertAdminApi }));
vi.mock('@/lib/prisma', () => ({
  prisma: { fpRateSnapshot: { findMany } },
}));

import { GET } from '@/app/api/internal/fp-rates/route';

function snap(overrides: {
  moduleId: string;
  confidence?: string | null;
  total: number;
  fpRate: number;
  snapshotAt?: Date;
}) {
  return {
    id: Math.random().toString(36).slice(2),
    snapshotAt: overrides.snapshotAt ?? new Date(),
    moduleId: overrides.moduleId,
    confidence: overrides.confidence ?? null,
    total: overrides.total,
    fpCount: Math.round(overrides.total * overrides.fpRate),
    helpfulCount: 0,
    dismissedCount: 0,
    fixDidntHelpCount: 0,
    missedOtherCount: 0,
    fpRate: overrides.fpRate,
    helpfulRate: 0,
  };
}

function adminOk() {
  assertAdminApi.mockResolvedValueOnce({
    ok: true,
    user: { id: 'a', email: 'admin@x.com', tier: 'pro' },
  });
}

describe('GET /api/internal/fp-rates', () => {
  beforeEach(() => {
    findMany.mockReset();
    assertAdminApi.mockReset();
  });

  it('returns 404 for non-admin (route existence hidden)', async () => {
    assertAdminApi.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    });
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('does NOT flag a module with samples below the 30-sample floor', async () => {
    adminOk();
    findMany.mockResolvedValue([snap({ moduleId: 'P1-05', total: 29, fpRate: 0.5 })]);
    const res = await GET();
    const body = (await res.json()) as { buckets: { flagged: boolean; sampleSizeReady: boolean }[] };
    expect(body.buckets[0].flagged).toBe(false);
    expect(body.buckets[0].sampleSizeReady).toBe(false);
  });

  it('flags a module at the boundary (samples=30, fp=5%)', async () => {
    adminOk();
    findMany.mockResolvedValue([snap({ moduleId: 'P1-05', total: 30, fpRate: 0.05 })]);
    const res = await GET();
    const body = (await res.json()) as { buckets: { flagged: boolean }[] };
    expect(body.buckets[0].flagged).toBe(true);
  });

  it('does NOT flag when samples ≥ 30 but fpRate is below 5%', async () => {
    adminOk();
    findMany.mockResolvedValue([snap({ moduleId: 'P1-05', total: 100, fpRate: 0.04 })]);
    const res = await GET();
    const body = (await res.json()) as { buckets: { flagged: boolean; sampleSizeReady: boolean }[] };
    expect(body.buckets[0].flagged).toBe(false);
    expect(body.buckets[0].sampleSizeReady).toBe(true);
  });
});
