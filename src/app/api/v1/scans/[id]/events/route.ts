import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const scan = await prisma.scan.findUnique({ where: { id: params.id } });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!canViewScan(scan, user)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = Number.isFinite(Number(sinceParam)) ? Math.max(0, Number(sinceParam)) : 0;

  const rows = await prisma.scanEvent.findMany({
    where: { scanId: scan.id, id: { gt: since } },
    orderBy: { id: 'asc' },
  });

  const events = rows.map((ev) => ({
    id: ev.id,
    type: ev.eventType,
    payload: JSON.parse(ev.payload) as Record<string, unknown>,
  }));

  const cursor = events.length > 0 ? events[events.length - 1].id : since;

  return NextResponse.json({
    scan: { id: scan.id, status: scan.status, grade: scan.grade },
    events,
    cursor,
  });
}
