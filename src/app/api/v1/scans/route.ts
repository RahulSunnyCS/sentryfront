import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAndNormalize, ValidationError } from '@/lib/url-validator';
import { runScan } from '@/lib/scan-worker';
import { getCurrentUser } from '@/lib/auth/helpers';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

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
  const rateLimitResult = await checkRateLimit(identifier, tier as any);
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

  const scan = await prisma.scan.create({
    data: {
      targetUrl,
      requesterIp: ip,
      userId: user?.id,
      tier,
    },
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
