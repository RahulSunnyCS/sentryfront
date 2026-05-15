import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { checkRateLimit, checkWeeklyScanQuota, getRateLimitHeaders } from '@/lib/rate-limiter';
import { runExtensionScan } from '@/lib/extension-scan-worker';
import { logger } from '@/lib/logger';
import type { ExtensionScanInput } from '@/types/extension';

function validateInput(body: unknown): { data: ExtensionScanInput } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be an object.' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.url !== 'string') return { error: 'url must be a string.' };
  if (typeof b.html !== 'string') return { error: 'html must be a string.' };
  if (typeof b.statusCode !== 'number') return { error: 'statusCode must be a number.' };
  if (!b.headers || typeof b.headers !== 'object' || Array.isArray(b.headers)) {
    return { error: 'headers must be an object.' };
  }
  if (!Array.isArray(b.cookies)) return { error: 'cookies must be an array.' };
  if (!Array.isArray(b.jsBundleUrls)) return { error: 'jsBundleUrls must be an array.' };
  if (typeof b.inlineScriptContent !== 'string') return { error: 'inlineScriptContent must be a string.' };

  if (b.html.length > 10_000_000) return { error: 'html too large (max 10 MB).' };
  if (b.inlineScriptContent.length > 5_000_000) return { error: 'inlineScriptContent too large (max 5 MB).' };
  if ((b.cookies as unknown[]).length > 200) return { error: 'Too many cookies.' };
  if ((b.jsBundleUrls as unknown[]).length > 500) return { error: 'Too many jsBundleUrls.' };

  try {
    new URL(b.url as string);
  } catch {
    return { error: 'url is not a valid URL.' };
  }

  return {
    data: {
      url: b.url as string,
      html: b.html as string,
      statusCode: b.statusCode as number,
      headers: b.headers as Record<string, string>,
      cookies: b.cookies as ExtensionScanInput['cookies'],
      jsBundleUrls: (b.jsBundleUrls as unknown[]).filter((u) => typeof u === 'string') as string[],
      inlineScriptContent: b.inlineScriptContent as string,
      localStorageData: b.localStorageData as Record<string, string> | undefined,
      sessionStorageData: b.sessionStorageData as Record<string, string> | undefined,
      serviceWorkerRegistrations: b.serviceWorkerRegistrations as ExtensionScanInput['serviceWorkerRegistrations'],
    },
  };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const tier = (user.tier || 'free') as 'free' | 'one-shot' | 'pro' | 'studio';

  const rateLimitResult = await checkRateLimit(user.id, tier);
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Maximum ${rateLimitResult.limit} scans per hour.`,
        limit: rateLimitResult.limit,
        reset: rateLimitResult.reset,
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  const quota = await checkWeeklyScanQuota(user.id, tier);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: 'Weekly scan quota exhausted.',
        reason: 'weekly_quota_exhausted',
        nextScanAt: quota.nextScanAt,
        upgradeUrl: '/pricing',
      },
      { status: 402, headers: rateLimitHeaders },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = validateInput(body);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const input = validation.data;

  // Strip fragment from URL
  let targetUrl: string;
  try {
    const u = new URL(input.url);
    u.hash = '';
    targetUrl = u.href;
  } catch {
    return NextResponse.json({ error: 'Invalid URL.' }, { status: 422 });
  }

  const scan = await prisma.scan.create({
    data: {
      targetUrl,
      requesterIp: ip,
      userId: user.id,
      tier,
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  logger.info('Extension scan created', {
    scanId: scan.id,
    targetUrl,
    userId: user.id,
    tier,
  });

  runExtensionScan(scan.id, input).catch((err) => {
    logger.error('Extension scan worker failed', { scanId: scan.id }, err);
  });

  return NextResponse.json(
    { id: scan.id, status: scan.status, targetUrl: scan.targetUrl },
    { status: 201, headers: rateLimitHeaders },
  );
}
