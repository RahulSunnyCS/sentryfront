import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scan = await prisma.scan.findUnique({ where: { id: params.id } });

  if (!scan) {
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
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
  });
}
