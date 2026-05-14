/**
 * FIRST.org EPSS (Exploit Prediction Scoring System) client.
 *
 * EPSS produces, for each CVE, an estimated exploit-probability score
 * and a percentile (0-1) within the global CVE population. We look up
 * per-CVE on demand and cache for 24h. The percentile drives the
 * severity rubric:
 *   - "EPSS unknown" (null) → conservative fallback, preserves CVSS bucket
 *   - "EPSS low" (positive evidence) → downgrade
 *   - "EPSS high" → keep or escalate
 *
 * Feed failures degrade silently: returns null. The rubric treats null
 * identically to "no EPSS data exists for this CVE", which under the
 * conservative-fallback policy preserves the CVSS-only severity.
 *
 * Cache pattern is duplicated from osv-cache.ts per the locked plan
 * decision — avoids refactoring the just-shipped Phase 3.2 caching code.
 */
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const EPSS_API_URL = 'https://api.first.org/data/v1/epss';
const EPSS_FETCH_TIMEOUT_MS = 8_000;
const TTL_SECONDS = 24 * 60 * 60;

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = url && token ? new Redis({ url, token }) : null;

export interface EpssRecord {
  score: number;        // raw exploit-probability score, 0-1
  percentile: number;   // percentile of `score` within the CVE population, 0-100
}

interface MemoryEntry {
  value: EpssRecord | null;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();

function isTestEnv(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

function cacheKey(cveId: string): string {
  return `epss:v1:${cveId.toUpperCase()}`;
}

async function cacheGet(cveId: string): Promise<EpssRecord | null | undefined> {
  if (isTestEnv()) return undefined;

  const key = cacheKey(cveId);
  if (redis) {
    try {
      const raw = await redis.get<EpssRecord | null>(key);
      // Note: Upstash returns null for missing keys, but we also store
      // null as a "looked up, no data" marker. Distinguish via JS undefined.
      if (raw !== null && raw !== undefined) return raw;
      // Hit a stored null marker — Upstash doesn't preserve that
      // distinction, so we re-fetch. Worst case: another network hop.
    } catch (err) {
      logger.warn('EPSS cache Redis get failed; falling through', {
        cveId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.value;
}

async function cacheSet(cveId: string, value: EpssRecord | null): Promise<void> {
  if (isTestEnv()) return;

  const key = cacheKey(cveId);
  if (redis && value !== null) {
    try {
      await redis.set(key, value, { ex: TTL_SECONDS });
      return;
    } catch (err) {
      logger.warn('EPSS cache Redis set failed; falling through', {
        cveId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  memoryCache.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

interface EpssApiRow {
  cve: string;
  epss: string;
  percentile: string;
}

interface EpssApiResponse {
  status?: string;
  data?: EpssApiRow[];
}

/**
 * Look up the EPSS score + percentile for a single CVE. Returns null on
 * 404 (no EPSS data for this CVE), timeout, non-OK response, or parse
 * failure — under the conservative-fallback rubric, all of these are
 * treated identically to "data unknown" and preserve the CVSS bucket.
 */
export async function getEpss(cveId: string): Promise<EpssRecord | null> {
  const cached = await cacheGet(cveId);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${EPSS_API_URL}?cve=${encodeURIComponent(cveId)}`, {
      signal: AbortSignal.timeout(EPSS_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn('EPSS API non-OK', { cveId, status: res.status });
      await cacheSet(cveId, null);
      return null;
    }
    const body = (await res.json()) as EpssApiResponse;
    const row = body.data?.[0];
    if (!row) {
      await cacheSet(cveId, null);
      return null;
    }
    const score = parseFloat(row.epss);
    const percentileRaw = parseFloat(row.percentile);
    if (!Number.isFinite(score) || !Number.isFinite(percentileRaw)) {
      await cacheSet(cveId, null);
      return null;
    }
    const record: EpssRecord = {
      score,
      // FIRST.org returns percentile as 0-1; normalize to 0-100 so
      // rubric thresholds read naturally (">=50", ">=90").
      percentile: percentileRaw * 100,
    };
    await cacheSet(cveId, record);
    return record;
  } catch (err) {
    logger.warn('EPSS API fetch failed', {
      cveId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
