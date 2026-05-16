/**
 * Tests for src/lib/events.ts
 *
 * Covers publishEvent() and iterScanEvents() generator:
 * - publishEvent: happy path, Prisma error propagation
 * - iterScanEvents: yields SSE messages, scan_complete / scan_failed termination,
 *   polls DB when no events exist (COMPLETED / FAILED / TIMEOUT fallback),
 *   keeps looping when scan is still in progress
 *
 * The Prisma mock is installed globally by vitest.setup.ts. We reset and configure
 * per-test with mockResolvedValue / mockResolvedValueOnce.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import prisma from the globally mocked module so we can configure return values
import { prisma } from '@/lib/prisma';

// publishEvent and iterScanEvents import prisma via dynamic import('./prisma'), which
// resolves to the same mock module because vi.mock is hoisted and affects all importers.

import { publishEvent, iterScanEvents } from '@/lib/events';

// Cast to typed mocks for easier configuration
const mockScanEventCreate = prisma.scanEvent.create as ReturnType<typeof vi.fn>;
const mockScanEventFindMany = prisma.scanEvent.findMany as ReturnType<typeof vi.fn>;
const mockScanFindUnique = prisma.scan.findUnique as ReturnType<typeof vi.fn>;

// We want timers to be real but need setTimeout to resolve immediately.
// The easiest approach is to spy on setTimeout inside iterScanEvents and resolve it.
// However, iterScanEvents uses `await new Promise((r) => setTimeout(r, 500))`.
// We use fake timers for the polling loop tests.

describe('publishEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.scanEvent.create with the correct data', async () => {
    mockScanEventCreate.mockResolvedValue({ id: 1 });

    await publishEvent('scan-abc', 'scan_started', { url: 'https://example.com' });

    expect(mockScanEventCreate).toHaveBeenCalledOnce();
    expect(mockScanEventCreate).toHaveBeenCalledWith({
      data: {
        scanId: 'scan-abc',
        eventType: 'scan_started',
        payload: JSON.stringify({ url: 'https://example.com' }),
      },
    });
  });

  it('stores payload as a JSON string (not an object)', async () => {
    mockScanEventCreate.mockResolvedValue({ id: 2 });

    const payload = { progress: 50, module: 'p1-01' };
    await publishEvent('scan-xyz', 'scan_progress', payload);

    const call = mockScanEventCreate.mock.calls[0][0];
    expect(typeof call.data.payload).toBe('string');
    expect(JSON.parse(call.data.payload)).toEqual(payload);
  });

  it('propagates Prisma errors to the caller', async () => {
    mockScanEventCreate.mockRejectedValue(new Error('DB constraint violation'));

    await expect(publishEvent('scan-bad', 'scan_started', {})).rejects.toThrow(
      'DB constraint violation',
    );
  });

  it('works with an empty payload object', async () => {
    mockScanEventCreate.mockResolvedValue({ id: 3 });

    await expect(publishEvent('scan-123', 'scan_complete', {})).resolves.toBeUndefined();
    expect(mockScanEventCreate).toHaveBeenCalledOnce();
  });
});

// ── iterScanEvents ─────────────────────────────────────────────────────────────

/**
 * Helper: consume up to `max` values from an async generator, with a total
 * timeout to avoid hanging the test suite if the generator loops.
 */
async function collectGenerator(
  gen: AsyncGenerator<string>,
  max = 20,
): Promise<string[]> {
  const results: string[] = [];
  for await (const value of gen) {
    results.push(value);
    if (results.length >= max) break;
  }
  return results;
}

