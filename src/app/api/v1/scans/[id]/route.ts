import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';
import { logger } from '@/lib/logger';
import { normalizePerformanceMetrics } from '@/lib/scan-worker';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  logger.setScanScope(params.id);
  const scan = await prisma.scan.findUnique({ where: { id: params.id } });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!canViewScan(scan, user)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  // Parse and normalise performanceMetrics.
  //
  // We run the raw JSON through normalizePerformanceMetrics so that:
  //  - Old blobs (no scoreSource) resolve scoreSource → 'lab' (safe back-compat).
  //  - UNAVAILABLE blobs (scoreSource:'unavailable') are passed through verbatim.
  //  - Partial/ambiguous blobs get a safe scoreSource rather than silently
  //    inheriting 'lab', which could mislabel a failed scan.
  //
  // null-safety: if performanceMetrics is null/absent (feature disabled or old
  // schema), we pass null through — no throw.
  let parsedPerformanceMetrics: ReturnType<typeof normalizePerformanceMetrics> | null = null;
  if (scan.performanceMetrics) {
    try {
      const raw = JSON.parse(scan.performanceMetrics) as Record<string, unknown>;
      parsedPerformanceMetrics = normalizePerformanceMetrics(raw);
    } catch {
      // Corrupt JSON: treat as absent rather than throwing a 500 to the client.
      logger.warn('Failed to parse performanceMetrics JSON', { scanId: params.id });
      parsedPerformanceMetrics = null;
    }
  }

  // performanceScore: the DB column is a Float? (nullable).
  // Coerce to null when absent so the client receives a well-typed null rather
  // than undefined (which JSON.stringify omits).
  const performanceScore = scan.performanceScore ?? null;

  return NextResponse.json({
    id: scan.id,
    targetUrl: scan.targetUrl,
    status: scan.status,
    grade: scan.grade,
    score: scan.score,
    stack: scan.stack,
    summary: scan.summary ? JSON.parse(scan.summary) : null,
    performanceGrade: scan.performanceGrade,
    performanceScore,
    performanceMetrics: parsedPerformanceMetrics,
    accessibilityGrade: scan.accessibilityGrade,
    accessibilityScore: scan.accessibilityScore,
    accessibilityMetrics: scan.accessibilityMetrics ? JSON.parse(scan.accessibilityMetrics) : null,
    seoGrade: scan.seoGrade,
    seoScore: scan.seoScore,
    seoMetrics: scan.seoMetrics ? JSON.parse(scan.seoMetrics) : null,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
  });
}
