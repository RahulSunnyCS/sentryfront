/**
 * Tests for GET /api/v1/scans/[id]
 *
 * Verifies that the route:
 *  - Returns 404 for unknown scans
 *  - Returns 404 when canViewScan denies access
 *  - Parses and normalises performanceMetrics JSON (including back-compat blobs)
 *  - Is null-safe when performanceMetrics is absent
 *  - Exposes the new T-08 fields (scoreSource, fieldData, bestPractices, desktop)
 *  - Handles corrupted performanceMetrics JSON without throwing a 500
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scan: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/report-access', () => ({
  canViewScan: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setScanScope: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { canViewScan } from '@/lib/report-access';
import { GET } from '@/app/api/v1/scans/[id]/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/v1/scans/${id}`);
}

function makeScanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scan-abc123',
    targetUrl: 'https://example.com',
    status: 'COMPLETED',
    grade: 'B',
    score: 72,
    stack: 'Next.js',
    summary: JSON.stringify({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 0 }),
    startedAt: new Date('2025-01-01T10:00:00Z'),
    completedAt: new Date('2025-01-01T10:02:00Z'),
    performanceGrade: null,
    performanceScore: null,
    performanceMetrics: null,
    accessibilityGrade: null,
    accessibilityScore: null,
    accessibilityMetrics: null,
    seoGrade: null,
    seoScore: null,
    seoMetrics: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/scans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canViewScan).mockReturnValue(true);
  });

  it('returns 404 when scan not found', async () => {
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest('nonexistent'), { params: { id: 'nonexistent' } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Scan not found.');
  });

  it('returns 404 when canViewScan denies access', async () => {
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(makeScanRow() as any);
    vi.mocked(canViewScan).mockReturnValue(false);

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });

    expect(res.status).toBe(404);
  });

  it('returns null performanceMetrics when column is absent', async () => {
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(makeScanRow() as any);

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.performanceMetrics).toBeNull();
    // performanceScore should be null (not undefined — JSON omits undefined)
    expect(body.performanceScore).toBeNull();
  });

  it('T-08: normalises a pre-change blob and resolves scoreSource:lab', async () => {
    // Pre-change blob: no scoreSource, no fieldData. The normaliser must
    // default scoreSource to 'lab' (back-compat Rule A).
    const preChangeBlob = {
      lcp: 2400, fcp: 1200, cls: 0.05, tbt: 300, ttfb: 800, opportunities: [],
    };
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(
      makeScanRow({
        performanceGrade: 'A',
        performanceScore: 95,
        performanceMetrics: JSON.stringify(preChangeBlob),
      }) as any,
    );

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.performanceMetrics).not.toBeNull();
    expect(body.performanceMetrics.scoreSource).toBe('lab');
    expect(body.performanceMetrics.lcp).toBe(2400);
  });

  it('T-08: normalises a new-code partial blob (fieldData present, no scoreSource) → scoreSource:unavailable', async () => {
    // New-code partial blob: has fieldData but no scoreSource. Must NOT be
    // silently labelled 'lab' — back-compat Rule B.
    const partialBlob = {
      lcp: 1800, fcp: 900, cls: 0.02, tbt: 150, ttfb: 600, opportunities: [],
      fieldData: { overallCategory: 'FAST' },
      fieldDataVerdict: 'FAST',
    };
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(
      makeScanRow({
        performanceGrade: 'N/A',
        performanceScore: null,
        performanceMetrics: JSON.stringify(partialBlob),
      }) as any,
    );

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    // CRITICAL: must not silently say 'lab'
    expect(body.performanceMetrics.scoreSource).toBe('unavailable');
    // fieldData is preserved
    expect(body.performanceMetrics.fieldData).toMatchObject({ overallCategory: 'FAST' });
  });

  it('T-08: passes through new T-08 fields from a full new-code blob', async () => {
    const fullBlob = {
      lcp: 1500, fcp: 700, cls: 0.01, tbt: 100, ttfb: 300, opportunities: [],
      scoreSource: 'lab',
      fieldDataVerdict: 'FAST',
      fieldData: { overallCategory: 'FAST', metrics: {} },
      bestPracticesScore: 92,
      bestPracticesGrade: 'A',
      desktop: {
        score: 88,
        grade: 'B',
        scoreSource: 'lab',
        metrics: { lcp: 1200, fcp: 600, cls: 0.01, tbt: 80, ttfb: 400, opportunities: [] },
      },
    };
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(
      makeScanRow({
        performanceGrade: 'A',
        performanceScore: 94,
        performanceMetrics: JSON.stringify(fullBlob),
      }) as any,
    );

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    const pm = body.performanceMetrics;
    expect(pm.scoreSource).toBe('lab');
    expect(pm.fieldDataVerdict).toBe('FAST');
    expect(pm.fieldData).toMatchObject({ overallCategory: 'FAST' });
    expect(pm.bestPracticesScore).toBe(92);
    expect(pm.bestPracticesGrade).toBe('A');
    expect(pm.desktop).toMatchObject({ score: 88, grade: 'B', scoreSource: 'lab' });
  });

  it('returns 200 with null performanceMetrics on corrupt JSON (does not throw 500)', async () => {
    // Corrupt JSON in the column must be handled gracefully — return null
    // rather than throwing an unhandled error.
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(
      makeScanRow({ performanceMetrics: 'not-valid-json' }) as any,
    );

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });

    // Route should not 500 — it logs a warning and returns null for that field
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.performanceMetrics).toBeNull();
  });

  it('T-08: UNAVAILABLE blob (scoreSource:unavailable) passes through verbatim', async () => {
    const unavailableBlob = {
      lcp: null, fcp: null, cls: null, tbt: null, ttfb: null, opportunities: [],
      scoreSource: 'unavailable',
      fieldDataVerdict: null,
      fieldData: null,
      bestPracticesScore: null,
      bestPracticesGrade: 'N/A',
    };
    vi.mocked(prisma.scan.findUnique).mockResolvedValue(
      makeScanRow({
        performanceGrade: 'N/A',
        performanceScore: null,
        performanceMetrics: JSON.stringify(unavailableBlob),
      }) as any,
    );

    const res = await GET(makeRequest('scan-abc123'), { params: { id: 'scan-abc123' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.performanceScore).toBeNull();
    expect(body.performanceMetrics.scoreSource).toBe('unavailable');
    expect(body.performanceMetrics.lcp).toBeNull();
  });
});
