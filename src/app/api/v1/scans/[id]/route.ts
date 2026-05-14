import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';
import { logger } from '@/lib/logger';

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

  return NextResponse.json({
    id: scan.id,
    targetUrl: scan.targetUrl,
    status: scan.status,
    grade: scan.grade,
    score: scan.score,
    stack: scan.stack,
    summary: scan.summary ? JSON.parse(scan.summary) : null,
    performanceGrade: scan.performanceGrade,
    performanceScore: scan.performanceScore,
    performanceMetrics: scan.performanceMetrics ? JSON.parse(scan.performanceMetrics) : null,
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
