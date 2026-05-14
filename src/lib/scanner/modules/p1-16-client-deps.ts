/**
 * P1-16: Client-side dependency vulnerabilities.
 *
 * Phase 3.2. Detects vulnerable JS libraries (jQuery, lodash, Bootstrap,
 * etc.) shipped in the target site's bundles. Fingerprints chunks via
 * retire.js signatures and looks up CVEs via OSV.dev.
 *
 * Severity is derived from CVSS as a stopgap. Phase 3.3 will swap
 * assignSeverity() to use KEV + EPSS without touching the rest of this
 * module.
 */
import type { CrawlResult, RawFinding, Severity } from '../types';
import { detectAcrossChunks, type Chunk, type DetectedComponent } from '../tools/retire';
import { queryBatch, getVuln, extractCvssBaseScore, type OsvVuln } from '../tools/osv';
import { resolveSeverity } from '../tools/severity-rubric';
import { features } from '@/lib/features';
import { logger } from '@/lib/logger';

const FALLBACK_FETCH_TIMEOUT_MS = 10_000;
const MAX_FALLBACK_BUNDLES = 10;
const MAX_TOTAL_CHUNKS = 30;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_HYDRATED_VULNS = 50;

interface VulnerableComponent {
  component: DetectedComponent;
  vulns: OsvVuln[];
  cves: string[];
  cvssScores: number[];
  severity: Severity;
  kevMatch?: boolean;
  epssPercentile?: number | null;
}

/**
 * Kill-switch fallback used when the `exploitIntelSeverity` feature flag
 * is off. Mirrors the Phase 3.2 stub: max CVSS across a library's vulns
 * mapped to a coarse severity bucket. Phase 3.3 prefers `resolveSeverity`
 * which adds KEV+EPSS signal on top.
 */
export function assignSeverity(scores: number[]): Severity {
  if (scores.length === 0) return 'LOW';
  const max = Math.max(...scores);
  if (max >= 9.0) return 'CRITICAL';
  if (max >= 7.0) return 'HIGH';
  if (max >= 4.0) return 'MEDIUM';
  return 'LOW';
}

async function fetchBundleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FALLBACK_FETCH_TIMEOUT_MS) });
    if (!res.ok) return '';
    return res.text();
  } catch {
    return '';
  }
}

/**
 * Build the chunk list to scan. Prefers the browser-loaded chunks captured
 * by Phase 3.1; falls back to refetching top-N jsBundleUrls when the crawl
 * ran in fetch-only mode (no Playwright).
 */
async function collectChunks(crawl: CrawlResult): Promise<Chunk[]> {
  const out: Chunk[] = [];

  if (crawl.loadedChunkContents) {
    for (const [url, content] of Object.entries(crawl.loadedChunkContents)) {
      if (!content || content.length > MAX_CHUNK_BYTES) continue;
      out.push({ url, content });
      if (out.length >= MAX_TOTAL_CHUNKS) break;
    }
    return out;
  }

  // Fetch-only fallback: refetch a bounded set of script URLs.
  const targetUrls = crawl.jsBundleUrls.slice(0, MAX_FALLBACK_BUNDLES);
  const fetched = await Promise.all(
    targetUrls.map(async (url) => ({ url, content: await fetchBundleContent(url) })),
  );
  for (const c of fetched) {
    if (c.content && c.content.length <= MAX_CHUNK_BYTES) out.push(c);
  }
  return out;
}

function buildImpactSummary(vulns: OsvVuln[]): string {
  const summaries = vulns
    .map((v) => v.summary)
    .filter((s): s is string => Boolean(s))
    .slice(0, 3);
  if (summaries.length === 0) {
    return 'Attackers can exploit known vulnerabilities in this library version against any visitor of your site.';
  }
  return summaries.join(' ');
}

function buildEvidence(vc: VulnerableComponent): string {
  const { component, cves } = vc;
  const ids = cves.slice(0, 5).join(', ');
  const overflow = cves.length > 5 ? `, +${cves.length - 5} more` : '';
  return `Library: ${component.npmName}@${component.version} in ${component.chunkUrl}\nCVEs: ${ids}${overflow}`;
}

