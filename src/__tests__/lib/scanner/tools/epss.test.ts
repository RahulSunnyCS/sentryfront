/**
 * Tests for src/lib/scanner/tools/epss.ts
 *
 * getEpss() performs a per-CVE EPSS lookup. In test env, the cache is bypassed
 * (cacheGet returns undefined, cacheSet is a no-op) so every call hits the
 * fetch mock.
 *
 * fetch is mocked globally in vitest.setup.ts. We reset it per-test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEpss } from '@/lib/scanner/tools/epss';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Successful lookups
// ---------------------------------------------------------------------------
describe('getEpss — successful fetch', () => {
  it('returns an EpssRecord with score and percentile on a valid response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        data: [{ cve: 'CVE-2021-44228', epss: '0.9765', percentile: '0.999' }],
      }),
    } as unknown as Response);

    const result = await getEpss('CVE-2021-44228');
    expect(result).not.toBeNull();
    expect(result!.score).toBeCloseTo(0.9765);
    // percentile is multiplied by 100 to normalise from 0-1 → 0-100
    expect(result!.percentile).toBeCloseTo(99.9);
  });

  it('normalises percentile from 0-1 to 0-100', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ cve: 'CVE-2022-30190', epss: '0.5', percentile: '0.75' }],
      }),
    } as unknown as Response);

    const result = await getEpss('CVE-2022-30190');
    expect(result!.percentile).toBeCloseTo(75);
  });

  it('returns null when data array is empty (CVE not in EPSS)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);

    const result = await getEpss('CVE-2000-99999');
    expect(result).toBeNull();
  });

  it('returns null when data key is missing from response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK' }), // no data key
    } as unknown as Response);

    const result = await getEpss('CVE-2000-99999');
    expect(result).toBeNull();
  });

  it('returns null when epss is not a finite number', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ cve: 'CVE-2021-44228', epss: 'not-a-number', percentile: '0.5' }],
      }),
    } as unknown as Response);

    const result = await getEpss('CVE-2021-44228');
    expect(result).toBeNull();
  });

  it('returns null when percentile is not a finite number', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ cve: 'CVE-2021-44228', epss: '0.5', percentile: 'NaN' }],
      }),
    } as unknown as Response);

    const result = await getEpss('CVE-2021-44228');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error / degradation paths
// ---------------------------------------------------------------------------
describe('getEpss — error paths', () => {
  it('returns null when HTTP response is non-OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await getEpss('CVE-2021-44228');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network error'),
    );

    const result = await getEpss('CVE-2021-44228');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a non-Error value', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('AbortError');

    const result = await getEpss('CVE-2021-44228');
    expect(result).toBeNull();
  });

  it('never throws — always returns null or an EpssRecord', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AbortError'),
    );

    await expect(getEpss('CVE-2021-44228')).resolves.toBeNull();
  });

  it('encodes the CVE ID in the URL query string', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);

    await getEpss('CVE-2021-44228');
    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('cve=CVE-2021-44228');
  });
});
