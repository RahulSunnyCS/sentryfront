/**
 * Phase 3.7.1 — runtime feature-flag overrides.
 *
 * env-driven defaults live in src/lib/features.ts. This helper layers DB rows
 * from the FeatureFlag table on top so an admin can flip a flag at runtime
 * without a deploy. Reads go through a short-lived in-process cache; writes
 * call invalidateFeatureFlag(key) to drop the stale entry.
 *
 * Returns { enabled, value } where value is the parsed JSON payload (or null).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const TTL_MS = 30_000;

interface CacheEntry<T> {
  enabled: boolean;
  value: T | null;
  loadedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export interface FeatureFlagResult<T = unknown> {
  enabled: boolean;
  value: T | null;
}

export interface EnvDefault<T = unknown> {
  enabled: boolean;
  value?: T;
}

export async function getFeatureFlag<T = unknown>(
  key: string,
  envDefault?: EnvDefault<T>,
): Promise<FeatureFlagResult<T>> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && now - cached.loadedAt < TTL_MS) {
    return { enabled: cached.enabled, value: cached.value };
  }

  let row: { enabled: boolean; value: string | null } | null = null;
  try {
    row = await prisma.featureFlag.findUnique({
      where: { key },
      select: { enabled: true, value: true },
    });
  } catch (err) {
    logger.warn('feature-flags: DB read failed; falling back to env default', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  let result: FeatureFlagResult<T>;
  if (row) {
    let parsed: T | null = null;
    if (row.value != null) {
      try {
        parsed = JSON.parse(row.value) as T;
      } catch {
        logger.warn('feature-flags: stored value is not valid JSON', { key });
      }
    }
    result = { enabled: row.enabled, value: parsed };
  } else {
    result = {
      enabled: envDefault?.enabled ?? false,
      value: envDefault?.value ?? null,
    };
  }

  cache.set(key, { enabled: result.enabled, value: result.value, loadedAt: now });
  return result;
}

export function invalidateFeatureFlag(key?: string): void {
  if (key === undefined) {
    cache.clear();
    return;
  }
  cache.delete(key);
}

// Test-only: clears cache between unit tests so TTL doesn't bleed across cases.
export function _resetFeatureFlagCacheForTests(): void {
  cache.clear();
}
