import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface CachedResult {
  weekly: number;
  total: number;
  lastUpdated: string;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { value: CachedResult; expiresAt: number } | null = null;
let inflight: Promise<CachedResult> | null = null;

async function loadCounts(): Promise<CachedResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [weekly, total] = await Promise.all([
    prisma.scan.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
    prisma.scan.count(),
  ]);
  return {
    weekly,
    total,
    lastUpdated: new Date().toISOString(),
  };
}

async function getCounts(): Promise<CachedResult> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inflight) return inflight;

  inflight = loadCounts()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function GET() {
  try {
    const counts = await getCounts();
    return NextResponse.json(
      {
        count: counts.weekly,
        total: counts.total,
        last_updated: counts.lastUpdated,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
        },
      },
    );
  } catch (err) {
    logger.error('Scan count failed', {}, err as Error);
    return NextResponse.json({ error: 'Failed to load count.' }, { status: 500 });
  }
}
