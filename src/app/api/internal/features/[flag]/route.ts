/**
 * Phase 3.7.1 — POST /api/internal/features/[flag]
 *
 * Upserts a FeatureFlag row, appends a FeatureFlagAudit entry, and invalidates
 * the in-process cache so subsequent getFeatureFlag() calls see the new value
 * within milliseconds (rather than waiting the 30s TTL).
 *
 * Body: { enabled: boolean, value?: unknown }. `value` is stored as JSON; the
 * helper parses it back on read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';
import { invalidateFeatureFlag } from '@/lib/feature-flags';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ToggleBody {
  enabled?: unknown;
  value?: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ flag: string }> },
) {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { flag } = await params;
  if (!flag || flag.length > 128) {
    return NextResponse.json({ error: 'Invalid flag key.' }, { status: 400 });
  }

  let body: ToggleBody;
  try {
    body = (await req.json()) as ToggleBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '`enabled` must be a boolean.' }, { status: 400 });
  }

  let valueJson: string | null = null;
  if (body.value !== undefined && body.value !== null) {
    try {
      valueJson = JSON.stringify(body.value);
    } catch {
      return NextResponse.json({ error: '`value` is not JSON-serializable.' }, { status: 400 });
    }
  }

  const updated = await prisma.featureFlag.upsert({
    where: { key: flag },
    update: { enabled: body.enabled, value: valueJson, updatedBy: user.email },
    create: { key: flag, enabled: body.enabled, value: valueJson, updatedBy: user.email },
  });

  await prisma.featureFlagAudit.create({
    data: {
      key: flag,
      enabled: body.enabled,
      value: valueJson,
      updatedBy: user.email,
    },
  });

  invalidateFeatureFlag(flag);

  logger.info('Feature flag flipped', { flag, enabled: body.enabled, by: user.email });

  return NextResponse.json({
    key: updated.key,
    enabled: updated.enabled,
    value: updated.value,
    updatedBy: updated.updatedBy,
    updatedAt: updated.updatedAt,
  });
}
