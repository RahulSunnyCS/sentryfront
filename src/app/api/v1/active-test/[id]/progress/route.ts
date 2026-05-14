import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { iterScanEvents } from '@/lib/events';
import { getCurrentUser } from '@/lib/auth/helpers';
import { parseActiveTestSummary } from '@/lib/active-test-worker';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  logger.setScanScope(params.id);
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scan = await prisma.scan.findUnique({ where: { id: params.id } });
  if (!scan || scan.userId !== user.id) {
    return new Response(JSON.stringify({ error: 'Scan not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!parseActiveTestSummary(scan.summary)) {
    return new Response(JSON.stringify({ error: 'Not an active test.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(scan.status)) {
    const eventType = scan.status === 'COMPLETED' ? 'scan_complete' : 'scan_failed';
    const body = `event: ${eventType}\ndata: ${JSON.stringify({ scan_id: scan.id })}\n\n`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of iterScanEvents(scan.id)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error('[active-test SSE] stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