describe('iterScanEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('yields SSE-formatted strings for each event', async () => {
    // First findMany call returns two events; second returns none.
    // After the empty findMany, findUnique returns COMPLETED to terminate.
    mockScanEventFindMany
      .mockResolvedValueOnce([
        { id: 1, eventType: 'scan_progress', payload: JSON.stringify({ progress: 25 }) },
        { id: 2, eventType: 'scan_progress', payload: JSON.stringify({ progress: 50 }) },
      ])
      .mockResolvedValueOnce([]);

    mockScanFindUnique.mockResolvedValue({ id: 'scan-1', status: 'COMPLETED', grade: 'A' });

    // Advance fake timers so the 500ms sleep in the polling loop resolves.
    const promise = collectGenerator(iterScanEvents('scan-1'));
    // Tick multiple times to let all awaits resolve
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results[0]).toBe('event: scan_progress\ndata: {"progress":25}\n\n');
    expect(results[1]).toBe('event: scan_progress\ndata: {"progress":50}\n\n');
    // Generator terminates after yielding synthetic scan_complete
    const lastEvent = results[results.length - 1];
    expect(lastEvent).toContain('event: scan_complete');
  });

  it('terminates immediately when scan_complete event is received', async () => {
    mockScanEventFindMany.mockResolvedValueOnce([
      { id: 10, eventType: 'scan_complete', payload: JSON.stringify({ scan_id: 'scan-2' }) },
    ]);

    const promise = collectGenerator(iterScanEvents('scan-2'));
    await vi.runAllTimersAsync();
    const results = await promise;

    // Only the scan_complete event; generator returns after this
    expect(results).toHaveLength(1);
    expect(results[0]).toContain('event: scan_complete');
  });

  it('terminates immediately when scan_failed event is received', async () => {
    mockScanEventFindMany.mockResolvedValueOnce([
      { id: 20, eventType: 'scan_failed', payload: JSON.stringify({ scan_id: 'scan-3' }) },
    ]);

    const promise = collectGenerator(iterScanEvents('scan-3'));
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0]).toContain('event: scan_failed');
  });

  it('yields synthetic scan_complete when scan status is COMPLETED and no events remain', async () => {
    mockScanEventFindMany.mockResolvedValue([]); // always empty
    mockScanFindUnique.mockResolvedValue({ id: 'scan-4', status: 'COMPLETED', grade: 'B' });

    const promise = collectGenerator(iterScanEvents('scan-4'));
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0]).toContain('event: scan_complete');
    expect(results[0]).toContain('"grade":"B"');
  });

  it('yields synthetic scan_failed when scan status is FAILED', async () => {
    mockScanEventFindMany.mockResolvedValue([]);
    mockScanFindUnique.mockResolvedValue({ id: 'scan-5', status: 'FAILED', grade: null });

    const promise = collectGenerator(iterScanEvents('scan-5'));
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0]).toContain('event: scan_failed');
  });

  it('yields synthetic scan_failed when scan status is TIMEOUT', async () => {
    mockScanEventFindMany.mockResolvedValue([]);
    mockScanFindUnique.mockResolvedValue({ id: 'scan-6', status: 'TIMEOUT', grade: null });

    const promise = collectGenerator(iterScanEvents('scan-6'));
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0]).toContain('event: scan_failed');
  });

  it('keeps lastId advancing so duplicate events are not re-emitted', async () => {
    // First batch has two events; second batch has one more event; third terminates.
    mockScanEventFindMany
      .mockResolvedValueOnce([
        { id: 1, eventType: 'scan_progress', payload: '{"p":1}' },
        { id: 2, eventType: 'scan_progress', payload: '{"p":2}' },
      ])
      .mockResolvedValueOnce([
        { id: 3, eventType: 'scan_complete', payload: '{}' },
      ]);

    const promise = collectGenerator(iterScanEvents('scan-7'));
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(3);
    // Second findMany call should query with id > 2 (lastId after first batch)
    const secondCall = mockScanEventFindMany.mock.calls[1][0];
    expect(secondCall.where.id.gt).toBe(2);
  });

  it('continues polling when scan is still RUNNING (no terminal status)', async () => {
    // First two queries return empty + RUNNING status; third query returns completion event.
    mockScanEventFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 5, eventType: 'scan_complete', payload: '{"done":true}' },
      ]);
    // RUNNING scan — does not terminate the generator from findUnique
    mockScanFindUnique.mockResolvedValue({ id: 'scan-8', status: 'RUNNING', grade: null });

    const promise = collectGenerator(iterScanEvents('scan-8'));
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0]).toContain('event: scan_complete');
    // findMany called at least 3 times (2 empty + 1 with event)
    expect(mockScanEventFindMany.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
