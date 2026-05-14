/**
 * Phase 3.7.1 — POST /api/internal/users/[id]/quota
 *
 * Admin quota override. Mutates User fields; writes a FeatureFlagAudit row
 * with key `quota:<userId>` so we have a single audit trail and don't need
 * a second table.
 *
 * Body: { scansThisWeek?: number, activeTestCredits?: number, tier?: string }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TIERS = new Set(['free', 'one-shot', 'pro', 'studio']);

interface QuotaBody {
  scansThisWeek?: unknown;
  activeTestCredits?: unknown;
  tier?: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;
  const { user: admin } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing user id.' }, { status: 400 });
  }

  let body: QuotaBody;
  try {
    body = (await req.json()) as QuotaBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const data: {
    scansThisWeek?: number;
    activeTestCredits?: number;
    tier?: string;
  } = {};

  if (body.scansThisWeek !== undefined) {
    if (typeof body.scansThisWeek !== 'number' || body.scansThisWeek < 0 || !Number.isFinite(body.scansThisWeek)) {
      return NextResponse.json({ error: '`scansThisWeek` must be a non-negative number.' }, { status: 400 });
    }
    data.scansThisWeek = Math.floor(body.scansThisWeek);
  }
  if (body.activeTestCredits !== undefined) {
    if (typeof body.activeTestCredits !== 'number' || body.activeTestCredits < 0 || !Number.isFinite(body.activeTestCredits)) {
      return NextResponse.json({ error: '`activeTestCredits` must be a non-negative number.' }, { status: 400 });
    }
    data.activeTestCredits = Math.floor(body.activeTestCredits);
  }
  if (body.tier !== undefined) {
    if (typeof body.tier !== 'string' || !ALLOWED_TIERS.has(body.tier)) {
      return NextResponse.json({ error: '`tier` must be one of: free, one-shot, pro, studio.' }, { status: 400 });
    }
    data.tier = body.tier;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      tier: true,
      scansThisWeek: true,
      activeTestCredits: true,
    },
  });

  await prisma.featureFlagAudit.create({
    data: {
      key: `quota:${id}`,
      enabled: true,
      value: JSON.stringify(data),
      updatedBy: admin.email,
    },
  });

  logger.info('Quota override applied', { targetUserId: id, by: admin.email, data });

  return NextResponse.json({ user: updated });
}
