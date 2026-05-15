/**
 * Phase 3.11 — shared, SSRF-safe fetch helpers for the SEO depth pass.
 *
 * Every call goes through `global.fetch` so the fixture harness can stub
 * responses via `<case>.fetch.json`. All helpers are fail-soft: a network
 * error, timeout, non-2xx, or blocked target yields a null/empty result, never
 * a throw — a missing supporting file is a normal SEO finding, not a crash.
 *
 * The W3C Nu HTML checker is an optional external corroboration source. If it
 * is unreachable, rate-limited, or returns anything unexpected we drop the
 * signal silently (return null) and the corroborator downgrades confidence
 * accordingly — the scan never fails because a free third-party service is
 * having a bad day.
 */

import crypto from 'node:crypto';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from './osv-cache';

const TIMEOUT_MS = 8_000;
const USER_AGENT = 'VibeSafe-Scanner/1.0 (security audit; contact@vibesafe.io)';
const W3C_NU_ENDPOINT = 'https://validator.w3.org/nu/?out=json';

const PRIVATE_IP_LITERAL = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd/i,
];

/**
 * Synchronous, best-effort SSRF guard for supporting-resource fetches
 * (canonical targets, og:image). No DNS — the scanned origin is already
 * validated by url-validator before the crawl starts; this blocks the obvious
 * literal-IP / localhost cases without a network round-trip so it stays
 * deterministic under fixture tests.
 */
export function isSafeFetchTarget(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '169.254.169.254') {
    return false;
  }
  if (PRIVATE_IP_LITERAL.some((re) => re.test(host))) return false;
  return true;
}

/** GET a URL, return the body text, or null on any failure / non-2xx. */
export async function fetchTextSafe(url: string): Promise<string | null> {
  if (!isSafeFetchTarget(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface ImageProbe {
  reachable: boolean;
  status: number | null;
  contentType: string | null;
}

/**
 * Reachability probe for og:image. HEAD first; many CDNs reject HEAD with 405,
 * so fall back to a 1-byte ranged GET. `reachable` is true only on a 2xx/206
 * whose content-type starts with `image/`.
 */
export async function probeImage(url: string): Promise<ImageProbe> {
  const miss: ImageProbe = { reachable: false, status: null, contentType: null };
  if (!isSafeFetchTarget(url)) return miss;

  const evaluate = (res: Response): ImageProbe => {
    const ct = res.headers.get('content-type');
    const ok = (res.status >= 200 && res.status < 300) || res.status === 206;
    return {
      reachable: ok && !!ct && ct.toLowerCase().startsWith('image/'),
      status: res.status,
      contentType: ct,
    };
  };

  try {
    const head = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (head.status !== 405 && head.status !== 501) return evaluate(head);
  } catch {
    /* fall through to ranged GET */
  }

  try {
    const ranged = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
    });
    return evaluate(ranged);
  } catch {
    return miss;
  }
}

export interface CanonicalChainResult {
  finalStatus: number | null;
  hops: number;
  loop: boolean;
  blocked: boolean;
}

/**
 * Follow the canonical URL with manual redirects so we can detect loops and
 * a non-2xx terminus. Capped at `maxHops`.
 */
export async function resolveCanonicalChain(
  startUrl: string,
  maxHops = 5,
): Promise<CanonicalChainResult> {
  if (!isSafeFetchTarget(startUrl)) {
    return { finalStatus: null, hops: 0, loop: false, blocked: true };
  }
  const seen = new Set<string>();
  let current = startUrl;

  for (let hop = 0; hop < maxHops; hop++) {
    if (seen.has(current)) {
      return { finalStatus: null, hops: hop, loop: true, blocked: false };
    }
    seen.add(current);

    let res: Response;
    try {
      res = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT },
      });
    } catch {
      return { finalStatus: null, hops: hop + 1, loop: false, blocked: false };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        return { finalStatus: res.status, hops: hop + 1, loop: false, blocked: false };
      }
      let next: string;
      try {
        next = new URL(loc, current).href;
      } catch {
        return { finalStatus: res.status, hops: hop + 1, loop: false, blocked: false };
      }
      if (!isSafeFetchTarget(next)) {
        return { finalStatus: null, hops: hop + 1, loop: false, blocked: true };
      }
      current = next;
      continue;
    }

    return { finalStatus: res.status, hops: hop + 1, loop: false, blocked: false };
  }

  return { finalStatus: null, hops: maxHops, loop: true, blocked: false };
}

/**
 * Opportunistic HTML-validity signal from the free W3C Nu checker. Cached
 * (Upstash → memory, 24h) keyed by content hash; bypassed under vitest. Returns
 * null when the service is unavailable so the corroborator simply drops the
 * source instead of the scan failing.
 */
export async function w3cNuHasErrors(html: string): Promise<boolean | null> {
  if (!html.trim()) return null;
  const key = `w3cnu:v1:${crypto.createHash('sha256').update(html).digest('hex')}`;

  const cached = await cacheGet<{ hasErrors: boolean }>(key);
  if (cached) return cached.hasErrors;

  try {
    const res = await fetch(W3C_NU_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'User-Agent': USER_AGENT,
      },
      body: html,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { messages?: Array<{ type?: string }> };
    if (!Array.isArray(json.messages)) return null;
    const hasErrors = json.messages.some((m) => m?.type === 'error');
    await cacheSet(key, { hasErrors });
    return hasErrors;
  } catch (err) {
    logger.warn('W3C Nu validator unavailable; dropping HTML-validity source', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
