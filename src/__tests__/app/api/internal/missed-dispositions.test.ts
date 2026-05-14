import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getCurrentUser, findUnique, create } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@/lib/auth/helpers', () => ({ getCurrentUser }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scan: { findUnique },
    findingDisposition: { create },
  },
}));

vi.mock('@/lib/report-access', () => ({
  canViewScan: (scan: { userId: string | null }, user: { id: string } | null) =>
    scan.userId === null || (user !== null && user.id === scan.userId),
}));

import { POST } from '@/app/api/internal/dispositions/missed/route';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api/internal/dispositions/missed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/dispositions/missed', () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    findUnique.mockReset();
    create.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ scanId: 's1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when scanId is missing', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', tier: 'free' });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the scan does not exist', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', tier: 'free' });
    findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ scanId: 's1' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the user cannot view the scan (no leak)', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', tier: 'free' });
    findUnique.mockResolvedValueOnce({ id: 's1', userId: 'someone-else' });
    const res = await POST(makeReq({ scanId: 's1' }));
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('inserts a missed_other row with a synthetic findingId', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', tier: 'free' });
    findUnique.mockResolvedValueOnce({ id: 's1', userId: 'u1' });
    create.mockResolvedValueOnce({
      id: 'd1',
      disposition: 'missed_other',
      createdAt: new Date('2026-05-14T09:00:00Z'),
    });
    const res = await POST(
      makeReq({ scanId: 's1', moduleHint: 'P1-05', source: 'module' }),
    );
    expect(res.status).toBe(200);

    const arg = create.mock.calls[0][0] as {
      data: { scanId: string; userId: string; findingId: string; disposition: string };
    };
    expect(arg.data.scanId).toBe('s1');
    expect(arg.data.userId).toBe('u1');
    expect(arg.data.disposition).toBe('missed_other');
    expect(arg.data.findingId).toMatch(/^missed:s1:P1-05:[0-9a-f-]{36}$/);
  });

  it('sanitizes moduleHint and falls back to "unknown" when missing', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', tier: 'free' });
    findUnique.mockResolvedValueOnce({ id: 's1', userId: null });
    create.mockResolvedValueOnce({
      id: 'd2',
      disposition: 'missed_other',
      createdAt: new Date(),
    });
    const res = await POST(makeReq({ scanId: 's1' }));
    expect(res.status).toBe(200);
    const arg = create.mock.calls[0][0] as { data: { findingId: string } };
    expect(arg.data.findingId).toMatch(/^missed:s1:unknown:[0-9a-f-]{36}$/);
  });

  it('strips special characters from a hostile moduleHint', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: 'a@x.com', tier: 'free' });
    findUnique.mockResolvedValueOnce({ id: 's1', userId: 'u1' });
    create.mockResolvedValueOnce({
      id: 'd3',
      disposition: 'missed_other',
      createdAt: new Date(),
    });
    await POST(makeReq({ scanId: 's1', moduleHint: 'P1-05; DROP TABLE x' }));
    const arg = create.mock.calls[0][0] as { data: { findingId: string } };
    expect(arg.data.findingId).toMatch(/^missed:s1:P1-05DROPTABLEx:[0-9a-f-]{36}$/);
  });
});
