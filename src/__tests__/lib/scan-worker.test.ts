/**
 * Unit tests for src/lib/scan-worker.ts
 *
 * The scanner, LLM enrichment, and event bus are all mocked so tests do not
 * touch the network. Prisma is mocked in vitest.setup.ts. The logger is also
 * mocked to suppress noise and prevent Sentry calls in test runs.
 *
 * IMPORTANT: scan-worker uses setTimeout internally in two places:
 *   1. emitPlaceholderProgress — sleeps between per-module progress events
 *      (~60 s total). Without fake timers this would make every test slow.
 *   2. runScanWithTimeout — hard-kills after SCAN_TIMEOUT_MS (120 s).
 *
 * We use vi.useFakeTimers() for the entire suite, advance time per-test, and
 * restore real timers after each test to avoid leaking fake timer state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/scanner', () => ({
  runScanner: vi.fn(),
}));

vi.mock('@/lib/llm/enrichment', () => ({
  enrichFindingsWithLLM: vi.fn(),
}));

// Mock the events module so publishEvent calls don't touch the DB
vi.mock('@/lib/events', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { runScan } from '@/lib/scan-worker';
import { prisma } from '@/lib/prisma';
import { runScanner } from '@/lib/scanner';
import { enrichFindingsWithLLM } from '@/lib/llm/enrichment';
import { publishEvent } from '@/lib/events';
import type { RawFinding } from '@/lib/scanner/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SCAN_ID = 'test-scan-id';
const TARGET_URL = 'https://example.com';

// Override the scan timeout to a small value so tests drain all timers quickly.
// scan-worker.ts reads SCAN_TIMEOUT_MS at module import time (top-level const),
// so we cannot change it per-test — but we CAN advance timers past the real
// 120 s value. In error-path tests we advance past both the placeholder delays
// AND the 120 s timeout so no pending setTimeouts survive the test boundary.
const PLACEHOLDER_TOTAL_MS = 70000; // > sum of all placeholder delays (~61 s)
const SCAN_TIMEOUT_MS = 120000;     // default value from scan-worker.ts

// After each error-path test we drain all remaining fake timers so that the
// pending timeout promise inside runScanWithTimeout does not fire after the
// test ends and surface as an unhandled rejection.
const ALL_TIMERS_MS = SCAN_TIMEOUT_MS + PLACEHOLDER_TOTAL_MS + 5000;

function makeScanRow(overrides: Partial<{ id: string; targetUrl: string; status: string }> = {}) {
  return {
    id: SCAN_ID,
    targetUrl: TARGET_URL,
    status: 'PENDING',
    ...overrides,
  };
}

function makeRawFinding(severity: RawFinding['severity'] = 'LOW'): RawFinding {
  return {
    moduleId: 'P1-01',
    severity,
    category: 'Security',
    title: `${severity} finding`,
    location: 'https://example.com',
    evidence: 'test evidence',
    explanation: 'test explanation',
    impact: 'minimal',
    fixManual: ['Fix step 1'],
    fixAiPrompt: 'fix this',
  };
}

function makeScannerResult(findings: RawFinding[] = []) {
  return {
    findings,
    stack: 'Next.js',
    moduleFindingCounts: {},
    performanceGrade: 'A',
    performanceScore: 95,
    performanceMetrics: {},
    accessibilityGrade: 'A',
    accessibilityScore: 90,
    accessibilityMetrics: {},
    seoGrade: 'B',
    seoScore: 80,
    seoMetrics: {},
  };
}

function makeEnrichmentResult(findings: RawFinding[]) {
  return {
    findings,
    status: {
      used: false,
      reason: 'no api key',
      model: null,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runScan()', () => {
  beforeEach(() => {
    // Fake timers for every test: prevents emitPlaceholderProgress from blocking
    vi.useFakeTimers();

    // Default happy-path: scan exists, scanner succeeds, enrichment passes through
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(makeScanRow() as any);
    vi.mocked(prisma.scan.update).mockResolvedValue({} as any);
    vi.mocked(prisma.finding.createMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.finding.count).mockResolvedValue(0);
    // publishEvent mock is already configured to resolve immediately via the
    // vi.mock factory above, but reset it here just in case clearAllMocks ran.
    vi.mocked(publishEvent).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: run the scan and advance fake timers past both the placeholder
  // delays AND the scan timeout so that no pending setTimeouts survive the
  // test boundary. The catch-before-advance pattern ensures the rejection is
  // handled before advanceTimersByTimeAsync flushes remaining timers.
  async function runScanAndDrain(): Promise<void> {
    const promise = runScan(SCAN_ID);
    // Advance far enough to drain placeholder sleeps (60 s) plus the timeout
    // promise (120 s) so no setTimeouts remain when the test ends.
    await vi.advanceTimersByTimeAsync(ALL_TIMERS_MS);
    return promise;
  }

  // Error-path variant: catch BEFORE advancing so the rejection is handled
  // before timer flush, preventing unhandled-rejection warnings.
  async function runScanExpectError(expectedMsg?: string): Promise<Error> {
    const promise = runScan(SCAN_ID).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(ALL_TIMERS_MS);
    const result = await promise;
    if (expectedMsg) expect((result as Error).message).toContain(expectedMsg);
    return result as Error;
  }

  it('updates scan to RUNNING then COMPLETED on success with no findings', async () => {
    const scannerResult = makeScannerResult([]);
    vi.mocked(runScanner).mockResolvedValue(scannerResult as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    // First update: status = RUNNING
    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RUNNING' }) }),
    );

    // Final update: status = COMPLETED
    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });

  it('persists findings via createMany when findings are present', async () => {
    const findings = [makeRawFinding('HIGH'), makeRawFinding('LOW')];
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult(findings) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult(findings) as any);

    await runScanAndDrain();

    expect(prisma.finding.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ scanId: SCAN_ID, severity: 'HIGH' }),
          expect.objectContaining({ scanId: SCAN_ID, severity: 'LOW' }),
        ]),
      }),
    );
  });

  it('skips createMany when there are zero findings', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    expect(prisma.finding.createMany).not.toHaveBeenCalled();
  });

  it('marks scan FAILED and re-throws when scanner throws', async () => {
    vi.mocked(runScanner).mockRejectedValue(new Error('crawler failure'));

    await runScanExpectError('crawler failure');

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('publishes scan_failed event when scanner throws', async () => {
    vi.mocked(runScanner).mockRejectedValue(new Error('boom'));

    await runScanExpectError('boom');

    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'scan_failed',
      expect.objectContaining({ scan_id: SCAN_ID }),
    );
  });

  it('marks scan FAILED when LLM enrichment throws (LLM errors propagate up)', async () => {
    // enrichFindingsWithLLM throws — the current implementation does NOT catch
    // LLM errors internally; they propagate up to the catch block marking the scan FAILED.
    const findings = [makeRawFinding('MEDIUM')];
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult(findings) as any);
    vi.mocked(enrichFindingsWithLLM).mockRejectedValue(new Error('LLM quota exceeded'));

    await runScanExpectError('LLM quota exceeded');

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('throws when scan record does not exist', async () => {
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(null);

    await runScanExpectError(`Scan ${SCAN_ID} not found`);
  });

  it('publishes scan_complete event with grade on success', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'scan_complete',
      expect.objectContaining({ scan_id: SCAN_ID, grade: 'A' }),
    );
  });

  it('publishes llm_enrichment_started and llm_enrichment_complete events', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'llm_enrichment_started',
      expect.objectContaining({ scan_id: SCAN_ID }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'llm_enrichment_complete',
      expect.objectContaining({ scan_id: SCAN_ID }),
    );
  });

  // ── Grade computation (indirectly tested via the COMPLETED update call) ──────

  it('computes grade A when there are no findings', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    // grade=A, score=0 should be present in the final scan update
    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grade: 'A', score: 0 }),
      }),
    );
  });

  it('computes grade B when only LOW findings are present (score ≤ 5)', async () => {
    // LOW severity score is 1 per finding; 5 LOW findings → score = 5 → grade B
    const findings = Array.from({ length: 5 }, () => makeRawFinding('LOW'));
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult(findings) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult(findings) as any);

    await runScanAndDrain();

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grade: 'B', score: 5 }),
      }),
    );
  });

  it('computes grade F when a CRITICAL finding is present (score > 50)', async () => {
    // CRITICAL severity score is 25; 3 CRITICAL findings → score = 75 → grade F
    const findings = Array.from({ length: 3 }, () => makeRawFinding('CRITICAL'));
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult(findings) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult(findings) as any);

    await runScanAndDrain();

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grade: 'F', score: 75 }),
      }),
    );
  });

  // ── Timeout handling ──────────────────────────────────────────────────────────

  it('marks scan TIMEOUT and publishes scan_timeout when the timeout fires', async () => {
    // Make runScanner hang forever so the timeout races it
    vi.mocked(runScanner).mockReturnValue(new Promise(() => {})); // never resolves
    vi.mocked(prisma.finding.count).mockResolvedValue(2); // 2 partial findings persisted

    // Attach .catch() BEFORE advancing so the rejection is handled before the
    // timer flush and never surfaces as an unhandled rejection.
    const scanPromise = runScan(SCAN_ID).catch((e: Error) => e);

    // Advance past SCAN_TIMEOUT_MS so the timeout promise fires and wins the race.
    // No placeholder delays fire because runScanner never resolves (never reaches
    // the Promise.all step), so we only need to exceed the 120 s timeout.
    await vi.advanceTimersByTimeAsync(SCAN_TIMEOUT_MS + 5000);

    const err = await scanPromise;
    expect((err as Error).message).toContain('Scan timeout');

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'TIMEOUT' }) }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'scan_timeout',
      expect.objectContaining({ scan_id: SCAN_ID, partial_findings: 2 }),
    );
  });
});
