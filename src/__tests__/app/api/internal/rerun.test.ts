import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { assertAdminApi, findUnique, create, createAudit, runScan } = vi.hoisted(() => ({
  assertAdminApi: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  createAudit: vi.fn(),
  runScan: vi.fn(),
}));
vi.mock('@/lib/auth/helpers', () => ({ assertAdminApi }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scan: { findUnique, create },
    featureFlagAudit: { create: createAudit },
  },
}));
vi.mock('@/lib/scan-worker', () => ({ runScan }));

import { POST } from '@/app/api/internal/scans/[id]/rerun/route';

function adminOk() {
  assertAdminApi.mockResolvedValueOnce({
    ok: true,
    user: { id: 'admin1', email: 'admin@x.com', tier: 'pro' },
  });
}

describe('POST /api/internal/scans/[id]/rerun', () => {
  beforeEach(() => {
    assertAdminApi.mockReset();
    findUnique.mockReset();
    create.mockReset();
    createAudit.mockReset();
    runScan.mockReset();
    runScan.mockResolvedValue(undefined);
  });

  it('returns 404 for non-admin', async () => {
    assertAdminApi.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    });
    const res = await POST(new Request('http://x'), {
      params: Promise.resolve({ id: 'scan1' }),
    });
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 404 when scan does not exist', async () => {
    adminOk();
    findUnique.mockResolvedValueOnce(null);
    const res = await POST(new Request('http://x'), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('creates a NEW scan row with same targetUrl/userId/tier and fires runScan', async () => {
    adminOk();
    findUnique.mockResolvedValueOnce({
      id: 'scan1',
      targetUrl: 'https://example.com',
      userId: 'user1',
      tier: 'free',
    });
    create.mockResolvedValueOnce({
      id: 'scan2',
      targetUrl: 'https://example.com',
      status: 'QUEUED',
    });
    const res = await POST(new Request('http://x'), {
      params: Promise.resolve({ id: 'scan1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { newScanId: string; originalScanId: string };
    expect(body.newScanId).toBe('scan2');
    expect(body.originalScanId).toBe('scan1');

    const createArg = create.mock.calls[0][0] as {
      data: { targetUrl: string; userId: string | null; tier: string };
    };
    expect(createArg.data.targetUrl).toBe('https://example.com');
    expect(createArg.data.userId).toBe('user1');
    expect(createArg.data.tier).toBe('free');

    expect(runScan).toHaveBeenCalledWith('scan2');
    expect(createAudit).toHaveBeenCalledTimes(1);
  });
});
