import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAndNormalize, ValidationError } from '@/lib/url-validator';
import { runScan } from '@/lib/scan-worker';
import { getCurrentUser } from '@/lib/auth/helpers';
import { checkRateLimit, checkWeeklyScanQuota, getRateLimitHeaders } from '@/lib/rate-limiter';
import { listUserScans, type SortOption } from '@/lib/dashboard-queries';
import { logger } from '@/lib/logger';

function describeWait(ms: number): string {
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'less than a day';
  return `${days} days`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const url = req.nextUrl;
  const cursor = url.searchParams.get('cursor');
  const limitRaw = url.searchParams.get('limit');
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
  const offsetRaw = url.searchParams.get('offset');
  const parsedOffset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined;
  const offset = Number.isFinite(parsedOffset) && parsedOffset! >= 0 ? parsedOffset : undefined;
  const search = url.searchParams.get('search') ?? undefined;
  const grade = url.searchParams.get('grade') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const sortRaw = url.searchParams.get('sort');
  const VALID_SORTS: SortOption[] = ['date-desc', 'date-asc', 'grade', 'issues'];
  const sort: SortOption | undefined = VALID_SORTS.includes(sortRaw as SortOption)
    ? (sortRaw as SortOption)
    : undefined;

  try {
    const result = await listUserScans(user.id, { cursor, limit, offset, search, grade, status, sort });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    });
  } catch (err) {
    logger.error('Scan list failed', { userId: user.id }, err as Error);
    return NextResponse.json({ error: 'Failed to load scans.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  // Get current user (if authenticated)
  const user = await getCurrentUser();
  const tier = user?.tier || 'free';
  const identifier = user?.id || ip;

  // Check rate limit
  const rateLimitResult = await checkRateLimit(identifier, tier as 'free' | 'one-shot' | 'pro' | 'studio');
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded', {
      ip,
      userId: user?.id,
      tier,
      limit: rateLimitResult.limit,
    });

    return NextResponse.json(
      {
        error: `Rate limit exceeded. Maximum ${rateLimitResult.limit} scans per hour.`,
        limit: rateLimitResult.limit,
        reset: rateLimitResult.reset,
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: rateLimitHeaders,
      }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawUrl = body.url?.trim() ?? '';
  let targetUrl: string;
  try {
    targetUrl = await validateAndNormalize(rawUrl);
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.info('URL validation failed', { url: rawUrl, error: err.message, ip });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error('URL validation error', { url: rawUrl, ip }, err as Error);
    return NextResponse.json({ error: 'URL validation failed.' }, { status: 422 });
  }

  // Weekly quota: enforced per signed-in user. Anon scans rely on the
  // IP-based hourly rate-limit above.
  if (user) {
    const quota = await checkWeeklyScanQuota(user.id, tier as 'free' | 'one-shot' | 'pro' | 'studio');
    if (!quota.allowed) {
      const waitMs = quota.nextScanAt ? Math.max(0, quota.nextScanAt - Date.now()) : 0;
      logger.info('Weekly quota exhausted', { userId: user.id, tier, nextScanAt: quota.nextScanAt });
      return NextResponse.json(
        {
          error: `You've used your free scan this week. Next available in ${describeWait(waitMs)}, or upgrade for unlimited.`,
          reason: 'weekly_quota_exhausted',
          nextScanAt: quota.nextScanAt,
          upgradeUrl: '/pricing',
        },
        { status: 402 },
      );
    }
  }

  const scan = await prisma.scan.create({
    data: {
      targetUrl,
      requesterIp: ip,
      userId: user?.id || null,
      tier,
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  logger.info('Scan created', {
    scanId: scan.id,
    targetUrl: scan.targetUrl,
    userId: user?.id,
    tier,
    ip,
  });

  // Fire the worker.
  // - With REDIS_URL: enqueue via BullMQ (see src/lib/queue.ts, Phase 3+).
  // - Without REDIS_URL: run as a fire-and-forget Promise (fine for local dev).
  runScan(scan.id).catch((err) => {
    logger.error('Scan worker failed', { scanId: scan.id }, err);
  });

  return NextResponse.json(
    { id: scan.id, status: scan.status, targetUrl: scan.targetUrl },
    {
      status: 201,
      headers: rateLimitHeaders,
    }
  );
}
