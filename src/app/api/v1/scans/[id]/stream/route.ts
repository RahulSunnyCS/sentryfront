import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { iterScanEvents } from '@/lib/events';

// Force dynamic rendering — SSE connections must not be cached.
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scan = await prisma.scan.findUnique({ where: { id: params.id } });

  if (!scan) {
    return new Response(JSON.stringify({ error: 'Scan not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If already finished, emit a single terminal event and close immediately.
  if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(scan.status)) {
    const eventType = scan.status === 'COMPLETED' ? 'scan_complete' : 'scan_failed';
    const data = JSON.stringify({ scan_id: scan.id, grade: scan.grade });
    const body = `event: ${eventType}\ndata: ${data}\n\n`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Stream live events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of iterScanEvents(scan.id)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error('[SSE] stream error:', err);
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
