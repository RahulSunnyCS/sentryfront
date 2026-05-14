/**
 * Corpus fixture I/O — discover, load, and save the per-site recordings used
 * by the Phase 3.6 scan-quality corpus test.
 *
 * See docs/core/CORPUS_GUIDE.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CrawlResult, RawFinding } from '@/lib/scanner/types';
import type { FetchResponseSpec, FetchSpec } from '../fixtures/runner';

export const CORPUS_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'corpus',
);

// Modules whose findings depend on resources that aren't captured in fetch
// recordings (DNS, Lighthouse). Filtered out of the corpus baseline so the
// signal stays deterministic across record + replay.
export const EXCLUDED_MODULE_IDS = new Set([
  'P1-10', // DNS / email
  'P1-11', // subdomain takeover (DNS)
  'P2-Performance',
  'P3-Accessibility',
  'P4-SEO',
]);

export const SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 25,
  HIGH: 10,
  MEDIUM: 3,
  LOW: 1,
  INFO: 0,
};

export interface CorpusMeta {
  url: string;
  recordedAt?: string;
  gitSha?: string;
  notes?: string;
}

export interface CorpusBaselineFinding {
  moduleId: string;
  severity: string;
  title: string;
}

export interface CorpusBaseline {
  grade: string;
  score: number;
  findingsCount: number;
  moduleFindingCounts: Record<string, number>;
  findings: CorpusBaselineFinding[];
}

export interface CorpusFixture {
  slug: string;
  dir: string;
  meta: CorpusMeta;
  hasRecording: boolean;
  crawl?: CrawlResult;
  responses?: FetchResponseSpec[];
  expected?: CorpusBaseline;
}

export function computeCorpusGrade(score: number): string {
  if (score === 0) return 'A';
  if (score <= 5) return 'B';
  if (score <= 20) return 'C';
  if (score <= 50) return 'D';
  return 'F';
}

export function buildBaseline(
  findings: RawFinding[],
  moduleFindingCounts: Record<string, number>,
): CorpusBaseline {
  const filteredFindings = findings.filter((f) => !EXCLUDED_MODULE_IDS.has(f.moduleId));
  const filteredCounts: Record<string, number> = {};
  for (const [id, count] of Object.entries(moduleFindingCounts)) {
    if (!EXCLUDED_MODULE_IDS.has(id)) filteredCounts[id] = count;
  }
  const score = filteredFindings.reduce(
    (s, f) => s + (SEVERITY_SCORE[f.severity] ?? 0),
    0,
  );
  const baselineFindings: CorpusBaselineFinding[] = filteredFindings
    .map((f) => ({ moduleId: f.moduleId, severity: f.severity, title: f.title }))
    .sort((a, b) => {
      if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
      if (a.severity !== b.severity) return a.severity.localeCompare(b.severity);
      return a.title.localeCompare(b.title);
    });
  return {
    grade: computeCorpusGrade(score),
    score,
    findingsCount: filteredFindings.length,
    moduleFindingCounts: filteredCounts,
    findings: baselineFindings,
  };
}

export function discoverCorpusSlugs(root: string = CORPUS_ROOT): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((entry) => {
      const dir = path.join(root, entry);
      if (!fs.statSync(dir).isDirectory()) return false;
      return fs.existsSync(path.join(dir, 'meta.json'));
    })
    .sort();
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function coerceCrawlDates(crawl: CrawlResult): CrawlResult {
  if (crawl.tls && typeof crawl.tls.expiresAt === 'string') {
    crawl.tls.expiresAt = new Date(crawl.tls.expiresAt);
  }
  return crawl;
}

export function loadFixture(slug: string, root: string = CORPUS_ROOT): CorpusFixture {
  const dir = path.join(root, slug);
  const meta = readJson<CorpusMeta>(path.join(dir, 'meta.json'));
  const crawlPath = path.join(dir, 'crawl.json');
  const responsesPath = path.join(dir, 'responses.json');
  const expectedPath = path.join(dir, 'expected.json');
  const hasRecording =
    fs.existsSync(crawlPath) && fs.existsSync(responsesPath) && fs.existsSync(expectedPath);

  const fixture: CorpusFixture = { slug, dir, meta, hasRecording };
  if (hasRecording) {
    fixture.crawl = coerceCrawlDates(readJson<CrawlResult>(crawlPath));
    fixture.responses = readJson<FetchResponseSpec[]>(responsesPath);
    fixture.expected = readJson<CorpusBaseline>(expectedPath);
  }
  return fixture;
}

export function responsesToFetchSpec(responses: FetchResponseSpec[]): FetchSpec {
  return {
    responses,
    // Throw on unmocked URLs in replay so a missing recording surfaces as a
    // clear test failure rather than a silent zero-body response.
  };
}

export function saveFixture(
  slug: string,
  data: {
    meta: CorpusMeta;
    crawl: CrawlResult;
    responses: FetchResponseSpec[];
    expected: CorpusBaseline;
  },
  root: string = CORPUS_ROOT,
): void {
  const dir = path.join(root, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify(data.meta, null, 2) + '\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'crawl.json'),
    JSON.stringify(data.crawl, null, 2) + '\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'responses.json'),
    JSON.stringify(data.responses, null, 2) + '\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'expected.json'),
    JSON.stringify(data.expected, null, 2) + '\n',
    'utf8',
  );
}
