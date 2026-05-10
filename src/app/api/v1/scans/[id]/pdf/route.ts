/**
 * PDF Export API
 *
 * GET /api/v1/scans/:id/pdf
 *
 * Generates PDF on-the-fly and streams it directly to browser.
 * No cloud storage needed - zero costs, zero setup!
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePdfBuffer, isDirectPdfAvailable } from '@/lib/pdf/export';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check if Playwright is available
  if (!isDirectPdfAvailable()) {
    return NextResponse.json(
      {
        error: 'PDF export is not available. Install Playwright: npm install playwright',
      },
      { status: 503 }
    );
  }

  const { id } = params;

  // Fetch scan to verify it exists and is completed
  const scan = await prisma.scan.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      targetUrl: true,
      grade: true,
      completedAt: true,
      userId: true,
      user: {
        select: {
          tier: true,
        },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  if (scan.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Scan is not yet completed. Please wait for the scan to finish.' },
      { status: 409 }
    );
  }

  // Tier gating disabled - PDF export available to all users!
  const tier = scan.user?.tier || 'free';

  // Parse white-label options from query params (for Studio tier)
  const whiteLabel =
    tier === 'studio'
      ? {
          logoUrl: req.nextUrl.searchParams.get('logoUrl') || undefined,
          primaryColor: req.nextUrl.searchParams.get('primaryColor') || undefined,
          companyName: req.nextUrl.searchParams.get('companyName') || undefined,
        }
      : undefined;

  // Build report URL
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  const reportUrl = `${protocol}://${host}/report/${id}`;

  // Generate PDF in memory
  const result = await generatePdfBuffer({
    reportUrl,
    whiteLabel,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'PDF generation failed' },
      { status: 500 }
    );
  }

  // Stream PDF directly to browser
  const hostname = new URL(scan.targetUrl).hostname;
  const timestamp = scan.completedAt
    ? new Date(scan.completedAt).toISOString().split('T')[0]
    : 'unknown';
  const filename = `vibesafe-${hostname}-${timestamp}.pdf`;

  return new NextResponse(result.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
