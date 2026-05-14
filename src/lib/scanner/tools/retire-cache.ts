/**
 * retire.js signature DB loader + cache.
 *
 * The vendored snapshot at ./data/jsrepository.json is the fallback. The
 * primary source is `https://raw.githubusercontent.com/RetireJS/retire.js/
 * master/repository/jsrepository.json` (~900 KB) which we fetch on first
 * use and cache in-process for 24h.
 *
 * No Upstash here: the JSON is ~900 KB (borderline for Upstash's value
 * size limit) and worker cold-starts are cheap enough that re-fetching
 * from GitHub per worker once a day is fine. VITEST bypasses everything
 * and returns the vendored baseline so fixture tests stay deterministic
 * and offline.
 *
 * Failure model identical to kev.ts / epss.ts: fetch fails → log warn →
 * return the vendored baseline → scan continues with slightly stale
 * signatures. Production is never blocked on RetireJS's GitHub.
 */
import { logger } from '@/lib/logger';
import jsRepositoryBaseline from './data/jsrepository.json';

const RETIRE_REPO_URL =
  'https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/jsrepository.json';
const FETCH_TIMEOUT_MS = 15_000;
const TTL_MS = 24 * 60 * 60 * 1000;

interface SignatureExtractors {
  uri?: string[];
  filename?: string[];
  filecontent?: string[];
  filecontentreplace?: string[];
  hashes?: Record<string, string>;
  func?: string[];
  ast?: string[];
}

export interface SignatureEntry {
  npmname?: string;
  bowername?: string[];
  extractors?: SignatureExtractors;
  vulnerabilities?: unknown[];
}

export type JsRepository = Record<string, SignatureEntry>;

interface CacheEntry {
  value: JsRepository;
  expiresAt: number;
}

let cached: CacheEntry | null = null;

function isTestEnv(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

async function fetchFromGitHub(): Promise<JsRepository | null> {
  try {
    const res = await fetch(RETIRE_REPO_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn('retire.js signature fetch non-OK', { status: res.status });
      return null;
    }
    const body = (await res.json()) as JsRepository;
    if (!body || typeof body !== 'object') {
      logger.warn('retire.js signature fetch returned non-object');
      return null;
    }
    return body;
  } catch (err) {
    logger.warn('retire.js signature fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Returns the retire.js signature DB. Test env always returns the
 * vendored baseline. Production fetches from GitHub once per worker per
 * 24h, falling back to the baseline on failure.
 */
export async function loadJsRepository(): Promise<JsRepository> {
  if (isTestEnv()) return jsRepositoryBaseline as JsRepository;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const fetched = await fetchFromGitHub();
  if (fetched) {
    cached = { value: fetched, expiresAt: Date.now() + TTL_MS };
    return fetched;
  }

  // Fetch failed — cache the baseline for the same TTL so we don't hammer
  // GitHub on every scan during an outage. The baseline is stale but the
  // scan still emits findings.
  const fallback = jsRepositoryBaseline as JsRepository;
  cached = { value: fallback, expiresAt: Date.now() + TTL_MS };
  return fallback;
}

/**
 * Test-only escape hatch. Resets the in-process cache so a unit test can
 * exercise a fresh load. Not exported for production callers.
 */
export function __resetJsRepositoryCacheForTests(): void {
  cached = null;
}
