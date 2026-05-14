/**
 * Fixture-driven module test harness.
 *
 * Discovers per-module fixture cases under src/__tests__/fixtures/modules/<MODULE_ID>/
 * and runs each one against the registered module entry point.
 *
 * A fixture case named "<case>" may consist of any combination of:
 *   <case>.input.json     — partial CrawlResult, deep-merged over defaults
 *   <case>.input.html     — raw HTML, assigned to crawl.html
 *   <case>.input.headers  — RFC822-style "name: value" lines, assigned to crawl.headers
 *   <case>.fetch.json     — canned fetch responses for modules that probe URLs
 *   <case>.expected.json  — required; describes expected findings
 *
 * See docs/core/FIXTURE_GUIDE.md for the authoring guide.
 */
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import type { CrawlResult, RawFinding, Severity } from '@/lib/scanner/types';
import { runHeadersModule } from '@/lib/scanner/modules/p1-03-headers';
import { runTLSModule } from '@/lib/scanner/modules/p1-04-tls';
import { runCookiesModule } from '@/lib/scanner/modules/p1-05-cookies';
import { runMixedContentModule } from '@/lib/scanner/modules/p1-08-mixed-content';
import { runThirdPartyScriptsModule } from '@/lib/scanner/modules/p1-09-third-party-scripts';
import { runCacheModule } from '@/lib/scanner/modules/p1-15-cache';
import { runErrorDisclosureModule } from '@/lib/scanner/modules/p1-12-error-disclosure';
import { runRobotsSitemapModule } from '@/lib/scanner/modules/p1-14-robots-sitemap';
import { runClientDepsModule } from '@/lib/scanner/modules/p1-16-client-deps';

type ModuleRunner = (crawl: CrawlResult) => RawFinding[] | Promise<RawFinding[]>;

/**
 * Modules that operate purely on the CrawlResult (no network fetch).
 * Fetch-based modules need a fetch-mock layer — tracked as a follow-up.
 */
export const MODULE_REGISTRY: Record<string, ModuleRunner> = {
  'P1-03': runHeadersModule,
  'P1-04': runTLSModule,
  'P1-05': runCookiesModule,
  'P1-08': runMixedContentModule,
  'P1-09': runThirdPartyScriptsModule,
  'P1-12': runErrorDisclosureModule,
  'P1-14': runRobotsSitemapModule,
  'P1-15': runCacheModule,
  'P1-16': runClientDepsModule,
};

export interface ExpectedFinding {
  moduleId?: string;
  severity?: Severity;
  category?: string;
  titleIncludes?: string;
  evidenceIncludes?: string;
}

export interface ExpectedOutput {
  findings: ExpectedFinding[];
}

export interface FixtureCase {
  moduleId: string;
  name: string;
  inputs: { json?: string; html?: string; headers?: string; fetch?: string };
  expectedPath: string;
}

export interface FetchResponseSpec {
  url?: string;          // exact URL match
  urlMatches?: string;   // regex match against the full URL
  status?: number;       // default 200
  headers?: Record<string, string>;
  body?: string;         // default ''
}

export interface FetchSpec {
  responses?: FetchResponseSpec[];
  default?: FetchResponseSpec;
}

const FIXTURES_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'modules',
);

function defaultCrawl(): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: 'unknown',
  };
}

function parseHeadersFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx < 0) continue;
    const name = trimmed.slice(0, idx).trim().toLowerCase();
    const value = trimmed.slice(idx + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

function deepMerge<T>(base: T, overlay: Partial<T>): T {
  if (overlay === undefined || overlay === null) return base;
  if (Array.isArray(overlay)) return overlay as unknown as T;
  if (typeof overlay !== 'object') return overlay as T;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(overlay)) {
    const existing = result[k];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      v &&
      typeof v === 'object' &&
      !Array.isArray(v)
    ) {
      result[k] = deepMerge(existing, v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result as T;
}

export function buildCrawl(inputs: FixtureCase['inputs']): CrawlResult {
  let crawl = defaultCrawl();
  if (inputs.json) {
    const overlay = JSON.parse(inputs.json) as Partial<CrawlResult>;
    crawl = deepMerge(crawl, overlay);
  }
  if (inputs.headers) {
    crawl.headers = { ...crawl.headers, ...parseHeadersFile(inputs.headers) };
  }
  if (inputs.html) {
    crawl.html = inputs.html;
  }
  // JSON has no Date type — coerce known Date fields after merging.
  if (crawl.tls && typeof crawl.tls.expiresAt === 'string') {
    crawl.tls.expiresAt = new Date(crawl.tls.expiresAt);
  }
  return crawl;
}

export function discoverFixtures(root: string = FIXTURES_ROOT): FixtureCase[] {
  if (!fs.existsSync(root)) return [];
  const cases: FixtureCase[] = [];

  for (const moduleId of fs.readdirSync(root).sort()) {
    const moduleDir = path.join(root, moduleId);
    if (!fs.statSync(moduleDir).isDirectory()) continue;

    const files = fs.readdirSync(moduleDir);
    const caseNames = new Set<string>();
    for (const f of files) {
      const m = f.match(/^(.+?)\.(input|expected|fetch)\.(json|html|headers)$/);
      if (m) caseNames.add(m[1]);
    }

    for (const name of Array.from(caseNames).sort()) {
      const expectedPath = path.join(moduleDir, `${name}.expected.json`);
      if (!fs.existsSync(expectedPath)) continue;
      const inputs: FixtureCase['inputs'] = {};
      const jsonPath = path.join(moduleDir, `${name}.input.json`);
      const htmlPath = path.join(moduleDir, `${name}.input.html`);
      const headersPath = path.join(moduleDir, `${name}.input.headers`);
      const fetchPath = path.join(moduleDir, `${name}.fetch.json`);
      if (fs.existsSync(jsonPath)) inputs.json = fs.readFileSync(jsonPath, 'utf8');
      if (fs.existsSync(htmlPath)) inputs.html = fs.readFileSync(htmlPath, 'utf8');
      if (fs.existsSync(headersPath)) inputs.headers = fs.readFileSync(headersPath, 'utf8');
      if (fs.existsSync(fetchPath)) inputs.fetch = fs.readFileSync(fetchPath, 'utf8');

      cases.push({ moduleId, name, inputs, expectedPath });
    }
  }
  return cases;
}

export function matchFinding(expected: ExpectedFinding, actual: RawFinding): boolean {
  if (expected.moduleId && expected.moduleId !== actual.moduleId) return false;
  if (expected.severity && expected.severity !== actual.severity) return false;
  if (expected.category && expected.category !== actual.category) return false;
  if (expected.titleIncludes && !actual.title.includes(expected.titleIncludes)) return false;
  if (expected.evidenceIncludes && !actual.evidence.includes(expected.evidenceIncludes)) return false;
  return true;
}

function buildResponse(spec: FetchResponseSpec): Response {
  return new Response(spec.body ?? '', {
    status: spec.status ?? 200,
    headers: spec.headers ?? {},
  });
}

function matchResponseSpec(url: string, spec: FetchResponseSpec): boolean {
  if (spec.url && spec.url === url) return true;
  if (spec.urlMatches && new RegExp(spec.urlMatches).test(url)) return true;
  return false;
}

/**
 * Installs a mock for global.fetch that returns canned responses per the spec.
 * Returns a restore function that should be called in a finally block.
 *
 * Match order: explicit responses (in array order) → default → throw. A throw
 * is intentional so a missing canned response shows up as a clear test failure
 * rather than a hang or a generic network error.
 */
export function installFetchMock(spec: FetchSpec): () => void {
  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const r of spec.responses ?? []) {
      if (matchResponseSpec(url, r)) return buildResponse(r);
    }
    if (spec.default) return buildResponse(spec.default);
    throw new Error(`fixture fetch-mock: no canned response for ${url}`);
  }) as typeof fetch;
  return () => {
    global.fetch = originalFetch;
  };
}

export function diffFindings(
  expected: ExpectedFinding[],
  actual: RawFinding[],
): { missing: ExpectedFinding[]; unexpected: RawFinding[] } {
  const usedActual = new Set<number>();
  const missing: ExpectedFinding[] = [];

  for (const exp of expected) {
    const idx = actual.findIndex((a, i) => !usedActual.has(i) && matchFinding(exp, a));
    if (idx === -1) missing.push(exp);
    else usedActual.add(idx);
  }

  const unexpected = actual.filter((_, i) => !usedActual.has(i));
  return { missing, unexpected };
}
