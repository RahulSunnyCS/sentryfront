/**
 * OSV.dev client.
 *
 * Two-step flow:
 *   1. POST /v1/querybatch — returns vuln IDs for each (ecosystem, name, version).
 *   2. GET /v1/vulns/{id} — hydrates each ID into a full record (summary,
 *      severity, references, aliases). Cached so we hydrate each ID at most
 *      once per 24h.
 *
 * Network failures degrade silently: an unreachable OSV returns no
 * vulnerabilities rather than aborting the scan.
 */
import { cacheGet, cacheSet, tripleKey, vulnKey } from './osv-cache';
import { logger } from '@/lib/logger';

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN_URL = 'https://api.osv.dev/v1/vulns';
const BATCH_TIMEOUT_MS = 10_000;
const VULN_TIMEOUT_MS = 8_000;

export interface OsvQuery {
  ecosystem: string;
  name: string;
  version: string;
}

export interface OsvSeverity {
  type: string;       // 'CVSS_V3' | 'CVSS_V2' | ...
  score: string;      // CVSS vector string
}

export interface OsvAffectedRange {
  type: string;
  events: Array<{ introduced?: string; fixed?: string }>;
}

export interface OsvAffected {
  package?: { ecosystem: string; name: string };
  ranges?: OsvAffectedRange[];
}

export interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: OsvSeverity[];
  references?: Array<{ type: string; url: string }>;
  affected?: OsvAffected[];
}

interface BatchResponse {
  results?: Array<{ vulns?: Array<{ id: string }> }>;
}

/**
 * Look up vuln IDs for each query. Returns a parallel array — entry i
 * contains the IDs for queries[i], or [] if none / lookup failed.
 */
export async function queryBatch(queries: OsvQuery[]): Promise<string[][]> {
  if (queries.length === 0) return [];

  // Check cache first; collect uncached indices for a single batch call.
  const results: string[][] = new Array(queries.length).fill(null);
  const uncached: Array<{ index: number; query: OsvQuery }> = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const cached = await cacheGet<string[]>(tripleKey(q.ecosystem, q.name, q.version));
    if (cached !== null) {
      results[i] = cached;
    } else {
      uncached.push({ index: i, query: q });
    }
  }

  if (uncached.length === 0) return results;

  let batchResponse: BatchResponse | null = null;
  try {
    const res = await fetch(OSV_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: uncached.map(({ query }) => ({
          package: { ecosystem: query.ecosystem, name: query.name },
          version: query.version,
        })),
      }),
      signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
    });
    if (res.ok) {
      batchResponse = (await res.json()) as BatchResponse;
    } else {
      logger.warn('OSV querybatch returned non-OK', { status: res.status });
    }
  } catch (err) {
    logger.warn('OSV querybatch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  for (let j = 0; j < uncached.length; j++) {
    const { index, query } = uncached[j];
    const ids = batchResponse?.results?.[j]?.vulns?.map((v) => v.id) ?? [];
    results[index] = ids;
    await cacheSet(tripleKey(query.ecosystem, query.name, query.version), ids);
  }

  return results;
}

/**
 * Hydrate a vuln ID into a full record. Returns null on any failure
 * (network, 404, malformed) — callers treat that as "skip this ID".
 */
export async function getVuln(id: string): Promise<OsvVuln | null> {
  const cached = await cacheGet<OsvVuln>(vulnKey(id));
  if (cached !== null) return cached;

  try {
    const res = await fetch(`${OSV_VULN_URL}/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(VULN_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn('OSV vuln fetch non-OK', { id, status: res.status });
      return null;
    }
    const vuln = (await res.json()) as OsvVuln;
    await cacheSet(vulnKey(id), vuln);
    return vuln;
  } catch (err) {
    logger.warn('OSV vuln fetch failed', {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse the CVSS-v3 base score out of an OSV severity entry. OSV uses the
 * CVSS vector string (e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"),
 * not the numeric score, so we either match an explicit /score= suffix or
 * compute it from the vector. For simplicity we look for the base-score
 * shorthand many CVE feeds include; falls back to null on miss.
 */
export function extractCvssBaseScore(severity: OsvSeverity[] | undefined): number | null {
  if (!severity || severity.length === 0) return null;
  // Prefer CVSS v3, then v2.
  const order = ['CVSS_V3', 'CVSS_V31', 'CVSS_V40', 'CVSS_V2'];
  const sorted = [...severity].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type),
  );
  for (const s of sorted) {
    // Some feeds embed a trailing /baseScore=X.Y; some don't. Try both.
    const explicit = s.score.match(/baseScore[:=]\s*(\d+(?:\.\d+)?)/i);
    if (explicit) return parseFloat(explicit[1]);
    // If the score field is just a plain number, take it.
    const plain = s.score.match(/^(\d+(?:\.\d+)?)$/);
    if (plain) return parseFloat(plain[1]);
  }
  return null;
}
