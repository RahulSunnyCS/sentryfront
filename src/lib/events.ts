/**
 * Event bus for scan progress.
 *
 * When REDIS_URL is set:   publish/subscribe via Redis pub/sub.
 * When REDIS_URL is unset: write events to the `ScanEvent` DB table;
 *                          the SSE endpoint polls every 500ms.
 */

const redisUrl = process.env.REDIS_URL?.trim() || null;

export async function publishEvent(
  scanId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (redisUrl) {
    await publishToRedis(scanId, eventType, payload);
  } else {
    await publishToDB(scanId, eventType, payload);
  }
}

async function publishToRedis(
  scanId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { createClient } = await import('redis');
  const client = createClient({ url: redisUrl! });
  await client.connect();
  await client.publish(`scan:${scanId}`, JSON.stringify({ type: eventType, ...payload }));
  await client.quit();
}

async function publishToDB(
  scanId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { prisma } = await import('./prisma');
  await prisma.scanEvent.create({
    data: { scanId, eventType, payload: JSON.stringify(payload) },
  });
}

// ── SSE generators ───────────────────────────────────────────────────────────

function sseMessage(eventType: string, data: Record<string, unknown>): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Async generator that yields SSE strings until the scan terminates. */
export async function* iterScanEvents(scanId: string): AsyncGenerator<string> {
  if (redisUrl) {
    yield* iterRedis(scanId);
  } else {
    yield* iterDbPoll(scanId);
  }
}

async function* iterRedis(scanId: string): AsyncGenerator<string> {
  const { createClient } = await import('redis');
  const subscriber = createClient({ url: redisUrl! });
  await subscriber.connect();

  const queue: string[] = [];
  let resolve: (() => void) | null = null;

  await subscriber.subscribe(`scan:${scanId}`, (message: string) => {
    queue.push(message);
    resolve?.();
    resolve = null;
  });

  try {
    while (true) {
      if (queue.length === 0) {
        await new Promise<void>((r) => { resolve = r; });
      }
      const raw = queue.shift()!;
      const msg = JSON.parse(raw) as Record<string, unknown>;
      const eventType = String(msg.type ?? 'message');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { type: _type, ...rest } = msg;
      yield sseMessage(eventType, rest);
      if (eventType === 'scan_complete' || eventType === 'scan_failed') break;
    }
  } finally {
    await subscriber.unsubscribe(`scan:${scanId}`);
    await subscriber.quit();
  }
}

async function* iterDbPoll(scanId: string): AsyncGenerator<string> {
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

    // If no new events yet, check if the scan already finished (edge case)
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
