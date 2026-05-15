import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';

const mockScan = (overrides: Record<string, unknown> = {}) => ({
  id: 'scan-1',
  targetUrl: 'https://example.com',
  status: 'COMPLETED',
  grade: 'B',
  score: 82,
  summary: JSON.stringify({ CRITICAL: 0, HIGH: 1, MEDIUM: 2 }),
  startedAt: new Date('2026-05-10T10:00:00Z'),
  completedAt: new Date('2026-05-10T10:01:30Z'),
  ...overrides,
});

describe('listUserScans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns date-desc keyset paginated results by default', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    const rows = [
      mockScan({ id: 'scan-1', startedAt: new Date('2026-05-10T10:00:00Z') }),
      mockScan({ id: 'scan-2', startedAt: new Date('2026-05-09T10:00:00Z') }),
    ];
    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce(rows as never);

    const result = await listUserScans('user-1');

    expect(prisma.scan.findMany).toHaveBeenCalledOnce();
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('scan-1');
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=true and nextCursor when more rows exist', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    const rows = Array.from({ length: 21 }, (_, i) =>
      mockScan({ id: `scan-${i}`, startedAt: new Date(Date.now() - i * 1000) }),
    );
    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce(rows as never);

    const result = await listUserScans('user-1', { limit: 20 });

    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it('filters by grade when grade option is provided', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce([
      mockScan({ grade: 'F', score: 40 }),
    ] as never);

    const result = await listUserScans('user-1', { grade: 'F' });

    expect(prisma.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ grade: 'F' }),
      }),
    );
    expect(result.items[0].grade).toBe('F');
  });

  it('filters by status when status option is provided', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce([
      mockScan({ status: 'FAILED', grade: null, score: null }),
    ] as never);

    const result = await listUserScans('user-1', { status: 'FAILED' });

    expect(prisma.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(result.items[0].status).toBe('FAILED');
  });

  it('filters by search URL substring (case-insensitive)', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce([
      mockScan({ targetUrl: 'https://example.com' }),
      mockScan({ id: 'scan-2', targetUrl: 'https://other.io' }),
    ] as never);

    const result = await listUserScans('user-1', { search: 'EXAMPLE' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].url).toBe('https://example.com');
  });

  it('sorts by grade using OFFSET pagination', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce([
      mockScan({ grade: 'A', score: 95 }),
      mockScan({ id: 'scan-2', grade: 'F', score: 30 }),
    ] as never);

    const result = await listUserScans('user-1', { sort: 'grade' });

    expect(prisma.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ grade: 'asc' }, { startedAt: 'desc' }],
      }),
    );
    expect(result.nextCursor).toBeNull();
  });

  it('sorts by issues in-memory over capped window', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce([
      mockScan({ id: 'scan-low', summary: JSON.stringify({ CRITICAL: 0, HIGH: 0, MEDIUM: 1 }) }),
      mockScan({ id: 'scan-high', summary: JSON.stringify({ CRITICAL: 3, HIGH: 2, MEDIUM: 1 }) }),
    ] as never);

    const result = await listUserScans('user-1', { sort: 'issues' });

    expect(result.items[0].id).toBe('scan-high');
    expect(result.items[1].id).toBe('scan-low');
    expect(result.nextCursor).toBeNull();
  });

  it('handles OFFSET for date-asc sort', async () => {
    const { listUserScans } = await import('@/lib/dashboard-queries');

    vi.mocked(prisma.scan.findMany).mockResolvedValueOnce([
      mockScan({ id: 'scan-old', startedAt: new Date('2026-01-01') }),
    ] as never);

    const result = await listUserScans('user-1', { sort: 'date-asc', offset: 5 });

    expect(prisma.scan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        skip: 5,
      }),
    );
    expect(result.items[0].id).toBe('scan-old');
  });
});
