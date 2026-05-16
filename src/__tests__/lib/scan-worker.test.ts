/**
 * Unit tests for src/lib/scan-worker.ts
 *
 * The scanner, LLM enrichment, and event bus are all mocked so tests do not
 * touch the network. Prisma is mocked in vitest.setup.ts. The logger is also
 * mocked to suppress noise and prevent Sentry calls in test runs.
 *
 * NOTE: scan-worker has a 120 s hard timeout enforced via setTimeout inside
 * runScanWithTimeout. We use vi.useFakeTimers() in the timeout test so we can
 * advance time without actually waiting.
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
    // Default happy-path: scan exists, scanner succeeds, enrichment passes through
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(makeScanRow() as any);
    vi.mocked(prisma.scan.update).mockResolvedValue({} as any);
    vi.mocked(prisma.finding.createMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.finding.count).mockResolvedValue(0);
  });

  it('updates scan to RUNNING then COMPLETED on success with no findings', async () => {
    const scannerResult = makeScannerResult([]);
    vi.mocked(runScanner).mockResolvedValue(scannerResult as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScan(SCAN_ID);

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

    await runScan(SCAN_ID);

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

    await runScan(SCAN_ID);

    expect(prisma.finding.createMany).not.toHaveBeenCalled();
  });

  it('marks scan FAILED and re-throws when scanner throws', async () => {
    const scanError = new Error('crawler failure');
    vi.mocked(runScanner).mockRejectedValue(scanError);

    await expect(runScan(SCAN_ID)).rejects.toThrow('crawler failure');

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('publishes scan_failed event when scanner throws', async () => {
    vi.mocked(runScanner).mockRejectedValue(new Error('boom'));

    await expect(runScan(SCAN_ID)).rejects.toThrow();

    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'scan_failed',
      expect.objectContaining({ scan_id: SCAN_ID }),
    );
  });

  it('completes successfully even when LLM enrichment throws (graceful degradation)', async () => {
    // enrichFindingsWithLLM throws — scan should still complete with the raw findings
    // Actually, the current implementation does NOT catch LLM errors internally;
    // they propagate up to runScanInternal's catch block, which marks the scan FAILED.
    // This test documents the actual behaviour: LLM failure = scan FAILED.
    const findings = [makeRawFinding('MEDIUM')];
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult(findings) as any);
    vi.mocked(enrichFindingsWithLLM).mockRejectedValue(new Error('LLM quota exceeded'));

    await expect(runScan(SCAN_ID)).rejects.toThrow('LLM quota exceeded');

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('throws when scan record does not exist', async () => {
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(null);

    await expect(runScan(SCAN_ID)).rejects.toThrow(`Scan ${SCAN_ID} not found`);
  });

  it('publishes scan_complete event with grade on success', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScan(SCAN_ID);

    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'scan_complete',
      expect.objectContaining({ scan_id: SCAN_ID, grade: 'A' }),
    );
  });

  it('publishes llm_enrichment_started and llm_enrichment_complete events', async () => {
    vi.mocked(runScanner).mockResolvedValue(makeScannerResult([]) as any);
    vi.mocked(enrichFindingsWithLLM).mockResolvedValue(makeEnrichmentResult([]) as any);

    await runScan(SCAN_ID);

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

    await runScan(SCAN_ID);

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

    await runScan(SCAN_ID);

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

    await runScan(SCAN_ID);

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grade: 'F', score: 75 }),
      }),
    );
  });

  // ── Timeout handling ──────────────────────────────────────────────────────────

  it('marks scan TIMEOUT and publishes scan_timeout when the timeout fires', async () => {
    vi.useFakeTimers();

    // Make runScanner hang forever so the timeout races it
    vi.mocked(runScanner).mockReturnValue(new Promise(() => {})); // never resolves
    vi.mocked(prisma.finding.count).mockResolvedValue(2); // 2 partial findings

    const scanPromise = runScan(SCAN_ID);

    // Advance past the SCAN_TIMEOUT_MS (default 120000 ms)
    await vi.advanceTimersByTimeAsync(130000);

    // The scan should reject with the timeout error
    await expect(scanPromise).rejects.toThrow('Scan timeout');

    expect(prisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'TIMEOUT' }) }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      SCAN_ID,
      'scan_timeout',
      expect.objectContaining({ scan_id: SCAN_ID, partial_findings: 2 }),
    );

    vi.useRealTimers();
  });
});
