/**
 * Phase 3.7.1 — POST /api/internal/scans/[id]/rerun
 *
 * Re-runs a scan by creating a NEW Scan row with the same targetUrl/userId/tier
 * (preserving history for diff comparisons) and firing runScan() fire-and-forget,
 * matching the pattern in src/app/api/v1/scans/route.ts.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';
import { runScan } from '@/lib/scan-worker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;
  const { user: admin } = auth;

  const { id } = await params;
  const original = await prisma.scan.findUnique({
    where: { id },
    select: { id: true, targetUrl: true, userId: true, tier: true },
  });
  if (!original) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const created = await prisma.scan.create({
    data: {
      targetUrl: original.targetUrl,
      userId: original.userId,
      tier: original.tier,
      requesterIp: `admin:${admin.id}`,
    },
  });

  await prisma.featureFlagAudit.create({
    data: {
      key: `scan-rerun:${original.id}`,
      enabled: true,
      value: JSON.stringify({ originalScanId: original.id, newScanId: created.id }),
      updatedBy: admin.email,
    },
  });

  runScan(created.id).catch((err) => {
    logger.error('Admin re-run scan worker failed', { scanId: created.id }, err);
  });

  logger.info('Admin re-ran scan', {
    originalScanId: original.id,
    newScanId: created.id,
    by: admin.email,
  });

  return NextResponse.json({
    newScanId: created.id,
    originalScanId: original.id,
    status: created.status,
    targetUrl: created.targetUrl,
  });
}
