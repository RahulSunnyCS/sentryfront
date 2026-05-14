/**
 * Phase 3.7.1 — GET /api/internal/dispositions?moduleId=&userId=&scanId=&limit=
 *
 * Filtered dispositions explorer. Joins with Finding to surface moduleId for
 * real findings; missed_other rows have a synthetic findingId and no Finding
 * row, so moduleId comes from the findingId pattern (missed:<scanId>:<hint>).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const moduleId = sp.get('moduleId')?.trim() || undefined;
  const userId = sp.get('userId')?.trim() || undefined;
  const scanId = sp.get('scanId')?.trim() || undefined;
  const limitRaw = Number.parseInt(sp.get('limit') ?? '', 10);
  const limit = Math.min(
    MAX_LIMIT,
    Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT,
  );

  // We can't filter by moduleId via Prisma `where` because findingId has no FK
  // to Finding. Fetch a wider window and filter in memory; bounded by `limit`
  // multiplied to give the filter headroom.
  const rows = await prisma.findingDisposition.findMany({
    where: {
      userId: userId,
      scanId: scanId,
    },
    orderBy: { createdAt: 'desc' },
    take: moduleId ? Math.max(limit * 5, 200) : limit,
  });

  // Look up Finding rows in one batch for moduleId resolution.
  const findingIds = rows
    .map((r) => r.findingId)
    .filter((id) => !id.startsWith('missed:'));
  const findings = findingIds.length
    ? await prisma.finding.findMany({
        where: { id: { in: findingIds } },
        select: { id: true, moduleId: true, title: true, severity: true },
      })
    : [];
  const findingById = new Map(findings.map((f) => [f.id, f]));

  const enriched = rows.map((row) => {
    let moduleIdResolved: string | null = null;
    let title: string | null = null;
    let severity: string | null = null;
    if (row.findingId.startsWith('missed:')) {
      const parts = row.findingId.split(':');
      moduleIdResolved = parts[2] || 'unknown';
    } else {
      const f = findingById.get(row.findingId);
      if (f) {
        moduleIdResolved = f.moduleId;
        title = f.title;
        severity = f.severity;
      }
    }
    return {
      id: row.id,
      scanId: row.scanId,
      findingId: row.findingId,
      userId: row.userId,
      disposition: row.disposition,
      createdAt: row.createdAt,
      moduleId: moduleIdResolved,
      title,
      severity,
    };
  });

  const filtered = moduleId
    ? enriched.filter((r) => r.moduleId === moduleId).slice(0, limit)
    : enriched;

  return NextResponse.json({ rows: filtered, limit });
}