function buildFinding(vc: VulnerableComponent): RawFinding {
  const { component, cves, severity, kevMatch, epssPercentile } = vc;
  const count = cves.length;
  const plural = count === 1 ? 'y' : 'ies';
  const finding: RawFinding = {
    moduleId: 'P1-16',
    severity,
    category: 'Vulnerable Client-Side Dependency',
    title: `${component.npmName} ${component.version} has ${count} known vulnerabilit${plural}`,
    location: component.chunkUrl,
    evidence: buildEvidence(vc),
    explanation: buildImpactSummary(vc.vulns),
    impact: 'A visitor opening this page receives the vulnerable library. Any exploit that works against this version works against your users — there is no server-side mitigation possible.',
    fixManual: [
      `Upgrade ${component.npmName} to the latest patched version listed at https://osv.dev/list?q=${encodeURIComponent(component.npmName)}.`,
      'Rebuild and redeploy the bundle so the patched library is what visitors actually receive.',
      'If the library is bundled by a framework you do not directly upgrade (e.g. an old Bootstrap pinned by a theme), upgrade the framework itself or replace the theme.',
      `Verify by running this scan again — the ${component.npmName} finding should disappear once the patched version is in the bundle.`,
    ],
    fixAiPrompt: `My production bundle ships ${component.npmName} ${component.version}, which has known vulnerabilities (${cves.slice(0, 5).join(', ')}). Upgrade to the latest patched version in package.json, run the build, and confirm the new version no longer matches the vulnerable signatures.`,
  };
  if (kevMatch !== undefined) finding.kevMatch = kevMatch;
  if (epssPercentile !== undefined) finding.epssPercentile = epssPercentile;
  return finding;
}

export async function runClientDepsModule(crawl: CrawlResult): Promise<RawFinding[]> {
  try {
    const chunks = await collectChunks(crawl);
    if (chunks.length === 0) return [];

    const components = detectAcrossChunks(chunks);
    if (components.length === 0) return [];

    // OSV batch lookup — one call for every (lib, version) tuple.
    const queries = components.map((c) => ({
      ecosystem: 'npm',
      name: c.npmName,
      version: c.version,
    }));
    const vulnIdLists = await queryBatch(queries);

    // Hydrate IDs across all components in parallel, capped at MAX_HYDRATED_VULNS.
    const uniqueIds = Array.from(new Set(vulnIdLists.flat())).slice(0, MAX_HYDRATED_VULNS);
    const hydratedEntries = await Promise.all(
      uniqueIds.map(async (id) => [id, await getVuln(id)] as const),
    );
    const hydrated = new Map<string, OsvVuln>();
    for (const [id, vuln] of hydratedEntries) {
      if (vuln) hydrated.set(id, vuln);
    }

    const findings: RawFinding[] = [];
    for (let i = 0; i < components.length; i++) {
      const ids = vulnIdLists[i] ?? [];
      if (ids.length === 0) continue;

      const vulns: OsvVuln[] = [];
      const cves: string[] = [];
      const cvssScores: number[] = [];
      for (const id of ids) {
        const v = hydrated.get(id);
        if (!v) continue;
        vulns.push(v);
        // Prefer CVE alias when present; fall back to the OSV ID.
        const cveAlias = (v.aliases ?? []).find((a) => a.startsWith('CVE-'));
        cves.push(cveAlias ?? v.id);
        const score = extractCvssBaseScore(v.severity);
        if (score !== null) cvssScores.push(score);
      }

      if (vulns.length === 0) continue;

      let severity: Severity;
      let kevMatch: boolean | undefined;
      let epssPercentile: number | null | undefined;
      if (features.exploitIntelSeverity) {
        const resolved = await resolveSeverity({ cveIds: cves, cvssScores });
        severity = resolved.severity;
        kevMatch = resolved.kevMatch;
        epssPercentile = resolved.epssPercentile;
      } else {
        severity = assignSeverity(cvssScores);
      }

      findings.push(
        buildFinding({
          component: components[i],
          vulns,
          cves,
          cvssScores,
          severity,
          kevMatch,
          epssPercentile,
        }),
      );
    }
    return findings;
  } catch (err) {
    // Per the module-failure-isolation pattern in scanner/index.ts —
    // never let one module's failure abort the scan.
    logger.warn('P1-16 client-deps module failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
