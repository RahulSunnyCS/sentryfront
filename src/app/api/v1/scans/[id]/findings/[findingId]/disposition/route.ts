/**
 * Phase 3.7 — disposition POST/GET.
 *
 * POST records a user verdict on a finding (append-only). GET returns the
 * caller's most-recent disposition for the (scanId, findingId, userId) triple.
 * No demo voting — auth is always required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';
import { logger } from '@/lib/logger';

const VALID_DISPOSITIONS = new Set([
  'helpful',
  'dismissed',
  'fp',
  'fix_didnt_help',
  'missed_other',
]);

interface RouteParams {
  params: { id: string; findingId: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  logger.setScanScope(params.id);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: { disposition?: unknown };
  try {
    body = (await req.json()) as { disposition?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const disposition = typeof body.disposition === 'string' ? body.disposition : '';
  if (!VALID_DISPOSITIONS.has(disposition)) {
    return NextResponse.json({ error: 'Invalid disposition value.' }, { status: 400 });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!scan || !canViewScan(scan, user)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const finding = await prisma.finding.findUnique({
    where: { id: params.findingId },
    select: { scanId: true },
  });
  if (!finding || finding.scanId !== params.id) {
    return NextResponse.json({ error: 'Finding not found.' }, { status: 404 });
  }

  const row = await prisma.findingDisposition.create({
    data: {
      scanId: params.id,
      findingId: params.findingId,
      userId: user.id,
      disposition,
    },
    select: { disposition: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, disposition: row.disposition, createdAt: row.createdAt });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  logger.setScanScope(params.id);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!scan || !canViewScan(scan, user)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const latest = await prisma.findingDisposition.findFirst({
    where: { scanId: params.id, findingId: params.findingId, userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { disposition: true },
  });

  return NextResponse.json({ disposition: latest?.disposition ?? null });
}
