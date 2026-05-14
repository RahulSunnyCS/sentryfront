/**
 * Event bus for scan progress.
 *
 * Events are written to the `ScanEvent` table. Clients consume them by
 * polling `/api/v1/scans/[id]/events?since=<cursor>`. The Redis pub/sub
 * path was removed because polling reads from the DB, and silently
 * routing events to Redis would make the polling endpoint return nothing.
 */

export async function publishEvent(
  scanId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { prisma } = await import('./prisma');
  await prisma.scanEvent.create({
    data: { scanId, eventType, payload: JSON.stringify(payload) },
  });
}

// ── SSE generator (legacy — active-test progress route still uses this) ─────

function sseMessage(eventType: string, data: Record<string, unknown>): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Async generator that yields SSE strings until the scan terminates. */
export async function* iterScanEvents(scanId: string): AsyncGenerator<string> {
  const { prisma } = await import('./prisma');
  let lastId = 0;

  while (true) {
    const events = await prisma.scanEvent.findMany({
      where: { scanId, id: { gt: lastId } },
      orderBy: { id: 'asc' },
    });

    for (const ev of events) {
      lastId = ev.id;
      const payload = JSON.parse(ev.payload) as Record<string, unknown>;
      yield sseMessage(ev.eventType, payload);
      if (ev.eventType === 'scan_complete' || ev.eventType === 'scan_failed') return;
    }

    // If no new events yet, check if the scan already finished (edge case).
    if (events.length === 0) {
      const scan = await prisma.scan.findUnique({ where: { id: scanId } });
      if (scan?.status === 'COMPLETED') {
        yield sseMessage('scan_complete', { scan_id: scanId, grade: scan.grade });
        return;
      }
      if (scan?.status === 'FAILED' || scan?.status === 'TIMEOUT') {
        yield sseMessage('scan_failed', { scan_id: scanId });
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }
}
