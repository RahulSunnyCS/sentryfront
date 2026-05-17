/**
 * In-memory LRU cache for PageSpeed Insights (PSI) results.
 *
 * Design rationale:
 * - SHORT TTL (default 5 min): PSI scores change slowly, but a re-scan initiated
 *   by the user must return fresh data. 5 minutes balances API-quota savings
 *   against stale-data risk for the typical single-session workflow
 *   (scan → read report → optionally re-scan after a fix).
 * - LRU cap (200 entries): bounds worst-case memory use. At ~20 KB per cached
 *   LighthouseMetrics value that is ~4 MB max. An attacker can flood us with
 *   unique URLs, but they can only displace earlier entries — they cannot grow
 *   unbounded memory or read another URL's cached result (per-URL keying means
 *   each entry is its own namespace, so there is no cross-URL poisoning).
 * - FAIL-SOFT: every internal cache operation is wrapped so that a bug in the
 *   cache implementation NEVER surfaces as an error to the scan pipeline. On
 *   any exception the caller gets a cache miss and calls the live API.
 * - SUCCESS-ONLY: only non-null results that pass the caller-supplied
 *   `isCacheable` predicate are stored. Null / UNAVAILABLE / error values are
 *   never persisted, so the next call always re-fetches them from the live API.
 *
 * Redis integration is explicitly out of scope for this delivery. If distributed
 * caching across multiple scan-worker processes is needed in the future, replace
 * this module's backing store with a Redis client while keeping the same API
 * surface — the callers (T-06 onwards) depend only on get/set/getOrFetch.
 */

import type { LighthouseMetrics } from './lighthouse';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Maximum number of entries the cache holds before evicting the LRU entry.
 * Bounded to protect the scan-worker process from memory exhaustion when
 * an adversary submits many distinct URLs.
 */
const MAX_ENTRIES = 200;

/**
 * Maximum byte length of a composed cache key. Keys beyond this are treated
 * as uncacheable (not stored, not served). A URL can be at most 2048 chars
 * per de-facto browser limits; the composed key adds a short suffix, so
 * 2048 is a generous but safe ceiling.
 */
const MAX_KEY_LENGTH = 2048;

/** Read PSI_CACHE_TTL_MS once at module load; falls back to 5 minutes. */
function readTtlMs(): number {
  const raw = process.env.PSI_CACHE_TTL_MS;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 300_000; // 5 minutes default
}

// ─── Internal LRU structure ───────────────────────────────────────────────────

/**
 * Each stored entry holds the cached value and the wall-clock timestamp at
 * which it was stored (used for TTL expiry checks).
 */
interface CacheEntry {
  value: LighthouseMetrics;
  storedAt: number; // Date.now() at insertion
}

/**
 * The LRU ordering is maintained by JavaScript's built-in Map insertion order.
 * Accessing an entry deletes it and re-inserts it at the tail (most-recently
 * used). The head (Map iterator's first entry) is always the LRU candidate for
 * eviction. This is O(1) for get, set, and eviction.
 */
const store = new Map<string, CacheEntry>();

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the configured TTL in milliseconds (re-reads env on each call to
 *  allow test overrides via process.env without module re-import). */
function ttlMs(): number {
  return readTtlMs();
}

/** Returns true when the entry's age exceeds the configured TTL. */
function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.storedAt > ttlMs();
}

/**
 * Move an existing key to the tail of the Map (mark as most-recently used).
 * This relies on Map preserving insertion order and the ability to re-insert.
 */
function touchEntry(key: string, entry: CacheEntry): void {
  store.delete(key);
  store.set(key, entry);
}

/** Evict the least-recently-used entry (the Map's first element). */
function evictLru(): void {
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) {
    store.delete(firstKey);
  }
}

// ─── Public typed API ─────────────────────────────────────────────────────────

export type PsiStrategy = 'mobile' | 'desktop';

/**
 * Build the canonical cache key for a URL + strategy combination.
 *
 * NOTE: The category set (onlyCategories) is NOT included in the key because
 * the set of PSI categories requested is invariant across all current call
 * sites. If `onlyCategories` is ever wired through as a variable parameter
 * (e.g. performance-only vs. all-categories), revisit this function and
 * include a sorted category string in the key to avoid serving a partial
 * response to a full-category caller.
 *
 * Security note: per-URL keying means an attacker-controlled URL can only
 * affect its own entry. There is no mechanism for URL A to read or overwrite
 * URL B's cached result.
 *
 * @param normalizedUrl Already-normalized URL string (no trailing slash, lower-cased scheme/host).
 * @param strategy      'mobile' | 'desktop' — the PSI strategy parameter.
 * @returns Composed key string, or null if the key would exceed MAX_KEY_LENGTH.
 */
export function buildPsiCacheKey(
  normalizedUrl: string,
  strategy: PsiStrategy,
): string | null {
  const key = `${normalizedUrl}::${strategy}`;
  if (key.length > MAX_KEY_LENGTH) {
    // Over-long keys are treated as permanently uncacheable (not stored, not
    // served). This prevents a pathological URL from occupying memory.
    return null;
  }
  return key;
}

