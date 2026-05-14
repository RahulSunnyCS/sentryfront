/**
 * Phase 3.7.1 — POST /api/internal/dispositions/missed
 *
 * Recall-side telemetry: lets an authenticated user report that we missed an
 * issue on a scan. Inserts a FindingDisposition row with disposition
 * 'missed_other' and a synthetic findingId (no Finding row exists since
 * we didn't surface the finding).
 *
 * Synthetic findingId pattern: missed:<scanId>:<moduleHint>:<cuid>
 *   - scanId    — the scan that should have surfaced the finding
 *   - moduleHint — optional module the user thinks is responsible
 *                  (or 'unknown' when scan-level)
 *
 * This endpoint is NOT admin-gated: anyone signed in can submit a report on
 * a scan they can view. The /internal/dispositions explorer is admin-gated,
 * which is where reports actually get triaged.
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MissedBody {
  scanId?: unknown;
  moduleHint?: unknown;
  source?: unknown;
}

function sanitizeHint(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return cleaned.length > 0 ? cleaned : 'unknown';
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to flag missed issues.' }, { status: 401 });
  }

  let body: MissedBody;
  try {
    body = (await req.json()) as MissedBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.scanId !== 'string' || body.scanId.length === 0) {
    return NextResponse.json({ error: '`scanId` is required.' }, { status: 400 });
  }
  const source = body.source === 'module' ? 'module' : 'scan';
  const moduleHint = sanitizeHint(body.moduleHint);

  const scan = await prisma.scan.findUnique({
    where: { id: body.scanId },
    select: { id: true, userId: true },
  });
  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }
  if (!canViewScan(scan, user)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const findingId = `missed:${scan.id}:${moduleHint}:${randomUUID()}`;

  const created = await prisma.findingDisposition.create({
    data: {
      scanId: scan.id,
      findingId,
      userId: user.id,
      disposition: 'missed_other',
    },
  });

  logger.info('Missed-issue report received', {
    scanId: scan.id,
    moduleHint,
    source,
    userId: user.id,
  });

  return NextResponse.json({
    id: created.id,
    findingId,
    disposition: created.disposition,
    createdAt: created.createdAt,
  });
}
