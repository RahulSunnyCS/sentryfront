import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/dashboard-queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dashboard-queries')>();
  return {
    ...actual,
    listUserScans: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getCurrentUser } = await import('@/lib/auth/helpers');
const { listUserScans } = await import('@/lib/dashboard-queries');
const { GET } = await import('@/app/api/v1/scans/route');

describe('GET /api/v1/scans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null as never);

    const req = new NextRequest('http://localhost/api/v1/scans');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication');
  });

  it('calls listUserScans with default opts when no params', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'user-1', tier: 'free' } as never);
    vi.mocked(listUserScans).mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false });

    const req = new NextRequest('http://localhost/api/v1/scans');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listUserScans).toHaveBeenCalledWith('user-1', expect.objectContaining({
      cursor: null,
      sort: undefined,
      search: undefined,
      grade: undefined,
      status: undefined,
    }));
  });

  it('passes grade and sort params to listUserScans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'user-1', tier: 'free' } as never);
    vi.mocked(listUserScans).mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false });

    const req = new NextRequest('http://localhost/api/v1/scans?grade=F&sort=grade');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listUserScans).toHaveBeenCalledWith('user-1', expect.objectContaining({
      grade: 'F',
      sort: 'grade',
    }));
  });

  it('passes search and status params to listUserScans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'user-1', tier: 'free' } as never);
    vi.mocked(listUserScans).mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false });

    const req = new NextRequest('http://localhost/api/v1/scans?search=example&status=COMPLETED');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listUserScans).toHaveBeenCalledWith('user-1', expect.objectContaining({
      search: 'example',
      status: 'COMPLETED',
    }));
  });

  it('ignores invalid sort values', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'user-1', tier: 'free' } as never);
    vi.mocked(listUserScans).mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false });

    const req = new NextRequest('http://localhost/api/v1/scans?sort=invalid');
    await GET(req);

    expect(listUserScans).toHaveBeenCalledWith('user-1', expect.objectContaining({
      sort: undefined,
    }));
  });

  it('returns 500 on listUserScans error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'user-1', tier: 'free' } as never);
    vi.mocked(listUserScans).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/v1/scans');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
