/**
 * CISA Known Exploited Vulnerabilities (KEV) client.
 *
 * Fetches the public-domain KEV catalog (~1.5 MB JSON) once per 24h and
 * caches the resolved Set<string> of CVE IDs. KEV membership is the
 * "this CVE is being actively exploited in the wild" signal — it short-
 * circuits the severity rubric to CRITICAL.
 *
 * Feed failures degrade silently: returns an empty Set so kevMatch
 * defaults to false. Scans never abort on a KEV outage.
 *
 * Cache pattern is duplicated from osv-cache.ts per the locked plan
 * decision — avoids refactoring the just-shipped Phase 3.2 caching code.
 */
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const KEV_FEED_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const KEV_FETCH_TIMEOUT_MS = 15_000;
const TTL_SECONDS = 24 * 60 * 60;
const KEV_CACHE_KEY = 'kev:v1:cve-ids';

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = url && token ? new Redis({ url, token }) : null;

interface MemoryEntry {
  value: string[];
  expiresAt: number;
}

let memorySet: MemoryEntry | null = null;

function isTestEnv(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

async function cacheGetIds(): Promise<string[] | null> {
  if (isTestEnv()) return null;

  if (redis) {
    try {
      const raw = await redis.get<string[]>(KEV_CACHE_KEY);
      return raw ?? null;
    } catch (err) {
      logger.warn('KEV cache Redis get failed; falling through', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!memorySet) return null;
  if (memorySet.expiresAt < Date.now()) {
    memorySet = null;
    return null;
  }
  return memorySet.value;
}

async function cacheSetIds(ids: string[]): Promise<void> {
  if (isTestEnv()) return;

  if (redis) {
    try {
      await redis.set(KEV_CACHE_KEY, ids, { ex: TTL_SECONDS });
      return;
    } catch (err) {
      logger.warn('KEV cache Redis set failed; falling through', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  memorySet = { value: ids, expiresAt: Date.now() + TTL_SECONDS * 1000 };
}

interface KevEntry {
  cveID: string;
}

interface KevFeed {
  vulnerabilities?: KevEntry[];
}

async function fetchKevFeed(): Promise<string[]> {
  try {
    const res = await fetch(KEV_FEED_URL, {
      signal: AbortSignal.timeout(KEV_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn('KEV feed non-OK', { status: res.status });
      return [];
    }
    const feed = (await res.json()) as KevFeed;
    const ids = (feed.vulnerabilities ?? [])
      .map((v) => v.cveID)
      .filter((id): id is string => Boolean(id));
    return ids;
  } catch (err) {
    logger.warn('KEV feed fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Load (and cache) the KEV CVE-ID set. The fetched array is converted to
 * a Set on every call — cheap, ~1500 entries — so callers get O(1) lookup
 * without us having to serialize a Set into Redis.
 */
export async function loadKevSet(): Promise<Set<string>> {
  const cached = await cacheGetIds();
  if (cached !== null) return new Set(cached);

  const ids = await fetchKevFeed();
  if (ids.length > 0) {
    await cacheSetIds(ids);
  }
  return new Set(ids);
}

/**
 * Convenience helper. Loads the set on first call and asks if `cveId`
 * is in it. CVE IDs are case-normalized (KEV publishes uppercase).
 */
export async function isKev(cveId: string): Promise<boolean> {
  const set = await loadKevSet();
  return set.has(cveId.toUpperCase());
}
