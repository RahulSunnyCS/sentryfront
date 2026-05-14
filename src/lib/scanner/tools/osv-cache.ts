/**
 * OSV.dev response cache.
 *
 * 24h TTL keyed on the (ecosystem, name, version) triple for batch lookups
 * and on the vuln-ID for full-record lookups. Uses Upstash Redis when the
 * UPSTASH_REDIS_REST_* env vars are configured (native TTL, cross-worker),
 * else falls back to an in-process Map (single-worker, lost on restart).
 *
 * Caching is bypassed entirely under vitest so fixture tests stay
 * deterministic — each test gets the canned fetch-mock response unfiltered.
 */
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const TTL_SECONDS = 24 * 60 * 60;

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = url && token ? new Redis({ url, token }) : null;

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry<unknown>>();

function isTestEnv(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (isTestEnv()) return null;

  if (redis) {
    try {
      const raw = await redis.get<T>(key);
      return raw ?? null;
    } catch (err) {
      logger.warn('OSV cache Redis get failed; falling through', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      // fall through to memory cache
    }
  }

  const entry = memoryCache.get(key) as MemoryEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  if (isTestEnv()) return;

  if (redis) {
    try {
      await redis.set(key, value, { ex: TTL_SECONDS });
      return;
    } catch (err) {
      logger.warn('OSV cache Redis set failed; falling through', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  memoryCache.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

export function tripleKey(ecosystem: string, name: string, version: string): string {
  return `osv:v1:triple:${ecosystem}:${name}:${version}`;
}

export function vulnKey(id: string): string {
  return `osv:v1:vuln:${id}`;
}
