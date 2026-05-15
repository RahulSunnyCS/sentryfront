/**
 * Phase 3.13 — optional Mozilla/MDN HTTP Observatory grade.
 *
 * A *corroborating, informational* signal only. Mirrors the Phase 3.11 W3C Nu
 * client (`seo-fetch.ts`): Upstash → memory 24h cache (bypassed under vitest
 * via osv-cache), 8s timeout, fail-soft. Any network error, timeout, non-2xx,
 * or unexpected body yields `null` — the scan never fails because a free
 * third-party service is rate-limiting or down, and Observatory never gates a
 * non-INFO finding.
 */

import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from './osv-cache';

const TIMEOUT_MS = 8_000;
const USER_AGENT = 'VibeSafe-Scanner/1.0 (security audit; contact@vibesafe.io)';
// Mozilla moved Observatory to MDN; the legacy http-observatory host is gone.
const OBSERVATORY_ENDPOINT = 'https://observatory-api.mdn.mozilla.net/api/v2/scan';
const HOST_RE = /^[a-z0-9.-]+$/i;

export interface ObservatoryGrade {
  grade: string;
  score: number;
}

/**
 * Returns the Observatory letter grade + score for a public host, or null
 * when unavailable. Never throws.
 */
export async function getObservatoryGrade(host: string): Promise<ObservatoryGrade | null> {
  if (!host || !HOST_RE.test(host)) return null;
  const key = `obs:v1:${host.toLowerCase()}`;

  const cached = await cacheGet<ObservatoryGrade>(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${OBSERVATORY_ENDPOINT}?host=${encodeURIComponent(host)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      grade?: string;
      score?: number;
      scan?: { grade?: string; score?: number };
    };
    const grade = json?.scan?.grade ?? json?.grade;
    const score = json?.scan?.score ?? json?.score;
    if (typeof grade !== 'string' || typeof score !== 'number') return null;

    const result: ObservatoryGrade = { grade, score };
    await cacheSet(key, result);
    return result;
  } catch (err) {
    logger.warn('Observatory unavailable; dropping header-grade source', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
