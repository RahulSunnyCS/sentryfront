/**
 * Phase 3.7.1 — GET /api/internal/features
 *
 * Lists all FeatureFlag rows plus the most recent 5 FeatureFlagAudit rows
 * per flag key, so the admin page can render the current state and the
 * recent change history without N+1 round-trips.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
  });

  const audit = await prisma.featureFlagAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const auditByKey = new Map<string, typeof audit>();
  for (const row of audit) {
    let arr = auditByKey.get(row.key);
    if (!arr) {
      arr = [];
      auditByKey.set(row.key, arr);
    }
    if (arr.length < 5) arr.push(row);
  }

  return NextResponse.json({
    flags: flags.map((f) => ({
      key: f.key,
      enabled: f.enabled,
      value: f.value,
      updatedBy: f.updatedBy,
      updatedAt: f.updatedAt,
      recentAudit: auditByKey.get(f.key) ?? [],
    })),
  });
}
