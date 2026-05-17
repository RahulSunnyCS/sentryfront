/**
 * Tests for GET /api/v1/scans/:id/performance-suggestions
 *
 * Focus: the T-07 null/zero-safety contract.
 *
 *   Before the fix, the guard was:
 *     !scan.performanceGrade || !scan.performanceScore || !scan.performanceMetrics
 *   That guard treats performanceScore === 0 as falsy and 404s a genuine
 *   worst-performing site.
 *
 *   After the fix:
 *     scan.performanceGrade == null || scan.performanceScore == null || scan.performanceMetrics == null
 *   A score of 0 passes through; only a null score (provider unavailable) 404s.
 *
 * Tests:
 *   1. score 0 → 200 (suggestions returned, no bogus 404)
 *   2. score null → 404 ("provider unavailable" path)
 *   3. normal score (73) → 200 (unchanged happy path)
 *   4. scan not found → 404
 *   5. scan not COMPLETED → 409
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// The generateImprovementPlan lib function needs a stable mock so the route
// can complete without importing the real scanner implementation.
vi.mock('@/lib/scanner/performance-suggestions', () => ({
  generateImprovementPlan: vi.fn().mockReturnValue({
    summary: 'Test summary',
    quickWins: [],
    majorImprovements: [],
    optimizations: [],
    aiPromptBundle: 'bundle',
  }),
}));

// Import the route handler AFTER mocks are registered.
const { GET } = await import('@/app/api/v1/scans/[id]/performance-suggestions/route');

/** Shared scan fixture fields that are always present */
const BASE_SCAN = {
  id: 'scan-1',
  targetUrl: 'https://example.com',
  status: 'COMPLETED',
  findings: [],
};

/** Minimal valid performanceMetrics JSON string */
const METRICS_JSON = JSON.stringify({
  lcp: 2500,
  fcp: 1800,
  cls: 0.1,
  tbt: 300,
  ttfb: 400,
});

function makeReq(scanId = 'scan-1') {
  return new NextRequest(`http://localhost/api/v1/scans/${scanId}/performance-suggestions`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Core null/zero-safety tests (T-07 contract)
// ---------------------------------------------------------------------------
describe('GET /api/v1/scans/:id/performance-suggestions — null/zero safety', () => {
  it('returns 200 (suggestions) for a real score of 0 — not a bogus 404', async () => {
    // A genuine worst-performing site: score 0, grade 'F'.
    // Before the fix this 404'd because !0 is true.
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...BASE_SCAN,
      performanceScore: 0,
      performanceGrade: 'F',
      performanceMetrics: METRICS_JSON,
    });

    const res = await GET(makeReq(), { params: { id: 'scan-1' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.performanceScore).toBe(0);
    expect(body.performanceGrade).toBe('F');
    // The route must not 404 here — confirm the response is the plan shape.
    expect(body).toHaveProperty('quickWins');
  });

  it('returns 404 for a null score (PSI/Lighthouse provider unavailable)', async () => {
    // Null score = scoreSource 'unavailable'. This is the only case that should 404.
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...BASE_SCAN,
      performanceScore: null,
      performanceGrade: null,
      performanceMetrics: null,
    });

    const res = await GET(makeReq(), { params: { id: 'scan-1' } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/No performance data/i);
  });

  it('returns 200 for a normal score (73) — happy path unchanged', async () => {
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...BASE_SCAN,
      performanceScore: 73,
      performanceGrade: 'C',
      performanceMetrics: METRICS_JSON,
    });

    const res = await GET(makeReq(), { params: { id: 'scan-1' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.performanceScore).toBe(73);
    expect(body.performanceGrade).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// Existing guard paths — must still work after the fix
// ---------------------------------------------------------------------------
describe('GET /api/v1/scans/:id/performance-suggestions — guard paths', () => {
  it('returns 404 when the scan does not exist', async () => {
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await GET(makeReq(), { params: { id: 'no-such-scan' } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Scan not found/i);
  });

  it('returns 409 when the scan is not yet complete', async () => {
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...BASE_SCAN,
      status: 'RUNNING',
      performanceScore: 73,
      performanceGrade: 'C',
      performanceMetrics: METRICS_JSON,
    });

    const res = await GET(makeReq(), { params: { id: 'scan-1' } });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not yet complete/i);
  });

  it('returns 404 when grade is null but score is present (partial unavailable)', async () => {
    // All three fields must be non-null for suggestions to be valid.
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...BASE_SCAN,
      performanceScore: 50,
      performanceGrade: null,
      performanceMetrics: METRICS_JSON,
    });

    const res = await GET(makeReq(), { params: { id: 'scan-1' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 when metrics is null but score and grade are present', async () => {
    (prisma.scan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...BASE_SCAN,
      performanceScore: 50,
      performanceGrade: 'C',
      performanceMetrics: null,
    });

    const res = await GET(makeReq(), { params: { id: 'scan-1' } });
    expect(res.status).toBe(404);
  });
});
