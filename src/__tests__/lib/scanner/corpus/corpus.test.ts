/**
 * Phase 3.6 — Scan-quality corpus integration test.
 *
 * Replay mode (default, runs in CI): loads recorded fetch + crawl fixtures
 * per site under src/__tests__/fixtures/corpus/<slug>/, runs runScanner
 * against the canned responses, and asserts the resulting grade / score /
 * findings haven't drifted from the locked baseline.
 *
 * Record mode (developer-only, requires network): makes real HTTPS calls to
 * each site, captures the CrawlResult + fetch exchanges + baseline, and
 * writes them to disk. Driven by `yarn corpus record --site <slug>`.
 *
 * Sites without a recording on disk are skipped, not failed — this keeps CI
 * green while the corpus is being filled in. See docs/core/CORPUS_GUIDE.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetch as realFetch } from 'undici';
import type { CrawlResult } from '@/lib/scanner/types';
import { installFetchMock, type FetchResponseSpec } from '../fixtures/runner';
import {
  CORPUS_ROOT,
  buildBaseline,
  discoverCorpusSlugs,
  loadFixture,
  responsesToFetchSpec,
  saveFixture,
  type CorpusBaseline,
} from './load-fixtures';

const corpusState = vi.hoisted(() => ({
  injectCrawl: null as CrawlResult | null,
  recordedCrawl: null as CrawlResult | null,
  passThroughCrawl: false,
}));

vi.mock('@/lib/features', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/features')>('@/lib/features');
  return {
    ...actual,
    features: {
      ...actual.features,
      // Force the deterministic static-fetch crawl path and disable the
      // Lighthouse-driven scans whose output isn't captured in fetch fixtures.
      headlessCrawl: false,
      performanceScanning: false,
      accessibilityScanning: false,
      seoScanning: false,
      llmEnrichment: false,
    },
  };
});

vi.mock('@/lib/scanner/crawler', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/scanner/crawler')>(
      '@/lib/scanner/crawler',
    );
  return {
    ...actual,
    crawl: async (url: string): Promise<CrawlResult> => {
      if (corpusState.injectCrawl) return corpusState.injectCrawl;
      if (corpusState.passThroughCrawl) {
        const real = await actual.crawl(url);
        // Strip TLS info — its `daysUntilExpiry` shifts on every cert
        // renewal and would make the baseline flaky. P1-04 coverage of
        // cert health lives in unit tests.
        corpusState.recordedCrawl = { ...real, tls: null };
        return corpusState.recordedCrawl;
      }
      throw new Error('corpus: crawl mock not configured for ' + url);
    },
  };
});

const CORPUS_MODE: 'replay' | 'record' =
  process.env.CORPUS_MODE === 'record' ? 'record' : 'replay';
const REQUESTED_SITES = new Set(
  (process.env.CORPUS_SITES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const RECORD_ALL = REQUESTED_SITES.has('all') || REQUESTED_SITES.has('*');

const allSlugs = discoverCorpusSlugs();

async function runScannerWithDisabledExtras(url: string) {
  // runScanner reads features at call time (no re-import needed), so the
  // hoisted vi.mock above is sufficient to gate Lighthouse / headless paths.
  const { runScanner } = await import('@/lib/scanner');
  return runScanner(url);
}

function diffFindingsSets(
  actual: CorpusBaseline['findings'],
  expected: CorpusBaseline['findings'],
): { missing: CorpusBaseline['findings']; unexpected: CorpusBaseline['findings'] } {
  const key = (f: { moduleId: string; severity: string; title: string }) =>
    `${f.moduleId}\t${f.severity}\t${f.title}`;
  const actualKeys = new Set(actual.map(key));
  const expectedKeys = new Set(expected.map(key));
  return {
    missing: expected.filter((f) => !actualKeys.has(key(f))),
    unexpected: actual.filter((f) => !expectedKeys.has(key(f))),
  };
}

async function replaySlug(slug: string) {
  const fixture = loadFixture(slug);
  if (!fixture.hasRecording) {
    throw new Error(
      `corpus/${slug}: no recording — run \`yarn corpus record --site ${slug}\``,
    );
  }
  corpusState.injectCrawl = fixture.crawl!;
  corpusState.passThroughCrawl = false;
  const restore = installFetchMock(responsesToFetchSpec(fixture.responses!));
  let result;
  try {
    result = await runScannerWithDisabledExtras(fixture.meta.url);
  } finally {
    restore();
    corpusState.injectCrawl = null;
  }

  const actual = buildBaseline(result.findings, result.moduleFindingCounts);
  const expected = fixture.expected!;

  expect(actual.grade, `grade drift for ${slug}`).toBe(expected.grade);
  expect(
    Math.abs(actual.score - expected.score),
    `score drift for ${slug}: ${actual.score} vs ${expected.score}`,
  ).toBeLessThanOrEqual(1);
  expect(
    actual.findingsCount,
    `findingsCount drift for ${slug}`,
  ).toBe(expected.findingsCount);
  expect(
    actual.moduleFindingCounts,
    `moduleFindingCounts drift for ${slug}`,
  ).toEqual(expected.moduleFindingCounts);

  const { missing, unexpected } = diffFindingsSets(actual.findings, expected.findings);
  if (missing.length || unexpected.length) {
    const lines: string[] = [`findings drift for ${slug}:`];
    if (missing.length) {
      lines.push('  expected but missing:');
      for (const f of missing) lines.push(`    - ${f.moduleId} ${f.severity} ${f.title}`);
    }
    if (unexpected.length) {
      lines.push('  unexpected:');
      for (const f of unexpected) lines.push(`    + ${f.moduleId} ${f.severity} ${f.title}`);
    }
    throw new Error(lines.join('\n'));
  }
}

interface CapturedExchange {
  url: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bodyEncoding?: 'utf8' | 'base64';
}

function captureRecordingFetch(): {
  fetch: typeof fetch;
  exchanges: CapturedExchange[];
} {
  const exchanges: CapturedExchange[] = [];
  const wrappedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const res = await realFetch(url, init as Parameters<typeof realFetch>[1]);
    const buf = Buffer.from(await res.clone().arrayBuffer());
    // utf-8 by default; fall back to base64 if decoding produces replacement chars.
    const utf8 = buf.toString('utf8');
    const isText = !utf8.includes('�');
    const body = isText ? utf8 : buf.toString('base64');
    const bodyEncoding: 'utf8' | 'base64' = isText ? 'utf8' : 'base64';
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    exchanges.push({ url, method, status: res.status, headers, body, bodyEncoding });
    // Re-create a Response with the captured body so the caller gets a
    // readable stream (we already consumed res.clone()).
    const responseBody = isText ? body : Buffer.from(body, 'base64');
    return new Response(responseBody, { status: res.status, headers });
  }) as unknown as typeof fetch;
  return { fetch: wrappedFetch, exchanges };
}

function dedupeExchanges(exchanges: CapturedExchange[]): FetchResponseSpec[] {
  const byKey = new Map<string, CapturedExchange>();
  for (const ex of exchanges) {
    byKey.set(`${ex.method}\t${ex.url}`, ex);
  }
  return Array.from(byKey.values()).map((ex) => ({
    url: ex.url,
    status: ex.status,
    headers: ex.headers,
    // Binary bodies (base64) are stored empty — no scanner module needs to
    // inspect binary content, and FetchResponseSpec.body is a string. Headers
    // and status code are the parts modules actually read for non-text.
    body: ex.bodyEncoding === 'base64' ? '' : ex.body,
  }));
}

async function recordSlug(slug: string) {
  const fixture = loadFixture(slug);
  const originalFetch = global.fetch;
  const { fetch: wrappedFetch, exchanges } = captureRecordingFetch();
  global.fetch = wrappedFetch;
  corpusState.injectCrawl = null;
  corpusState.passThroughCrawl = true;
  corpusState.recordedCrawl = null;
  let result;
  try {
    result = await runScannerWithDisabledExtras(fixture.meta.url);
  } finally {
    global.fetch = originalFetch;
    corpusState.passThroughCrawl = false;
  }

  const crawl = corpusState.recordedCrawl;
  if (!crawl) throw new Error(`corpus record/${slug}: crawl was not captured`);

  const expected = buildBaseline(result.findings, result.moduleFindingCounts);
  const meta = {
    ...fixture.meta,
    recordedAt: new Date().toISOString(),
    gitSha: process.env.GIT_SHA ?? fixture.meta.gitSha,
  };
  saveFixture(slug, {
    meta,
    crawl,
    responses: dedupeExchanges(exchanges),
    expected,
  });
}

if (!fs.existsSync(CORPUS_ROOT)) {
  describe.skip('scanner corpus (no fixtures dir)', () => {
    it.skip('no corpus directory', () => undefined);
  });
} else {
  describe(`scanner corpus (${CORPUS_MODE})`, () => {
    beforeEach(() => {
      corpusState.injectCrawl = null;
      corpusState.passThroughCrawl = false;
      corpusState.recordedCrawl = null;
    });

    afterEach(() => {
      corpusState.injectCrawl = null;
      corpusState.passThroughCrawl = false;
      corpusState.recordedCrawl = null;
    });

    if (allSlugs.length === 0) {
      it.skip('no slugs registered under fixtures/corpus/', () => undefined);
      return;
    }

    for (const slug of allSlugs) {
      const slugDir = path.join(CORPUS_ROOT, slug);
      const hasRecording =
        fs.existsSync(path.join(slugDir, 'crawl.json')) &&
        fs.existsSync(path.join(slugDir, 'responses.json')) &&
        fs.existsSync(path.join(slugDir, 'expected.json'));

      if (CORPUS_MODE === 'replay') {
        if (!hasRecording) {
          // Pending recording — keep CI green; print a clear marker.
          it.skip(`${slug} (no recording yet — run \`yarn corpus record --site ${slug}\`)`, () => undefined);
          continue;
        }
        it(slug, async () => {
          await replaySlug(slug);
        }, 30_000);
      } else {
        const shouldRecord = RECORD_ALL || REQUESTED_SITES.has(slug);
        if (!shouldRecord) {
          it.skip(`${slug} (not requested — pass --site ${slug} or --all)`, () => undefined);
          continue;
        }
        it(`${slug} (recording)`, async () => {
          await recordSlug(slug);
        }, 120_000);
      }
    }
  });
}

