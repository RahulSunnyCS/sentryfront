/**
 * Tests for src/lib/scanner/tools/kev.ts
 *
 * kev.ts caches the CISA KEV catalog. In test env (NODE_ENV=test / VITEST=true),
 * cacheGetIds() returns null and cacheSetIds() is a no-op, so every call to
 * loadKevSet() goes straight to fetchKevFeed().
 *
 * fetch is mocked globally in vitest.setup.ts. We reset it per-test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadKevSet, isKev } from '@/lib/scanner/tools/kev';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// loadKevSet — happy path
// ---------------------------------------------------------------------------
describe('loadKevSet — successful fetch', () => {
  it('returns a Set of CVE IDs from the feed', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        vulnerabilities: [
          { cveID: 'CVE-2021-44228' },
          { cveID: 'CVE-2022-30190' },
        ],
      }),
    } as unknown as Response);

    const set = await loadKevSet();
    expect(set).toBeInstanceOf(Set);
    expect(set.has('CVE-2021-44228')).toBe(true);
    expect(set.has('CVE-2022-30190')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('filters out falsy cveID values', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        vulnerabilities: [
          { cveID: 'CVE-2021-44228' },
          { cveID: '' },         // falsy — should be filtered
          { cveID: undefined },  // falsy — should be filtered
        ],
      }),
    } as unknown as Response);

    const set = await loadKevSet();
    expect(set.size).toBe(1);
    expect(set.has('CVE-2021-44228')).toBe(true);
  });

  it('returns an empty Set when vulnerabilities array is missing', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK' }), // no vulnerabilities key
    } as unknown as Response);

    const set = await loadKevSet();
    expect(set).toBeInstanceOf(Set);
    expect(set.size).toBe(0);
  });

  it('returns an empty Set when vulnerabilities is empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ vulnerabilities: [] }),
    } as unknown as Response);

    const set = await loadKevSet();
    expect(set.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// loadKevSet — error / degradation paths
// ---------------------------------------------------------------------------
describe('loadKevSet — error paths', () => {
  it('returns an empty Set when HTTP response is non-OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as unknown as Response);

    const set = await loadKevSet();
    expect(set).toBeInstanceOf(Set);
    expect(set.size).toBe(0);
  });

  it('returns an empty Set when fetch throws (network error)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network error'),
    );

    const set = await loadKevSet();
    expect(set).toBeInstanceOf(Set);
    expect(set.size).toBe(0);
  });

  it('returns an empty Set when fetch throws a non-Error value', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('timeout');

    const set = await loadKevSet();
    expect(set.size).toBe(0);
  });

  it('never throws — always returns a Set', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AbortError'),
    );

    await expect(loadKevSet()).resolves.toBeInstanceOf(Set);
  });
});

// ---------------------------------------------------------------------------
// isKev — CVE ID lookup convenience helper
// ---------------------------------------------------------------------------
describe('isKev', () => {
  it('returns true when the CVE is in the KEV catalog', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        vulnerabilities: [{ cveID: 'CVE-2021-44228' }],
      }),
    } as unknown as Response);

    expect(await isKev('CVE-2021-44228')).toBe(true);
  });

  it('returns false when the CVE is NOT in the KEV catalog', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        vulnerabilities: [{ cveID: 'CVE-2021-44228' }],
      }),
    } as unknown as Response);

    expect(await isKev('CVE-2000-00001')).toBe(false);
  });

  it('normalises CVE IDs to uppercase before lookup', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // KEV publishes uppercase IDs
        vulnerabilities: [{ cveID: 'CVE-2021-44228' }],
      }),
    } as unknown as Response);

    // Pass lowercase — isKev normalises to uppercase
    expect(await isKev('cve-2021-44228')).toBe(true);
  });

  it('returns false when the catalog is empty (feed failure)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network failure'),
    );

    expect(await isKev('CVE-2021-44228')).toBe(false);
  });
});