/**
 * Look up a key in the cache.
 *
 * Returns the cached value if present and unexpired; null on miss, expiry,
 * invalid key, or any internal error (fail-soft).
 */
export function get(key: string | null): LighthouseMetrics | null {
  // null key → uncacheable URL, always miss
  if (key === null) return null;
  try {
    const entry = store.get(key);
    if (entry === undefined) return null;

    if (isExpired(entry)) {
      // Purge the stale entry eagerly so it does not consume a slot.
      store.delete(key);
      return null;
    }

    // Promote to MRU position.
    touchEntry(key, entry);
    return entry.value;
  } catch {
    // Fail-soft: any unexpected error (e.g. broken Map state) is swallowed.
    return null;
  }
}

/**
 * Store a value in the cache under the given key.
 *
 * Silently no-ops when:
 * - key is null (uncacheable URL length exceeded)
 * - value is null (callers should never cache failed/missing results)
 * - any internal error occurs (fail-soft)
 */
export function set(key: string | null, value: LighthouseMetrics | null): void {
  if (key === null || value === null) return;
  try {
    // If the key already exists remove it first so the new insert lands at the
    // tail (most-recently used), maintaining LRU order.
    store.delete(key);

    // Evict LRU when at capacity (BEFORE inserting the new entry).
    if (store.size >= MAX_ENTRIES) {
      evictLru();
    }

    store.set(key, { value, storedAt: Date.now() });
  } catch {
    // Fail-soft: swallow any internal error.
  }
}

// ─── getOrFetch options ───────────────────────────────────────────────────────

export interface GetOrFetchOptions {
  /**
   * If true, skip the cache READ and always call the fetcher.
   * The result is still written to cache on success (bypass refreshes the
   * entry so a subsequent non-bypass call serves the refreshed value).
   */
  bypass?: boolean;

  /**
   * Optional predicate that gates whether a fetched value is stored.
   * Defaults to: cache the value if it is non-null.
   *
   * Use this to prevent caching UNAVAILABLE / degraded / partial responses.
   * Example: `(v) => v.performanceScore !== null`
   */
  isCacheable?: (value: LighthouseMetrics) => boolean;
}

/**
 * Convenience wrapper used by T-06 (PSI caller) to read-through the cache.
 *
 * Behaviour:
 * 1. Unless `bypass` is true, return the cached value if present and fresh.
 * 2. Call `fetcher()` to obtain a live value.
 * 3. If the live value is non-null and passes `isCacheable` (default: non-null
 *    check), store it in the cache.
 * 4. Return the live value regardless of caching success/failure (fail-soft).
 *
 * A `bypass` call skips step 1 but still executes step 3, so the refreshed
 * value is available to the next non-bypass call immediately.
 *
 * Any error thrown by the internal cache machinery is silently swallowed; the
 * fetcher is always called in that scenario so the scan pipeline is unaffected.
 *
 * @param key       Composed cache key from `buildPsiCacheKey`, or null for
 *                  uncacheable URLs (fetcher is always called; result not stored).
 * @param fetcher   Async function that calls the PSI API and returns a value.
 * @param options   Optional bypass / isCacheable overrides.
 */
export async function getOrFetch(
  key: string | null,
  fetcher: () => Promise<LighthouseMetrics | null>,
  options: GetOrFetchOptions = {},
): Promise<LighthouseMetrics | null> {
  const { bypass = false, isCacheable } = options;

  // Attempt cache read unless bypassed or key is null (uncacheable).
  if (!bypass && key !== null) {
    // get() is already fail-soft and returns null on any internal error.
    const cached = get(key);
    if (cached !== null) {
      return cached;
    }
  }

  // Call the live fetcher. Any exception from the fetcher propagates to the
  // caller (this wrapper does NOT swallow fetcher errors — that is the
  // scanner module's responsibility).
  const value = await fetcher();

  // Determine cacheability: respect caller predicate; default is non-null.
  const shouldCache: boolean = (() => {
    try {
      if (value === null) return false;
      if (isCacheable !== undefined) return isCacheable(value);
      return true; // default: cache any non-null result
    } catch {
      // If the predicate itself throws, treat as uncacheable (fail-soft).
      return false;
    }
  })();

  if (shouldCache && value !== null) {
    // set() is already fail-soft and swallows internal errors.
    set(key, value);
  }

  return value;
}

/**
 * Returns the current number of live (non-expired) entries in the cache.
 * Intended for testing and observability only — not part of the public API
 * consumed by T-06.
 */
export function cacheSize(): number {
  try {
    return store.size;
  } catch {
    return 0;
  }
}

/**
 * Clears all entries from the cache.
 * Intended for testing isolation only — not part of the public API.
 */
export function clearCache(): void {
  try {
    store.clear();
  } catch {
    // Fail-soft.
  }
}
