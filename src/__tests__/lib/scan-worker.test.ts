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
// normalizePerformanceMetrics lives in its canonical home; scan-worker.ts no
// longer re-exports it. Import directly so the test covers the real module.
import { normalizePerformanceMetrics } from '@/lib/scanner/performance-metrics';
import { prisma } from '@/lib/prisma';
import { runScanner } from '@/lib/scanner';
import { enrichFindingsWithLLM } from '@/lib/llm/enrichment';
import { publishEvent } from '@/lib/events';
import type { RawFinding } from '@/lib/scanner/types';
// Fixtures for back-compat normaliser tests
import preChangeBlobRaw from '../fixtures/performance-metrics/pre-change-blob.json';
import newCodePartialBlobRaw from '../fixtures/performance-metrics/new-code-partial-blob.json';

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
  // T-08: fixture now includes all new fields (scoreSource, fieldData/Verdict,
  // bestPractices, and the optional desktop sub-object). The performanceMetrics
  // narrow shape is still present for the blob builder — the blob builder reads
  // it for lcp/fcp/cls/tbt/ttfb/opportunities. All new data lives at the top
  // level of ScannerResult (scored/sourced fields) and in the blob that
  // buildPerformanceMetricsBlob assembles from those top-level fields.
  return {
    findings,
    stack: 'Next.js',
    moduleFindingCounts: {},
    // Performance headline (mobile)
    performanceGrade: 'A',
    performanceScore: 95,
    scoreSource: 'lab' as const,
    // CrUX field data — named-field shape, as produced by lighthouse.ts parseCrUXBlock
    fieldDataVerdict: 'FAST' as const,
    fieldData: {
      overallCategory: 'FAST' as const,
      lcp: { percentile: 1800, category: 'FAST' as const, distributions: [] },
      inp: null,
      cls: null,
      fcp: { percentile: 900, category: 'FAST' as const, distributions: [] },
      ttfb: null,
    },
    // Best practices
    bestPracticesScore: 87,
    bestPracticesGrade: 'B',
    // Desktop sub-object (only present when desktopPerformance feature ran)
    desktopPerformance: {
      score: 88,
      grade: 'B',
      scoreSource: 'lab' as const,
      metrics: { lcp: 1200, fcp: 600, cls: 0.01, tbt: 80, ttfb: 400, opportunities: [] },
    },
    // Narrow metrics shape (for the legacy lcp/fcp/cls/tbt/ttfb fields in the blob)
    performanceMetrics: {
      lcp: 2400, fcp: 1200, cls: 0.05, tbt: 300, ttfb: 800, opportunities: [],
    },
    // Accessibility
    accessibilityGrade: 'A',
    accessibilityScore: 90,
    accessibilityMetrics: {},
    // SEO
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

  // ── T-08: performanceMetrics blob persistence ─────────────────────────────

  it('T-08: persists performanceMetrics JSON containing scoreSource and desktop on success', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    // Find the COMPLETED update call and inspect the performanceMetrics JSON
    const completedCall = vi.mocked(prisma.scan.update).mock.calls.find(
      ([args]) => (args as any).data?.status === 'COMPLETED',
    );
    expect(completedCall).toBeDefined();
    const data = (completedCall![0] as any).data;

    expect(typeof data.performanceMetrics).toBe('string');
    const blob = JSON.parse(data.performanceMetrics);

    // Core fields
    expect(blob.lcp).toBe(2400);
    expect(blob.fcp).toBe(1200);
    // T-08 new fields
    expect(blob.scoreSource).toBe('lab');
    expect(blob.fieldDataVerdict).toBe('FAST');
    expect(blob.fieldData).toMatchObject({ overallCategory: 'FAST' });
    expect(blob.bestPracticesScore).toBe(87);
    expect(blob.bestPracticesGrade).toBe('B');
    // Desktop sub-object
    expect(blob.desktop).toMatchObject({
      score: 88,
      grade: 'B',
      scoreSource: 'lab',
      metrics: expect.objectContaining({ lcp: 1200 }),
    });
  });

  it('T-08: UNAVAILABLE path persists non-empty blob with scoreSource:unavailable and null score', async () => {
    // Simulate a scan where PSI failed (UNAVAILABLE): scoreSource = 'unavailable',
    // performanceScore = null, performanceGrade = 'N/A'. The metrics blob must still
    // be written (non-null) so the UI can distinguish "feature ran, PSI failed"
    // from "feature was disabled".
    const unavailableResult = {
      ...makeScannerResult([]),
      performanceGrade: 'N/A',
      performanceScore: null,
      scoreSource: 'unavailable' as const,
      fieldDataVerdict: null,
      fieldData: null,
      bestPracticesScore: null,
      bestPracticesGrade: 'N/A',
      desktopPerformance: undefined,
      performanceMetrics: {
        lcp: null, fcp: null, cls: null, tbt: null, ttfb: null, opportunities: [],
      },
    };

    vi.mocked(runScanner).mockResolvedValue(unavailableResult as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    const completedCall = vi.mocked(prisma.scan.update).mock.calls.find(
      ([args]) => (args as any).data?.status === 'COMPLETED',
    );
    expect(completedCall).toBeDefined();
    const data = (completedCall![0] as any).data;

    // The blob must be written (non-null) even when PSI failed
    expect(data.performanceMetrics).toBeDefined();
    expect(typeof data.performanceMetrics).toBe('string');
    const blob = JSON.parse(data.performanceMetrics);

    // CRITICAL: scoreSource must be 'unavailable', not absent
    expect(blob.scoreSource).toBe('unavailable');
    // Score in the DB column must be null (written via key-in-object guard)
    expect(data.performanceScore).toBeNull();
    // Grade is 'N/A' (truthy string — written by the performanceGrade guard)
    expect(data.performanceGrade).toBe('N/A');
  });

  it('T-08: round-trip — scoreSource and desktop survive scanner→blob→JSON→normaliser', async () => {
    // This test asserts the full round-trip:
    //   makeScannerResult (scanner result shape)
    //   → buildPerformanceMetricsBlob (called inside scan-worker)
    //   → JSON.stringify (persisted to DB as a string)
    //   → JSON.parse (simulates what the route handler does)
    //   → normalizePerformanceMetrics (the normaliser)
    //
    // We capture the raw JSON from the Prisma update, then run it through the
    // normaliser the same way the API route does, and assert the key fields.
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScanAndDrain();

    const completedCall = vi.mocked(prisma.scan.update).mock.calls.find(
      ([args]) => (args as any).data?.status === 'COMPLETED',
    );
    const rawJson = (completedCall![0] as any).data.performanceMetrics as string;

    // Simulate what the route handler does
    const raw = JSON.parse(rawJson) as Record<string, unknown>;
    const normalised = normalizePerformanceMetrics(raw);

    // scoreSource must survive
    expect(normalised.scoreSource).toBe('lab');
    // desktop must survive
    expect(normalised.desktop).toMatchObject({
      score: 88,
      grade: 'B',
      scoreSource: 'lab',
    });
    // fieldData must survive
    expect(normalised.fieldData).toMatchObject({ overallCategory: 'FAST' });
    // bestPractices must survive
    expect(normalised.bestPracticesScore).toBe(87);
    expect(normalised.bestPracticesGrade).toBe('B');
  });

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

// ── T-08: normalizePerformanceMetrics back-compat tests ───────────────────────
//
// These tests use committed JSON fixtures (pre-change-blob.json and
// new-code-partial-blob.json) to verify both back-compat rules:
//
//   Rule A — PRE-CHANGE blob (no scoreSource, no fieldData):
//     A pre-T-06 blob was only ever written when PSI succeeded.
//     → scoreSource MUST default to 'lab' (safe assumption).
//
//   Rule B — NEW-CODE PARTIAL blob (fieldData present, scoreSource absent):
//     Ambiguous state that should not occur in practice but must not silently
//     default to 'lab' (which could mislabel an UNAVAILABLE scan).
//     → scoreSource MUST default to 'unavailable' (safe / visible in UI as N/A).

describe('normalizePerformanceMetrics()', () => {
  it('Rule A — pre-change blob (no scoreSource, no fieldData) → scoreSource:lab', () => {
    // preChangeBlobRaw has lcp/fcp/cls/tbt/ttfb/opportunities but no scoreSource
    // and no fieldData. This is a blob from old code that only wrote metrics on
    // PSI success. Safe to label 'lab'.
    const result = normalizePerformanceMetrics(preChangeBlobRaw as Record<string, unknown>);

    expect(result.scoreSource).toBe('lab');
    expect(result.lcp).toBe(2400);
    expect(result.fcp).toBe(1200);
    expect(result.cls).toBe(0.05);
    expect(result.tbt).toBe(300);
    expect(result.ttfb).toBe(800);
    expect(result.opportunities).toEqual([]);
    // fieldData/fieldDataVerdict should be absent/undefined for a pre-change blob
    // (the normaliser only populates them when scoreSource or fieldData was present)
    expect(result.fieldData).toBeUndefined();
    expect(result.fieldDataVerdict).toBeUndefined();
  });

  it('Rule B — new-code partial blob (fieldData present, scoreSource absent) → scoreSource:unavailable', () => {
    // newCodePartialBlobRaw has fieldData and fieldDataVerdict but NO scoreSource.
    // This is ambiguous — we cannot tell if it came from a lab run or a failed one.
    // The safe default is 'unavailable' (UI shows N/A) rather than 'lab'
    // (which would display a potentially wrong grade).
    const result = normalizePerformanceMetrics(newCodePartialBlobRaw as Record<string, unknown>);

    expect(result.scoreSource).toBe('unavailable');
    // fieldData should be carried through (it IS in the blob)
    expect(result.fieldData).toMatchObject({ overallCategory: 'FAST' });
    expect(result.fieldDataVerdict).toBe('FAST');
    // Core metrics are still available
    expect(result.lcp).toBe(1800);
    expect(result.fcp).toBe(900);
  });

  it('honours stored scoreSource:lab verbatim', () => {
    const blob = {
      lcp: 1500, fcp: 700, cls: 0.01, tbt: 100, ttfb: 300,
      opportunities: [],
      scoreSource: 'lab',
      fieldDataVerdict: 'AVERAGE',
      fieldData: { overallCategory: 'AVERAGE' },
      bestPracticesScore: 92,
      bestPracticesGrade: 'A',
    };
    const result = normalizePerformanceMetrics(blob as Record<string, unknown>);
    expect(result.scoreSource).toBe('lab');
    expect(result.bestPracticesScore).toBe(92);
    expect(result.bestPracticesGrade).toBe('A');
  });

  it('honours stored scoreSource:unavailable verbatim', () => {
    const blob = {
      lcp: null, fcp: null, cls: null, tbt: null, ttfb: null,
      opportunities: [],
      scoreSource: 'unavailable',
      fieldDataVerdict: null,
      fieldData: null,
      bestPracticesScore: null,
      bestPracticesGrade: 'N/A',
    };
    const result = normalizePerformanceMetrics(blob as Record<string, unknown>);
    expect(result.scoreSource).toBe('unavailable');
    expect(result.lcp).toBeNull();
    expect(result.bestPracticesScore).toBeUndefined(); // null → undefined via nullish coalesce
  });

  it('treats a corrupted scoreSource value as unavailable (fail-safe)', () => {
    // If somehow an invalid string was stored, we fall back to 'unavailable'
    // rather than silently labelling as 'lab'.
    const blob = {
      lcp: 1000, fcp: 500, cls: 0.0, tbt: 50, ttfb: 200,
      opportunities: [],
      scoreSource: 'corrupted-value',
    };
    const result = normalizePerformanceMetrics(blob as Record<string, unknown>);
    expect(result.scoreSource).toBe('unavailable');
  });
});
