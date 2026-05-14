import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { parseActiveTestSummary } from '@/lib/active-test-worker';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
    include: {
      findings: {
        select: {
          id: true,
          moduleId: true,
          severity: true,
          category: true,
          title: true,
          location: true,
          evidence: true,
          explanation: true,
          impact: true,
          fixAiPrompt: true,
        },
      },
    },
  });
  if (!scan || scan.userId !== user.id) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const summary = parseActiveTestSummary(scan.summary);
  if (!summary) {
    return NextResponse.json({ error: 'Not an active test.' }, { status: 400 });
  }

  const findingProbes = new Set(scan.findings.map((f) => f.moduleId));
  const passed = (summary.passed ?? summary.tests).filter((t) => !findingProbes.has(t));

  return NextResponse.json({
    scan_id: scan.id,
    status: scan.status,
    domain: new URL(scan.targetUrl).hostname,
    tests: summary.tests,
    findings: scan.findings.map((f) => ({
      id: f.id,
      probe: f.moduleId,
      title: f.title,
      severity: f.severity.toLowerCase(),
      sent: f.location,
      received: f.evidence,
      impact: f.impact,
      prompt: f.fixAiPrompt,
    })),
    passed,
    summary: {
      critical: summary.CRITICAL ?? 0,
      high: summary.HIGH ?? 0,
      medium: summary.MEDIUM ?? 0,
      low: summary.LOW ?? 0,
      info: summary.INFO ?? 0,
    },
    started_at: scan.startedAt.toISOString(),
    completed_at: scan.completedAt?.toISOString() ?? null,
  });
}
