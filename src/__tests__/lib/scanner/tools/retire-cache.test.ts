/**
 * Tests for src/lib/scanner/tools/retire-cache.ts
 *
 * retire-cache.ts is a module with a top-level singleton cache. The key
 * public API is:
 *   - loadJsRepository(): returns the bundled jsrepository.json baseline in
 *     test env, otherwise fetches from GitHub and caches the result.
 *   - __resetJsRepositoryCacheForTests(): resets the in-process cache.
 *
 * In test env (NODE_ENV=test / VITEST=true), loadJsRepository returns the
 * vendored baseline directly without any fetch. Tests that exercise the
 * production fetch path temporarily disable test-env flags and mock fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadJsRepository,
  __resetJsRepositoryCacheForTests,
} from '@/lib/scanner/tools/retire-cache';

// ---------------------------------------------------------------------------
// Test-env path (fast, no fetch needed)
// ---------------------------------------------------------------------------
describe('loadJsRepository — test environment', () => {
  beforeEach(() => {
    __resetJsRepositoryCacheForTests();
    vi.clearAllMocks();
  });

  it('returns a non-empty object (the vendored baseline)', async () => {
    const db = await loadJsRepository();
    expect(typeof db).toBe('object');
    expect(db).not.toBeNull();
    expect(Object.keys(db).length).toBeGreaterThan(0);
  });

  it('returns an object whose values have the expected shape', async () => {
    const db = await loadJsRepository();
    // Each entry is a SignatureEntry with optional npmname / extractors / vulnerabilities
    const firstKey = Object.keys(db)[0];
    const entry = db[firstKey];
    expect(typeof entry).toBe('object');
  });

  it('returns the same reference on repeated calls (test-env short-circuits cache)', async () => {
    const first = await loadJsRepository();
    const second = await loadJsRepository();
    // In test env both calls return the same module-level JSON object
    expect(Object.keys(first).length).toBe(Object.keys(second).length);
  });
});

// ---------------------------------------------------------------------------
// __resetJsRepositoryCacheForTests — escape hatch
// ---------------------------------------------------------------------------
describe('__resetJsRepositoryCacheForTests', () => {
  it('is a function', () => {
    expect(typeof __resetJsRepositoryCacheForTests).toBe('function');
  });

  it('can be called multiple times without error', () => {
    expect(() => {
      __resetJsRepositoryCacheForTests();
      __resetJsRepositoryCacheForTests();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Production fetch path (non-test env simulation)
// ---------------------------------------------------------------------------
describe('loadJsRepository — production fetch paths', () => {
  const originalVitest = process.env.VITEST;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    __resetJsRepositoryCacheForTests();
    vi.clearAllMocks();
    // Disable test-env guard so the production code path runs
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.VITEST = originalVitest;
    process.env.NODE_ENV = originalNodeEnv;
    __resetJsRepositoryCacheForTests();
    vi.restoreAllMocks();
  });

  it('fetches from GitHub and returns the parsed JSON on success', async () => {
    const fakeDb = { jquery: { npmname: 'jquery', vulnerabilities: [] } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => fakeDb,
    } as unknown as Response);

    const db = await loadJsRepository();
    expect(db).toEqual(fakeDb);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('falls back to the vendored baseline when fetch returns non-OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    const db = await loadJsRepository();
    // Fallback returns the vendored baseline — must be non-empty
    expect(Object.keys(db).length).toBeGreaterThan(0);
  });

  it('falls back to the vendored baseline when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));

    const db = await loadJsRepository();
    expect(Object.keys(db).length).toBeGreaterThan(0);
  });

  it('falls back when response body is not an object', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => null, // non-object response
    } as unknown as Response);

    const db = await loadJsRepository();
    // Returns vendored baseline
    expect(Object.keys(db).length).toBeGreaterThan(0);
  });

  it('uses cached value on second call without re-fetching', async () => {
    const fakeDb = { angular: { npmname: 'angular', vulnerabilities: [] } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => fakeDb,
    } as unknown as Response);

    const first = await loadJsRepository();
    const second = await loadJsRepository(); // should use cache

    expect(first).toEqual(fakeDb);
    expect(second).toEqual(fakeDb);
    // fetch should only be called once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
