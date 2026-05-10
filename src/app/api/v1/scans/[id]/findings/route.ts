import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
    include: { findings: true },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  if (!['COMPLETED', 'FAILED'].includes(scan.status)) {
    return NextResponse.json({ error: 'Scan is not yet complete.' }, { status: 409 });
  }

  const findings = scan.findings.map((f) => ({
    id: f.id,
    moduleId: f.moduleId,
    severity: f.severity,
    category: f.category,
    title: f.title,
    location: f.location,
    evidence: f.evidence,
    explanation: f.explanation,
    impact: f.impact,
    fixManual: JSON.parse(f.fixManual) as string[],
    fixAiPrompt: f.fixAiPrompt,
  }));

  return NextResponse.json(findings);
}
