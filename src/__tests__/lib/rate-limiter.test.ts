/**
 * Unit tests for src/lib/rate-limiter.ts
 *
 * Prisma is fully mocked in vitest.setup.ts. The logger is also mocked here to
 * suppress warn output in test runs (logger internally calls console.log which
 * is already silenced by setup, but we mock the module to avoid any Sentry calls).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger to avoid Sentry side-effects in unit tests.
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import {
  checkRateLimit,
  getRateLimitHeaders,
  checkWeeklyScanQuota,
  cleanupOldScans,
  type RateLimitResult,
} from '@/lib/rate-limiter';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScan(startedAtMs: number) {
  return { startedAt: new Date(startedAtMs) };
}

// ── checkRateLimit ────────────────────────────────────────────────────────────

describe('checkRateLimit()', () => {
  beforeEach(() => {
    // Default: no scans in window — under limit
    vi.mocked(prisma.scan.count).mockResolvedValue(0);
    vi.mocked(prisma.scan.findFirst).mockResolvedValue(null);
  });

  it('returns allowed:true and full remaining when scan count is 0', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(0);

    const result = await checkRateLimit('1.2.3.4', 'free');

    expect(result.allowed).toBe(true);
    // remaining = limit - 0 = limit (default 10 from RATE_LIMIT_PER_HOUR or env)
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('returns allowed:true when scan count is below the limit', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(3);

    const result = await checkRateLimit('1.2.3.4', 'free');

    expect(result.allowed).toBe(true);
    // remaining must be non-negative
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('returns allowed:false when scan count equals the limit', async () => {
    // The default IP limit is 10 (RATE_LIMIT_PER_HOUR env defaults to 10).
    // We mock count to equal that value so the guard (scanCount < limit) is false.
    const defaultLimit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
    vi.mocked(prisma.scan.count).mockResolvedValue(defaultLimit);

    // findFirst for retry-after calculation
    const oldestMs = Date.now() - 100;
    vi.mocked(prisma.scan.findFirst).mockResolvedValue(makeScan(oldestMs) as any);

    const result = await checkRateLimit('1.2.3.4', 'free');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('includes retryAfter when rate limited and an oldest scan exists', async () => {
    const defaultLimit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
    vi.mocked(prisma.scan.count).mockResolvedValue(defaultLimit);

    const oldestMs = Date.now() - 1000; // 1 second ago
    vi.mocked(prisma.scan.findFirst).mockResolvedValue(makeScan(oldestMs) as any);

    const result = await checkRateLimit('1.2.3.4', 'free');

    expect(result.retryAfter).toBeDefined();
    // retryAfter should be a positive number (seconds until window rolls over)
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('does not include retryAfter when allowed', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(0);

    const result = await checkRateLimit('1.2.3.4', 'free');

    expect(result.retryAfter).toBeUndefined();
  });

  it('pro tier receives effectively unlimited limit (MAX_SAFE_INTEGER)', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(9999);

    const result = await checkRateLimit('user-pro-123', 'pro');

    // Pro tier limit is Number.MAX_SAFE_INTEGER — even 9999 scans are under it
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('studio tier receives effectively unlimited limit', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(9999);

    const result = await checkRateLimit('user-studio-123', 'studio');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('free and one-shot tiers share the IP-based default limit', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(0);

    const freeResult = await checkRateLimit('1.2.3.4', 'free');
    const oneShotResult = await checkRateLimit('1.2.3.4', 'one-shot');

    const defaultLimit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
    expect(freeResult.limit).toBe(defaultLimit);
    expect(oneShotResult.limit).toBe(defaultLimit);
  });

  it('includes a reset timestamp in the future', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(0);
    const before = Math.floor(Date.now() / 1000);

    const result = await checkRateLimit('1.2.3.4', 'free');

    expect(result.reset).toBeGreaterThan(before);
  });

  it('queries the DB with both requesterIp and userId filters for the identifier', async () => {
    vi.mocked(prisma.scan.count).mockResolvedValue(0);

    await checkRateLimit('some-identifier', 'free');

    expect(prisma.scan.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { requesterIp: 'some-identifier' },
            { userId: 'some-identifier' },
          ]),
        }),
      }),
    );
  });
});

// ── getRateLimitHeaders ───────────────────────────────────────────────────────

describe('getRateLimitHeaders()', () => {
  it('returns the three standard rate-limit headers', () => {
    const result: RateLimitResult = {
      allowed: true,
      limit: 10,
      remaining: 7,
      reset: 1700000000,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('7');
    expect(headers['X-RateLimit-Reset']).toBe('1700000000');
  });

  it('includes Retry-After only when retryAfter is present', () => {
    const resultWithRetry: RateLimitResult = {
      allowed: false,
      limit: 10,
      remaining: 0,
      reset: 1700000000,
      retryAfter: 120,
    };

    const headers = getRateLimitHeaders(resultWithRetry);
    expect(headers['Retry-After']).toBe('120');
  });

  it('omits Retry-After when retryAfter is absent', () => {
    const result: RateLimitResult = {
      allowed: true,
      limit: 10,
      remaining: 5,
      reset: 1700000000,
    };

    const headers = getRateLimitHeaders(result);
    expect(headers['Retry-After']).toBeUndefined();
  });
});

// ── checkWeeklyScanQuota ──────────────────────────────────────────────────────

describe('checkWeeklyScanQuota()', () => {
  it('returns allowed:true immediately for non-free tiers (unlimited quota)', async () => {
    // one-shot, pro, studio all map to MAX_SAFE_INTEGER in the weekly quota table
    const result = await checkWeeklyScanQuota('user-pro', 'pro', false);

    expect(result.allowed).toBe(true);
    expect(result.nextScanAt).toBeNull();
    // Prisma should not have been called since the limit is unlimited
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns allowed:false when user is not found in the DB', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await checkWeeklyScanQuota('ghost-user', 'free', false);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns allowed:true and decrements remaining when within weekly limit', async () => {
    // free tier limit = 1; user has used 0 scans in an open window
    const now = new Date();
    const weekStart = new Date(now.getTime() - 1000); // window just started
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      scansThisWeek: 0,
      scanWeekStart: weekStart,
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const result = await checkWeeklyScanQuota('user-free', 'free', true);

    expect(result.allowed).toBe(true);
    // After consuming 1 of 1 allowed, remaining = 0
    expect(result.remaining).toBe(0);
  });

  it('returns allowed:false when weekly quota is exhausted', async () => {
    // free tier limit = 1; user has already used 1
    const weekStart = new Date(Date.now() - 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      scansThisWeek: 1,
      scanWeekStart: weekStart,
    } as any);

    const result = await checkWeeklyScanQuota('user-free', 'free', false);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.nextScanAt).not.toBeNull();
  });

  it('resets counter when scan window is older than 7 days', async () => {
    // window is expired (started > 7 days ago)
    const expiredStart = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      scansThisWeek: 99, // high count but window is expired
      scanWeekStart: expiredStart,
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const result = await checkWeeklyScanQuota('user-free', 'free', true);

    // Even though scansThisWeek was 99, the expired window resets currentCount to 0
    expect(result.allowed).toBe(true);
  });

  it('does not call prisma.user.update when consume is false', async () => {
    const weekStart = new Date(Date.now() - 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      scansThisWeek: 0,
      scanWeekStart: weekStart,
    } as any);

    await checkWeeklyScanQuota('user-free', 'free', false);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

// ── cleanupOldScans ───────────────────────────────────────────────────────────

describe('cleanupOldScans()', () => {
  it('deletes scans older than the specified days and returns the count', async () => {
    vi.mocked(prisma.scan.deleteMany).mockResolvedValue({ count: 5 } as any);

    const deleted = await cleanupOldScans(30);

    expect(deleted).toBe(5);
    expect(prisma.scan.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['COMPLETED', 'FAILED', 'TIMEOUT'] },
        }),
      }),
    );
  });

  it('uses 30-day default when no argument is passed', async () => {
    vi.mocked(prisma.scan.deleteMany).mockResolvedValue({ count: 0 } as any);

    await cleanupOldScans();

    // Verify deleteMany was called (default = 30 days)
    expect(prisma.scan.deleteMany).toHaveBeenCalledTimes(1);
  });
});
