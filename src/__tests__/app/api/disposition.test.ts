import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentUser: vi.fn(),
  isAuthEnabled: () => false,
}));

import { POST, GET } from '@/app/api/v1/scans/[id]/findings/[findingId]/disposition/route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';

const params = { id: 'scan-1', findingId: 'finding-1' };

function makeReq(body?: unknown): any {
  return {
    json: async () => body,
    headers: new Headers(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST disposition', () => {
  it('returns 401 when unauthenticated', async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const res = await POST(makeReq({ disposition: 'fp' }), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid disposition values', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    const res = await POST(makeReq({ disposition: 'lol' }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the scan is invisible to the caller', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    (prisma.scan.findUnique as any).mockResolvedValue({ id: 'scan-1', userId: 'someone-else' });
    const res = await POST(makeReq({ disposition: 'fp' }), { params });
    expect(res.status).toBe(404);
  });

  it('returns 404 when finding does not belong to the scan', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    (prisma.scan.findUnique as any).mockResolvedValue({ id: 'scan-1', userId: 'u1' });
    (prisma.finding.findUnique as any).mockResolvedValue({ scanId: 'other-scan' });
    const res = await POST(makeReq({ disposition: 'fp' }), { params });
    expect(res.status).toBe(404);
  });

  it('appends a row on the happy path', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    (prisma.scan.findUnique as any).mockResolvedValue({ id: 'scan-1', userId: 'u1' });
    (prisma.finding.findUnique as any).mockResolvedValue({ scanId: 'scan-1' });
    const created = { disposition: 'fp', createdAt: new Date() };
    (prisma.findingDisposition.create as any).mockResolvedValue(created);
    const res = await POST(makeReq({ disposition: 'fp' }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.disposition).toBe('fp');
    expect(prisma.findingDisposition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scanId: 'scan-1',
          findingId: 'finding-1',
          userId: 'u1',
          disposition: 'fp',
        }),
      }),
    );
  });

  it('returns 400 on malformed JSON body', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    const req = {
      json: async () => {
        throw new Error('bad');
      },
      headers: new Headers(),
    } as any;
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });
});

describe('GET disposition', () => {
  it('returns the latest disposition for the caller', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    (prisma.scan.findUnique as any).mockResolvedValue({ id: 'scan-1', userId: 'u1' });
    (prisma.findingDisposition.findFirst as any).mockResolvedValue({ disposition: 'helpful' });
    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.disposition).toBe('helpful');
    expect(prisma.findingDisposition.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns null disposition when none recorded', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: 'u1', email: 'a@b.c', tier: 'free' });
    (prisma.scan.findUnique as any).mockResolvedValue({ id: 'scan-1', userId: 'u1' });
    (prisma.findingDisposition.findFirst as any).mockResolvedValue(null);
    const res = await GET(makeReq(), { params });
    const data = await res.json();
    expect(data.disposition).toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(401);
  });
});
