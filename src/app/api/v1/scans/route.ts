import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAndNormalize, ValidationError } from '@/lib/url-validator';
import { runScan } from '@/lib/scan-worker';

// In-memory rate limiter: { ip → [timestamps] }
// Good enough for Phase 2. Replace with Redis-backed limiter in production.
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const hits = (rateLimitStore.get(ip) ?? []).filter((t) => now - t < window);
  if (hits.length >= RATE_LIMIT) {
    throw Object.assign(new Error(`Rate limit exceeded. Max ${RATE_LIMIT} scans per hour.`), {
      status: 429,
    });
  }
  hits.push(now);
  rateLimitStore.set(ip, hits);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  try {
    checkRateLimit(ip);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 429 });
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
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'URL validation failed.' }, { status: 422 });
  }

  const scan = await prisma.scan.create({
    data: { targetUrl, requesterIp: ip },
  });

  // Fire the worker.
  // - With REDIS_URL: enqueue via BullMQ (see src/lib/queue.ts, Phase 3+).
  // - Without REDIS_URL: run as a fire-and-forget Promise (fine for local dev).
  runScan(scan.id).catch((err) =>
    console.error(`[worker] scan ${scan.id} failed:`, err),
  );

  return NextResponse.json(
    { id: scan.id, status: scan.status, targetUrl: scan.targetUrl },
    { status: 201 },
  );
}
