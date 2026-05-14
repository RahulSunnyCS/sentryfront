import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';
import { applyTierGating } from '@/lib/tier-gating';
import { logger } from '@/lib/logger';
import type { Severity } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  logger.setScanScope(params.id);

  // Auth wall: when auth is enabled, findings require a sign-in.
  // Demo scan stays public.
  const user = await getCurrentUser();
  if (isAuthEnabled() && params.id !== 'demo' && !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
    include: { findings: true },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  if (!canViewScan(scan, user)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  if (!['COMPLETED', 'FAILED'].includes(scan.status)) {
    return NextResponse.json({ error: 'Scan is not yet complete.' }, { status: 409 });
  }

  // Map findings to response format
  const findings = scan.findings.map((f) => ({
    id: f.id,
    module: f.moduleId, // Frontend expects 'module' not 'moduleId'
    severity: f.severity as Severity,
    category: f.category,
    title: f.title,
    location: f.location,
    evidence: f.evidence,
    explanation: f.explanation,
    impact: f.impact,
    fixManual: JSON.parse(f.fixManual) as string[],
    fixAiPrompt: f.fixAiPrompt,
  }));

  const tier = user?.tier || scan.tier || 'free';

  // Apply tier-based gating
  const gated = applyTierGating(findings, tier);

  return NextResponse.json({
    findings: gated.findings,
    meta: {
      isLimited: gated.isLimited,
      tier: gated.tier,
      total: gated.total,
      shown: gated.findings.length,
      ...(gated.isLimited && {
        limit: gated.limit,
        hiddenCount: gated.hiddenCount,
      }),
    },
  });
}
