import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ScanRerunView } from './scan-rerun-view';

export const dynamic = 'force-dynamic';

export default async function AdminScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scan = await prisma.scan.findUnique({
    where: { id },
    select: {
      id: true,
      targetUrl: true,
      status: true,
      tier: true,
      userId: true,
      grade: true,
      score: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (!scan) notFound();

  return (
    <ScanRerunView
      scan={{
        ...scan,
        startedAt: scan.startedAt.toISOString(),
        completedAt: scan.completedAt ? scan.completedAt.toISOString() : null,
      }}
    />
  );
}
