import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse, NextRequest } from 'next/server';

const { assertAdminApi, upsert, createAudit, invalidateFeatureFlag } = vi.hoisted(() => ({
  assertAdminApi: vi.fn(),
  upsert: vi.fn(),
  createAudit: vi.fn(),
  invalidateFeatureFlag: vi.fn(),
}));
vi.mock('@/lib/auth/helpers', () => ({ assertAdminApi }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    featureFlag: { upsert },
    featureFlagAudit: { create: createAudit },
  },
}));
vi.mock('@/lib/feature-flags', () => ({ invalidateFeatureFlag }));

import { POST } from '@/app/api/internal/features/[flag]/route';

function adminOk() {
  assertAdminApi.mockResolvedValueOnce({
    ok: true,
    user: { id: 'a', email: 'admin@x.com', tier: 'pro' },
  });
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api/internal/features/k', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/features/[flag]', () => {
  beforeEach(() => {
    assertAdminApi.mockReset();
    upsert.mockReset();
    createAudit.mockReset();
    invalidateFeatureFlag.mockReset();
  });

  it('returns 404 for non-admin', async () => {
    assertAdminApi.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    });
    const res = await POST(makeReq({ enabled: true }), {
      params: Promise.resolve({ flag: 'k' }),
    });
    expect(res.status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects non-boolean enabled', async () => {
    adminOk();
    const res = await POST(makeReq({ enabled: 'yes' }), {
      params: Promise.resolve({ flag: 'k' }),
    });
    expect(res.status).toBe(400);
  });

  it('upserts, writes audit row, invalidates cache, and returns the row', async () => {
    adminOk();
    upsert.mockResolvedValueOnce({
      key: 'seo-depth',
      enabled: true,
      value: '{"depth":3}',
      updatedBy: 'admin@x.com',
      updatedAt: new Date('2026-05-14T09:00:00Z'),
    });
    const res = await POST(makeReq({ enabled: true, value: { depth: 3 } }), {
      params: Promise.resolve({ flag: 'seo-depth' }),
    });
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledTimes(1);
    expect(invalidateFeatureFlag).toHaveBeenCalledWith('seo-depth');

    const auditArg = createAudit.mock.calls[0][0] as {
      data: { key: string; enabled: boolean; value: string | null; updatedBy: string | null };
    };
    expect(auditArg.data.key).toBe('seo-depth');
    expect(auditArg.data.enabled).toBe(true);
    expect(auditArg.data.value).toBe('{"depth":3}');
    expect(auditArg.data.updatedBy).toBe('admin@x.com');
  });
});
