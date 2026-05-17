/**
 * Unit tests for src/lib/scanner/psi-cache.ts
 *
 * Covers every acceptance criterion from T-04:
 *  - Hit: cached value returned without calling fetcher again
 *  - Miss: fetcher is called when no entry exists
 *  - TTL expiry: expired entry treated as a miss; fetcher called
 *  - LRU eviction cap: inserting 10 000 distinct keys never exceeds 200 entries;
 *    the most-recent entries are retained
 *  - Fail-soft: internal Map error; getOrFetch still returns the live value
 *  - Success-only caching: uncacheable / null value not stored; next call refetches
 *  - Bypass: returns fresh value, refreshes cache entry for subsequent reads
 *  - Over-long key: not cached, always goes to fetcher
 *  - null key (from buildPsiCacheKey over-length path): always miss, never stored
 *  - buildPsiCacheKey returns null when composed key exceeds 2048 chars
 *
 * TTL control strategy:
 *  - The implementation reads process.env.PSI_CACHE_TTL_MS on every expiry check
 *    (via readTtlMs()). Setting PSI_CACHE_TTL_MS to a tiny value (e.g. "1")
 *    before calling set() and then advancing real time by 1 ms is sufficient to
 *    exercise expiry without fake timers.  Tests that need a long TTL reset it
 *    back to "999999" so entries don't expire during the assertion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import {
  buildPsiCacheKey,
  get,
  set,
  getOrFetch,
  cacheSize,
  clearCache,
} from '@/lib/scanner/psi-cache';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid LighthouseMetrics fixture. */
function makeMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
  return {
    lcp: 2500,
    fcp: 1200,
    cls: 0.08,
    tbt: 180,
    tti: 3800,
    si: 3000,
    ttfb: 350,
    performanceScore: 0.85,
    accessibilityScore: 0.92,
    seoScore: 0.97,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    ...overrides,
  };
}

/** Compose a key that is guaranteed to stay under 2048 chars. */
function shortKey(suffix = 'example.com'): string {
  return buildPsiCacheKey(`https://${suffix}`, 'mobile') as string;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  // Start every test with a clean cache and a generous TTL.
  clearCache();
  process.env.PSI_CACHE_TTL_MS = '999999'; // far-future expiry by default
});

afterEach(() => {
  clearCache();
  delete process.env.PSI_CACHE_TTL_MS;
});

// ─── buildPsiCacheKey ─────────────────────────────────────────────────────────

describe('buildPsiCacheKey()', () => {
  it('returns a non-null string for a normal URL + strategy', () => {
    const key = buildPsiCacheKey('https://example.com', 'mobile');
    expect(key).toBeTypeOf('string');
    expect(key).toContain('https://example.com');
    expect(key).toContain('mobile');
  });

  it('returns different keys for mobile vs desktop', () => {
    const mobile = buildPsiCacheKey('https://example.com', 'mobile');
    const desktop = buildPsiCacheKey('https://example.com', 'desktop');
    expect(mobile).not.toBe(desktop);
  });

  it('returns null when the composed key exceeds 2048 characters', () => {
    // Build a URL that, when combined with the strategy suffix, exceeds 2048 bytes.
    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    const key = buildPsiCacheKey(longUrl, 'mobile');
    expect(key).toBeNull();
  });

  it('returns non-null for a key exactly at the 2048-char limit', () => {
    // Compose a URL so that `${url}::mobile` is exactly 2048 chars.
    const suffix = '::mobile';
    const url = 'a'.repeat(2048 - suffix.length);
    const key = buildPsiCacheKey(url, 'mobile');
    // Exactly 2048 → should NOT be null (boundary: > 2048 is refused, = 2048 is ok)
    expect(key).not.toBeNull();
    expect(key!.length).toBe(2048);
  });
});

// ─── get() and set() ─────────────────────────────────────────────────────────

