/**
 * Phase 3.7.1 — POST /api/internal/cron/run/[name]
 *
 * Allows an admin to force-run a registered cron job in-process. Whitelisted
 * by name so admin auth alone doesn't open arbitrary endpoint invocation;
 * each handler is responsible for its own idempotency.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';
import { aggregateFpRates } from '@/lib/fp-rates/aggregate';
import { writeFpRateSnapshots } from '@/lib/fp-rates/snapshots';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CronHandler = () => Promise<unknown>;

const CRONS: Record<string, CronHandler> = {
  'aggregate-fp-rates': async () => {
    const generatedAt = new Date();
    const rates = await aggregateFpRates(prisma);
    const wroteSnapshot = await writeFpRateSnapshots(prisma, rates, generatedAt);
    return {
      modulesUpdated: rates.length,
      totalDispositions: rates.reduce((sum, r) => sum + r.total, 0),
      generatedAt: generatedAt.toISOString(),
      wroteSnapshot,
    };
  },
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;
  const { user: admin } = auth;

  const { name } = await params;
  const handler = CRONS[name];
  if (!handler) {
    return NextResponse.json({ error: 'Unknown cron.' }, { status: 404 });
  }

  logger.info('Admin force-run cron', { cron: name, by: admin.email });
  try {
    const result = await handler();
    return NextResponse.json({ cron: name, result });
  } catch (err) {
    logger.error('Admin cron handler failed', { cron: name }, err as Error);
    return NextResponse.json(
      { error: 'Cron handler failed.', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
