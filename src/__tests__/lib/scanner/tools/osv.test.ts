/**
 * Tests for src/lib/scanner/tools/osv.ts
 *
 * queryBatch() and getVuln() perform OSV.dev API lookups.
 * In test env, the cache is bypassed so every call hits the fetch mock.
 * extractCvssBaseScore() is a pure function — no fetch needed.
 *
 * fetch is mocked globally in vitest.setup.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { queryBatch, getVuln, extractCvssBaseScore } from '@/lib/scanner/tools/osv';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// queryBatch
// ---------------------------------------------------------------------------
describe('queryBatch', () => {
  it('returns empty array for empty input without fetching', async () => {
    const result = await queryBatch([]);
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns vuln IDs for each queried package', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { vulns: [{ id: 'GHSA-abc-123' }, { id: 'CVE-2021-44228' }] },
          { vulns: [] },
        ],
      }),
    } as unknown as Response);

    const result = await queryBatch([
      { ecosystem: 'npm', name: 'lodash', version: '4.17.20' },
      { ecosystem: 'npm', name: 'safe-package', version: '1.0.0' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(['GHSA-abc-123', 'CVE-2021-44228']);
    expect(result[1]).toEqual([]);
  });

  it('returns empty arrays when the batch response is non-OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as unknown as Response);

    const result = await queryBatch([
      { ecosystem: 'npm', name: 'lodash', version: '4.17.20' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([]);
  });

  it('returns empty arrays when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network error'),
    );

    const result = await queryBatch([
      { ecosystem: 'npm', name: 'express', version: '4.18.0' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([]);
  });

  it('returns empty arrays when batch response has no results key', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // no results key
    } as unknown as Response);

    const result = await queryBatch([
      { ecosystem: 'npm', name: 'axios', version: '0.21.0' },
    ]);

    expect(result[0]).toEqual([]);
  });

  it('handles missing vulns key in a result entry', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{}], // no vulns key
      }),
    } as unknown as Response);

    const result = await queryBatch([
      { ecosystem: 'npm', name: 'moment', version: '2.29.0' },
    ]);

    expect(result[0]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getVuln
// ---------------------------------------------------------------------------
describe('getVuln', () => {
  it('returns the parsed vuln record on success', async () => {
    const vuln = {
      id: 'CVE-2021-44228',
      summary: 'Log4Shell',
      aliases: ['GHSA-jfh8-c2jp-hdpf'],
      severity: [{ type: 'CVSS_V3', score: '10.0' }],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => vuln,
    } as unknown as Response);

    const result = await getVuln('CVE-2021-44228');
    expect(result).toEqual(vuln);
  });

  it('returns null when HTTP response is non-OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await getVuln('CVE-2000-00001');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network error'),
    );

    const result = await getVuln('CVE-2021-44228');
    expect(result).toBeNull();
  });

  it('never throws — always resolves', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');

    await expect(getVuln('CVE-2021-44228')).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractCvssBaseScore — pure function
// ---------------------------------------------------------------------------
describe('extractCvssBaseScore', () => {
  it('returns null for undefined input', () => {
    expect(extractCvssBaseScore(undefined)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(extractCvssBaseScore([])).toBeNull();
  });

  it('extracts score from a plain numeric score field', () => {
    expect(
      extractCvssBaseScore([{ type: 'CVSS_V3', score: '9.8' }]),
    ).toBeCloseTo(9.8);
  });

  it('extracts score from a baseScore= embedded field', () => {
    expect(
      extractCvssBaseScore([
        { type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H/baseScore=10.0' },
      ]),
    ).toBeCloseTo(10.0);
  });

  it('prefers CVSS_V3 over CVSS_V2', () => {
    expect(
      extractCvssBaseScore([
        { type: 'CVSS_V2', score: '6.8' },
        { type: 'CVSS_V3', score: '9.8' },
      ]),
    ).toBeCloseTo(9.8);
  });

  it('falls back to CVSS_V2 when only V2 is present', () => {
    expect(
      extractCvssBaseScore([{ type: 'CVSS_V2', score: '7.5' }]),
    ).toBeCloseTo(7.5);
  });

  it('returns null when score is a non-numeric vector string without baseScore', () => {
    expect(
      extractCvssBaseScore([
        { type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H' },
      ]),
    ).toBeNull();
  });

  it('handles CVSS_V31 type', () => {
    expect(
      extractCvssBaseScore([{ type: 'CVSS_V31', score: '8.1' }]),
    ).toBeCloseTo(8.1);
  });

  it('handles CVSS_V40 type', () => {
    expect(
      extractCvssBaseScore([{ type: 'CVSS_V40', score: '9.0' }]),
    ).toBeCloseTo(9.0);
  });

  it('handles baseScore: format with colon', () => {
    expect(
      extractCvssBaseScore([
        { type: 'CVSS_V3', score: 'vector/baseScore:7.5' },
      ]),
    ).toBeCloseTo(7.5);
  });
});
