/**
 * Enhanced Rate Limiter
 * 
 * Provides per-IP and per-user rate limiting with tier-based quotas.
 * Uses database for persistence across restarts.
 */

import { prisma } from './prisma';
import { type UserTier } from './tier-gating';
import { logger } from './logger';

// Rate limit configuration
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Default IP-based rate limits (when no user is authenticated)
const DEFAULT_IP_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);

// Weekly passive-scan quota for authenticated users
const WEEKLY_QUOTA_BY_TIER: Record<UserTier, number> = {
  free: 1,
  'one-shot': Number.MAX_SAFE_INTEGER,
  pro: Number.MAX_SAFE_INTEGER,
  studio: Number.MAX_SAFE_INTEGER,
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds until next allowed request
}

/**
 * Check rate limit for an IP address or user
 */
export async function checkRateLimit(
  identifier: string,
  tier: UserTier = 'free'
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Determine limit based on tier
  const limit = getTierLimit(tier);

  // Count scans within the current window
  const scanCount = await prisma.scan.count({
    where: {
      OR: [
        { requesterIp: identifier },
        { userId: identifier },
      ],
      startedAt: {
        gte: new Date(windowStart),
      },
    },
  });

  const remaining = Math.max(0, limit - scanCount);
  const allowed = scanCount < limit;

  // Calculate reset time (start of next window)
  const reset = now + RATE_LIMIT_WINDOW_MS;

  const result: RateLimitResult = {
    allowed,
    limit,
    remaining,
    reset: Math.floor(reset / 1000),
  };

  if (!allowed) {
    // Calculate retry-after (time until oldest scan expires from window)
    const oldestScan = await prisma.scan.findFirst({
      where: {
        OR: [
          { requesterIp: identifier },
          { userId: identifier },
        ],
        startedAt: {
          gte: new Date(windowStart),
        },
      },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    });

    if (oldestScan) {
      const retryAfterMs = oldestScan.startedAt.getTime() + RATE_LIMIT_WINDOW_MS - now;
      result.retryAfter = Math.ceil(retryAfterMs / 1000);
    }

    logger.warn('Rate limit exceeded', {
      identifier,
      tier,
      limit,
      scanCount,
    });
  }

  return result;
}

/**
 * Get rate limit for a tier
 */
function getTierLimit(tier: UserTier): number {
  // Pro and Studio tiers have unlimited scans
  if (tier === 'pro' || tier === 'studio') {
    return Number.MAX_SAFE_INTEGER; // Effectively unlimited
  }

  // Free and one-shot use default IP-based limit
  return DEFAULT_IP_LIMIT;
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

// ── Weekly Quota (per-user) ──────────────────────────────────────────────────

export interface WeeklyQuotaResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  nextScanAt: number | null; // Unix ms when the user's week rolls over, or null when unlimited
}

/**
 * Check and increment the per-user weekly scan quota.
 *
 * Resets the counter when the user's `scanWeekStart` is missing or older than
 * 7 days. When `consume` is true (default), increments the counter atomically
 * before returning — callers should only consume on the same path that creates
 * the scan record.
 */
export async function checkWeeklyScanQuota(
  userId: string,
  tier: UserTier,
  consume: boolean = true,
): Promise<WeeklyQuotaResult> {
  const limit = WEEKLY_QUOTA_BY_TIER[tier] ?? WEEKLY_QUOTA_BY_TIER.free;
  if (limit >= Number.MAX_SAFE_INTEGER) {
    return { allowed: true, limit, remaining: limit, nextScanAt: null };
  }

  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { scansThisWeek: true, scanWeekStart: true },
  });

  if (!user) {
    return { allowed: false, limit, remaining: 0, nextScanAt: null };
  }

  const weekStart = user.scanWeekStart;
  const isWindowOpen = weekStart !== null && now.getTime() - weekStart.getTime() < WEEK_MS;
  const currentCount = isWindowOpen ? user.scansThisWeek : 0;

  if (currentCount >= limit) {
    const nextScanAt = weekStart ? weekStart.getTime() + WEEK_MS : now.getTime();
    return { allowed: false, limit, remaining: 0, nextScanAt };
  }

  if (consume) {
    await prisma.user.update({
      where: { id: userId },
      data: isWindowOpen
        ? { scansThisWeek: { increment: 1 } }
        : { scansThisWeek: 1, scanWeekStart: now },
    });
  }

  const nextStart = isWindowOpen ? weekStart!.getTime() : now.getTime();
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - currentCount - (consume ? 1 : 0)),
    nextScanAt: nextStart + WEEK_MS,
  };
}

/**
 * Clean up old scan records (optional maintenance task)
 * Call this periodically to prevent database bloat
 */
export async function cleanupOldScans(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  const result = await prisma.scan.deleteMany({
    where: {
      startedAt: {
        lt: cutoff,
      },
      status: {
        in: ['COMPLETED', 'FAILED', 'TIMEOUT'],
      },
    },
  });

  logger.info('Cleaned up old scans', {
    deleted: result.count,
    cutoff: cutoff.toISOString(),
  });

  return result.count;
}