describe('get() / set()', () => {
  it('returns null for a key that was never set (miss)', () => {
    expect(get('never-set')).toBeNull();
  });

  it('returns the stored value immediately after set (hit)', () => {
    const key = shortKey();
    const metrics = makeMetrics({ lcp: 9999 });
    set(key, metrics);
    expect(get(key)).toEqual(metrics);
  });

  it('does not mutate the stored value on retrieval', () => {
    const key = shortKey();
    const metrics = makeMetrics();
    set(key, metrics);
    const retrieved = get(key);
    expect(retrieved).toBe(metrics); // same reference, not a copy
  });

  it('silently ignores set(null, value) — null key means uncacheable', () => {
    // null key comes from buildPsiCacheKey when URL is too long
    expect(() => set(null, makeMetrics())).not.toThrow();
    // Nothing was stored; size stays 0
    expect(cacheSize()).toBe(0);
  });

  it('silently ignores set(key, null) — null value means failed result', () => {
    const key = shortKey();
    // TypeScript allows null via the function signature
    expect(() => set(key, null as unknown as LighthouseMetrics)).not.toThrow();
    expect(get(key)).toBeNull();
    expect(cacheSize()).toBe(0);
  });

  it('returns null for a null key — always a miss', () => {
    expect(get(null)).toBeNull();
  });

  it('overwrites a key on repeated set() calls', () => {
    const key = shortKey();
    const first = makeMetrics({ lcp: 1000 });
    const second = makeMetrics({ lcp: 2000 });
    set(key, first);
    set(key, second);
    expect(get(key)?.lcp).toBe(2000);
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('TTL expiry', () => {
  // Capture the env value set by the outer beforeEach so we can restore it
  // exactly. This prevents leaking a mutated PSI_CACHE_TTL_MS into other tests.
  let savedTtl: string | undefined;

  beforeEach(() => {
    savedTtl = process.env.PSI_CACHE_TTL_MS;
    // Use fake timers so Date.now() is deterministic and controlled by
    // vi.advanceTimersByTime(). This avoids relying on a real 1-2 ms wall-clock
    // margin which is non-deterministic under full-suite load.
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Always restore real timers first, even if the test threw, so ambient
    // timer state cannot leak into subsequent tests in the suite.
    vi.useRealTimers();
    // Restore the env var to the value the outer beforeEach established
    // ('999999') so TTL state cannot leak into the rest of the suite.
    if (savedTtl === undefined) {
      delete process.env.PSI_CACHE_TTL_MS;
    } else {
      process.env.PSI_CACHE_TTL_MS = savedTtl;
    }
  });

  it('returns null for an expired entry (treated as a miss)', () => {
    // TTL = 50 ms; advance time by 1000 ms — well past expiry.
    // No real waiting needed: vi.advanceTimersByTime moves Date.now() forward
    // deterministically so isExpired() sees the elapsed time immediately.
    process.env.PSI_CACHE_TTL_MS = '50';
    const key = shortKey('ttl-test.com');
    set(key, makeMetrics());

    vi.advanceTimersByTime(1000);

    expect(get(key)).toBeNull();
  });

  it('purges the expired entry so it no longer occupies a slot', () => {
    process.env.PSI_CACHE_TTL_MS = '50';
    const key = shortKey('purge-test.com');
    set(key, makeMetrics());

    vi.advanceTimersByTime(1000);

    // Access triggers lazy purge.
    get(key);
    expect(cacheSize()).toBe(0);
  });

  it('does not expire an entry whose TTL has not elapsed', () => {
    // TTL = 5000 ms; advance only 100 ms — well within the TTL, entry stays live.
    process.env.PSI_CACHE_TTL_MS = '5000';
    const key = shortKey('fresh.com');
    const metrics = makeMetrics({ lcp: 777 });
    set(key, metrics);

    vi.advanceTimersByTime(100);

    expect(get(key)).toEqual(metrics);
  });
});

// ─── LRU eviction cap ─────────────────────────────────────────────────────────

describe('LRU eviction (200-entry hard cap)', () => {
  it('never exceeds 200 entries when 10 000 distinct keys are inserted', () => {
    for (let i = 0; i < 10_000; i++) {
      const key = `https://url-${i}.example.com::mobile`;
      set(key, makeMetrics({ lcp: i }));
    }
    expect(cacheSize()).toBe(200);
  });

  it('retains the 200 most-recently inserted entries', () => {
    // Insert 300 entries; the last 200 must survive.
    for (let i = 0; i < 300; i++) {
      set(`key-${i}`, makeMetrics({ lcp: i }));
    }

    // The first 100 entries (key-0 … key-99) must have been evicted.
    for (let i = 0; i < 100; i++) {
      expect(get(`key-${i}`)).toBeNull();
    }

    // The last 200 entries (key-100 … key-299) must still be present.
    for (let i = 100; i < 300; i++) {
      expect(get(`key-${i}`)).not.toBeNull();
    }
  });

  it('promotes a recently-read entry above the LRU position', () => {
    // Fill the cache to capacity.
    for (let i = 0; i < 200; i++) {
      set(`lru-${i}`, makeMetrics());
    }

    // Read lru-0 to promote it (it was the LRU candidate).
    get('lru-0');

    // Insert one more entry to force an eviction.
    set('lru-new', makeMetrics());

    // lru-0 was promoted, so it must NOT have been evicted.
    expect(get('lru-0')).not.toBeNull();

    // lru-1 (the new LRU candidate after lru-0 was promoted) must have been evicted.
    expect(get('lru-1')).toBeNull();
  });
});

// ─── Over-long key ────────────────────────────────────────────────────────────

describe('over-long key handling', () => {
  it('does not store an entry when buildPsiCacheKey returns null for an over-long URL', () => {
    // buildPsiCacheKey returns null when the composed key exceeds 2048 chars.
    // Callers pass that null to set(), which silently no-ops.
    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    const key = buildPsiCacheKey(longUrl, 'mobile');

    expect(key).toBeNull(); // buildPsiCacheKey correctly returns null

    // set(null, ...) must be a no-op — nothing stored.
    set(key, makeMetrics());
    expect(cacheSize()).toBe(0);
    expect(get(key)).toBeNull();
  });

  it('does not serve a result via getOrFetch when the key is null (over-long URL path)', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    const key = buildPsiCacheKey(longUrl, 'mobile'); // null
    const metrics = makeMetrics({ lcp: 42 });
    const fetcher = vi.fn().mockResolvedValue(metrics);

    const result = await getOrFetch(key, fetcher);

    expect(result?.lcp).toBe(42);
    expect(fetcher).toHaveBeenCalledOnce();
    // Nothing was cached; next call must hit the fetcher again.
    await getOrFetch(key, vi.fn().mockResolvedValue(makeMetrics()));
    expect(cacheSize()).toBe(0);
  });
});

// ─── getOrFetch — cache hit ───────────────────────────────────────────────────

describe('getOrFetch() — cache hit', () => {
  it('returns the cached value without calling the fetcher', async () => {
    const key = shortKey('hit-test.com');
    const cached = makeMetrics({ lcp: 1111 });
    set(key, cached);

    const fetcher = vi.fn().mockResolvedValue(makeMetrics({ lcp: 9999 }));
    const result = await getOrFetch(key, fetcher);

    expect(result).toEqual(cached);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

// ─── getOrFetch — cache miss ──────────────────────────────────────────────────

describe('getOrFetch() — cache miss', () => {
  it('calls the fetcher on a miss and returns its value', async () => {
    const key = shortKey('miss-test.com');
    const freshMetrics = makeMetrics({ lcp: 5000 });
    const fetcher = vi.fn().mockResolvedValue(freshMetrics);

    const result = await getOrFetch(key, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(freshMetrics);
  });

  it('caches the fetched value so the next call is a hit', async () => {
    const key = shortKey('auto-cache.com');
    const fetcher = vi.fn().mockResolvedValue(makeMetrics({ lcp: 1234 }));

    await getOrFetch(key, fetcher);
    const second = await getOrFetch(key, fetcher);

    // Fetcher called only once; second call served from cache.
    expect(fetcher).toHaveBeenCalledOnce();
    expect(second?.lcp).toBe(1234);
  });
});

// ─── getOrFetch — TTL expiry ──────────────────────────────────────────────────

describe('getOrFetch() — TTL expiry', () => {
  // Same fake-timer + env-restore pattern as the 'TTL expiry' describe above.
  // Scoping fake timers to this block prevents interference with the async
  // getOrFetch() — bypass and other describe blocks that rely on real Promises.
  let savedTtl: string | undefined;

  beforeEach(() => {
    savedTtl = process.env.PSI_CACHE_TTL_MS;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (savedTtl === undefined) {
      delete process.env.PSI_CACHE_TTL_MS;
    } else {
      process.env.PSI_CACHE_TTL_MS = savedTtl;
    }
  });

  it('calls the fetcher again after an entry expires', async () => {
    // TTL = 50 ms; advance 1000 ms between the two getOrFetch calls so the
    // first entry is deterministically expired when the second call reads it.
    process.env.PSI_CACHE_TTL_MS = '50';
    const key = shortKey('expiry-fetch.com');
    const first = makeMetrics({ lcp: 111 });
    const second = makeMetrics({ lcp: 222 });
    const fetcher = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    // getOrFetch is async (awaits the fetcher); use runAllTimersAsync so Vitest
    // drains any micro/macro-task queue that fake timers may gate. First call.
    const r1 = await getOrFetch(key, fetcher);

    // Advance fake clock past TTL so the stored entry is treated as expired.
    vi.advanceTimersByTime(1000);

    // Second call: cache miss because entry is expired; fetcher called again.
    const r2 = await getOrFetch(key, fetcher);

    expect(r1?.lcp).toBe(111);
    expect(r2?.lcp).toBe(222);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

// ─── getOrFetch — bypass ──────────────────────────────────────────────────────

describe('getOrFetch() — bypass', () => {
  it('skips the cache read when bypass=true and returns a fresh value', async () => {
    const key = shortKey('bypass-test.com');
    const staleMetrics = makeMetrics({ lcp: 1 });
    const freshMetrics = makeMetrics({ lcp: 999 });
    set(key, staleMetrics);

    const fetcher = vi.fn().mockResolvedValue(freshMetrics);
    const result = await getOrFetch(key, fetcher, { bypass: true });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result?.lcp).toBe(999);
  });

  it('refreshes the cache entry after a bypass so the next non-bypass call gets fresh data', async () => {
    const key = shortKey('bypass-refresh.com');
    const original = makeMetrics({ lcp: 1 });
    const refreshed = makeMetrics({ lcp: 999 });
    set(key, original);

    // Bypass: fetcher returns refreshed value and updates the cache.
    await getOrFetch(key, vi.fn().mockResolvedValue(refreshed), { bypass: true });

    // Non-bypass call: must serve the refreshed value from cache.
    const fetcher2 = vi.fn();
    const result = await getOrFetch(key, fetcher2);

    expect(result?.lcp).toBe(999);
    expect(fetcher2).not.toHaveBeenCalled();
  });

  it('does not cache the bypass result when isCacheable returns false', async () => {
    const key = shortKey('bypass-nocache.com');
    const uncacheableMetrics = makeMetrics({ performanceScore: null });

    const fetcher = vi.fn().mockResolvedValue(uncacheableMetrics);
    await getOrFetch(key, fetcher, {
      bypass: true,
      isCacheable: (v) => v.performanceScore !== null,
    });

    // The next non-bypass call must call the fetcher again (not served from cache).
    const fetcher2 = vi.fn().mockResolvedValue(makeMetrics());
    await getOrFetch(key, fetcher2);
    expect(fetcher2).toHaveBeenCalledOnce();
  });
});

// ─── getOrFetch — success-only caching ───────────────────────────────────────

describe('getOrFetch() — success-only / isCacheable predicate', () => {
  it('does not cache a value when isCacheable returns false', async () => {
    const key = shortKey('no-cache-pred.com');
    const failedMetrics = makeMetrics({ performanceScore: null });
    const fetcher = vi.fn().mockResolvedValue(failedMetrics);

    await getOrFetch(key, fetcher, { isCacheable: (v) => v.performanceScore !== null });

    // Entry must not be in the cache.
    expect(cacheSize()).toBe(0);
    expect(get(key)).toBeNull();
  });

  it('refetches on the next call when the previous result was not cached', async () => {
    const key = shortKey('refetch-after-fail.com');
    const failedMetrics = makeMetrics({ performanceScore: null });
    const goodMetrics = makeMetrics({ performanceScore: 0.9 });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(failedMetrics)
      .mockResolvedValueOnce(goodMetrics);

    await getOrFetch(key, fetcher, { isCacheable: (v) => v.performanceScore !== null });
    const second = await getOrFetch(key, fetcher, { isCacheable: (v) => v.performanceScore !== null });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(second?.performanceScore).toBe(0.9);
  });

  it('does not cache a null return from the fetcher', async () => {
    const key = shortKey('null-fetcher.com');
    // fetcher returning null models a total API failure
    const fetcher = vi.fn().mockResolvedValue(null);

    const result = await getOrFetch(key, fetcher);

    expect(result).toBeNull();
    expect(cacheSize()).toBe(0);

    // Next call must call the fetcher again.
    await getOrFetch(key, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caches the value when isCacheable is omitted (default: cache all non-null)', async () => {
    const key = shortKey('default-cache.com');
    const metrics = makeMetrics({ lcp: 42 });
    const fetcher = vi.fn().mockResolvedValue(metrics);

    await getOrFetch(key, fetcher);

    expect(cacheSize()).toBe(1);
    const fetcher2 = vi.fn();
    const second = await getOrFetch(key, fetcher2);
    expect(fetcher2).not.toHaveBeenCalled();
    expect(second?.lcp).toBe(42);
  });
});

// ─── getOrFetch — fail-soft (internal cache error) ───────────────────────────

describe('getOrFetch() — fail-soft on internal error', () => {
  it('calls the fetcher and returns the live value when an internal get error occurs', async () => {
    const key = shortKey('fail-soft-get.com');
    const liveMetrics = makeMetrics({ lcp: 777 });
    const fetcher = vi.fn().mockResolvedValue(liveMetrics);

    // Simulate internal Map failure by replacing the internal store's get method.
    // We do this by monkeypatching the global Map prototype temporarily.
    // The cache module holds a reference to a Map instance; patching that
    // instance's prototype affects this instance without affecting others.
    //
    // Strategy: we force get() to see a miss by clearing the cache and then
    // making the Map throw on .get() via prototype spying.
    const originalMapGet = Map.prototype.get;
    Map.prototype.get = function (k: unknown) {
      if (typeof k === 'string' && k === key) {
        throw new Error('Simulated internal cache failure');
      }
      return originalMapGet.call(this, k);
    };

    let result: LighthouseMetrics | null;
    try {
      result = await getOrFetch(key, fetcher);
    } finally {
      // Always restore the prototype — a failing test must not pollute others.
      Map.prototype.get = originalMapGet;
    }

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(liveMetrics);
  });

  it('returns the live value even when the internal set() throws after fetch', async () => {
    const key = shortKey('fail-soft-set.com');
    const liveMetrics = makeMetrics({ lcp: 888 });
    const fetcher = vi.fn().mockResolvedValue(liveMetrics);

    // Patch Map.prototype.set to throw for our key to simulate a storage failure.
    const originalMapSet = Map.prototype.set;
    Map.prototype.set = function (k: unknown, v: unknown) {
      if (typeof k === 'string' && k === key) {
        throw new Error('Simulated set failure');
      }
      return originalMapSet.call(this, k, v);
    };

    let result: LighthouseMetrics | null;
    try {
      result = await getOrFetch(key, fetcher);
    } finally {
      Map.prototype.set = originalMapSet;
    }

    // The live value must be returned even though caching failed.
    expect(result).toEqual(liveMetrics);
  });

  it('propagates fetcher errors (cache must not suppress live-fetch failures)', async () => {
    const key = shortKey('fetcher-error.com');
    const fetcher = vi.fn().mockRejectedValue(new Error('PSI API unreachable'));

    await expect(getOrFetch(key, fetcher)).rejects.toThrow('PSI API unreachable');
  });
});

// ─── getOrFetch — null key (over-long URL path) ───────────────────────────────

describe('getOrFetch() — null key handling', () => {
  it('always calls the fetcher when key is null and does not store the result', async () => {
    const metrics = makeMetrics({ lcp: 321 });
    const fetcher = vi.fn().mockResolvedValue(metrics);

    const result = await getOrFetch(null, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(metrics);
    expect(cacheSize()).toBe(0);
  });

  it('calls the fetcher on every call when key is null (never served from cache)', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeMetrics());

    await getOrFetch(null, fetcher);
    await getOrFetch(null, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
