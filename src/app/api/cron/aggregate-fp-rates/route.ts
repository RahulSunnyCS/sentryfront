/**
 * Phase 3.7 — daily FP-rate aggregator (Vercel cron).
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel convention). In
 * non-production environments where CRON_SECRET is unset, auth is skipped
 * so local curl works.
 *
 * Always returns JSON. Writes the markdown section only when
 * FP_RATES_WRITE_LOCAL=1 — Vercel's runtime FS is read-only, so the actual
 * commit happens from a CI runner that mirrors this cron.
 */

import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aggregateFpRates } from '@/lib/fp-rates/aggregate';
import { writeFpRatesSection } from '@/lib/fp-rates/markdown-writer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const generatedAt = new Date();
  const rates = await aggregateFpRates(prisma);
  const totalDispositions = rates.reduce((sum, r) => sum + r.total, 0);

  let wrote = false;
  if (process.env.FP_RATES_WRITE_LOCAL === '1') {
    const target = path.join(process.cwd(), 'docs', 'core', 'MODULE_QUALITY.md');
    try {
      await writeFpRatesSection(rates, target, generatedAt);
      wrote = true;
    } catch (err) {
      logger.warn('Failed to write MODULE_QUALITY.md FP-rates section', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    modulesUpdated: rates.length,
    totalDispositions,
    generatedAt: generatedAt.toISOString(),
    wroteMarkdown: wrote,
    rates,
  });
}
