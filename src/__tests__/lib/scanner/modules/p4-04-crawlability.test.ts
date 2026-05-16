/**
 * Tests for P4-04 crawlability module.
 *
 * Covers:
 *  - runCrawlabilityModule: Lighthouse-driven robots.txt, is-crawlable, crawlable-anchors, link-text
 *  - runCrawlabilityDepthChecks: hreflang, sitemap validity, sitemap-in-robots
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock seo-fetch helpers used by the depth checks
vi.mock('@/lib/scanner/tools/seo-fetch', () => ({
  fetchTextSafe: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  runCrawlabilityModule,
  runCrawlabilityDepthChecks,
} from '@/lib/scanner/modules/p4-04-crawlability';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import type { CrawlResult } from '@/lib/scanner/types';
import { fetchTextSafe } from '@/lib/scanner/tools/seo-fetch';

const mockFetchTextSafe = fetchTextSafe as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMetrics(issues: Partial<LighthouseMetrics['seoIssues'][0]>[] = []): LighthouseMetrics {
  return {
    lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
    performanceScore: null, accessibilityScore: null, seoScore: null,
    opportunities: [], accessibilityViolations: [],
    seoIssues: issues.map((i) => ({
      id: '', title: '', description: '', score: 0, type: null, items: [], ...i,
    })),
  };
}

function makeCrawl(html: string, overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com/page',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html,
    tls: null,
    stack: '',
    ...overrides,
  };
}

// Minimal valid sitemap XML with a single URL
const VALID_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>`;

// robots.txt with Sitemap directive
const ROBOTS_WITH_SITEMAP = `User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml`;
const ROBOTS_WITHOUT_SITEMAP = `User-agent: *\nAllow: /`;

// ─────────────────────────────────────────────────────────────────────────────

describe('runCrawlabilityModule — Lighthouse-driven checks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty findings when seoIssues is empty', async () => {
    const result = await runCrawlabilityModule(makeMetrics());
    expect(result).toHaveLength(0);
  });

  it('emits MEDIUM finding for robots.txt issues', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'robots-txt', score: 0, displayValue: 'Blocked by robots.txt' }]),
    );
    const f = result.find((x) => x.title.includes('robots.txt'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('MEDIUM');
    expect(f?.moduleId).toBe('P4-04');
    expect(f?.evidence).toBe('Blocked by robots.txt');
  });

  it('uses default evidence when displayValue is absent for robots-txt', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'robots-txt', score: 0 }]),
    );
    const f = result.find((x) => x.title.includes('robots.txt'));
    expect(f?.evidence).toBe('robots.txt is invalid or blocks search engines');
  });

  it('does NOT emit robots-txt finding when score is 1', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'robots-txt', score: 1 }]),
    );
    expect(result.find((x) => x.title.includes('robots.txt'))).toBeUndefined();
  });

  it('does NOT emit robots-txt finding when score is null', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'robots-txt', score: null }]),
    );
    expect(result.find((x) => x.title.includes('robots.txt'))).toBeUndefined();
  });

  it('emits HIGH finding when page is not crawlable', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'is-crawlable', score: 0, displayValue: 'noindex set' }]),
    );
    const f = result.find((x) => x.title.includes('not crawlable'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
    expect(f?.evidence).toBe('noindex set');
  });

  it('emits MEDIUM finding for JavaScript-only links with plural grammar', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{
        id: 'crawlable-anchors',
        score: 0,
        items: [{ label: 'link1' }, { label: 'link2' }, { label: 'link3' }],
      }]),
    );
    const f = result.find((x) => x.title.includes('JavaScript-only links'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('MEDIUM');
    expect(f?.title).toContain('3 links');
    expect(f?.evidence).toContain('3 links use');
  });

  it('uses singular grammar when exactly 1 JavaScript link', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'crawlable-anchors', score: 0, items: [{ label: 'a' }] }]),
    );
    const f = result.find((x) => x.title.includes('JavaScript-only'));
    expect(f?.title).toContain('1 link)');
    expect(f?.evidence).toContain('1 link uses');
  });

  it('emits LOW finding for generic link text', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([{ id: 'link-text', score: 0, items: [{ label: 'click here' }] }]),
    );
    const f = result.find((x) => x.title.includes('Generic link text'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('LOW');
  });

  it('emits multiple findings when multiple issues present simultaneously', async () => {
    const result = await runCrawlabilityModule(
      makeMetrics([
        { id: 'robots-txt', score: 0 },
        { id: 'is-crawlable', score: 0 },
        { id: 'crawlable-anchors', score: 0, items: [] },
        { id: 'link-text', score: 0, items: [] },
      ]),
    );
    expect(result.length).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runCrawlabilityDepthChecks — hreflang', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty findings when no hreflang and no LH signal', async () => {
    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    // Only depends on fetch for sitemap/robots — both null by default
    expect(result.filter((f) => f.title.includes('hreflang'))).toHaveLength(0);
  });

  it('emits hreflang finding for invalid BCP-47 code in HTML', async () => {
    const html = `
      <html lang="en"><head>
        <link rel="alternate" hreflang="INVALID_CODE_123!!" href="https://example.com/bad">
      </head><body></body></html>
    `;
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('hreflang'));
    expect(f).toBeDefined();
    expect(f?.moduleId).toBe('P4-04');
    expect(f?.evidence).toContain('INVALID_CODE_123!!');
  });

  it('does NOT emit hreflang finding for valid BCP-47 codes', async () => {
    const html = `
      <html lang="en"><head>
        <link rel="alternate" hreflang="en" href="https://example.com/">
        <link rel="alternate" hreflang="en-GB" href="https://example.com/uk">
        <link rel="alternate" hreflang="x-default" href="https://example.com/">
      </head><body></body></html>
    `;
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    expect(result.filter((f) => f.title.includes('hreflang'))).toHaveLength(0);
  });

  it('emits hreflang finding when Lighthouse also flags it (corroboration)', async () => {
    const html = '<html lang="en"><head></head><body></body></html>';
    const metrics = makeMetrics([{ id: 'hreflang', score: 0, displayValue: 'LH flagged hreflang' }]);
    const result = await runCrawlabilityDepthChecks(makeCrawl(html), metrics);
    const f = result.find((x) => x.title.includes('hreflang'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('LH flagged hreflang');
  });
});

describe('runCrawlabilityDepthChecks — sitemap validity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns no sitemap finding when sitemap fetch returns null', async () => {
    mockFetchTextSafe.mockResolvedValue(null);
    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    expect(result.filter((f) => f.title.includes('sitemap'))).toHaveLength(0);
  });

  it('emits finding when sitemap.xml is not valid XML', async () => {
    // First call = sitemap (invalid XML), second = robots.txt (null)
    mockFetchTextSafe
      .mockResolvedValueOnce('not xml at all <<<<')
      .mockResolvedValueOnce(null);

    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('sitemap.xml is structurally invalid'));
    expect(f).toBeDefined();
    expect(f?.moduleId).toBe('P4-04');
  });

  it('emits finding when sitemap root element is wrong', async () => {
    const badSitemap = `<?xml version="1.0"?><wrongroot></wrongroot>`;
    mockFetchTextSafe
      .mockResolvedValueOnce(badSitemap)
      .mockResolvedValueOnce(null);

    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('structurally invalid'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('wrongroot');
  });
});

describe('runCrawlabilityDepthChecks — sitemap referenced in robots.txt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits LOW finding when valid sitemap is NOT referenced in robots.txt', async () => {
    mockFetchTextSafe
      .mockResolvedValueOnce(VALID_SITEMAP)
      .mockResolvedValueOnce(ROBOTS_WITHOUT_SITEMAP);

    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('not referenced in robots.txt'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('robots.txt has no');
  });

  it('does NOT emit sitemap-in-robots finding when robots.txt advertises the sitemap', async () => {
    mockFetchTextSafe
      .mockResolvedValueOnce(VALID_SITEMAP)
      .mockResolvedValueOnce(ROBOTS_WITH_SITEMAP);

    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    expect(result.filter((f) => f.title.includes('not referenced'))).toHaveLength(0);
  });

  it('emits finding with evidence noting missing robots.txt when robots is null', async () => {
    mockFetchTextSafe
      .mockResolvedValueOnce(VALID_SITEMAP)
      .mockResolvedValueOnce(null);

    const html = '<html lang="en"><head></head><body></body></html>';
    const result = await runCrawlabilityDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('not referenced in robots.txt'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('no robots.txt found');
  });
});

describe('runCrawlabilityDepthChecks — edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty findings when finalUrl is invalid', async () => {
    const crawl = makeCrawl('<html></html>', { finalUrl: 'not-a-url' });
    const result = await runCrawlabilityDepthChecks(crawl);
    expect(result).toHaveLength(0);
  });

  it('uses renderedHtml over html when renderMode is headless', async () => {
    // renderedHtml has no hreflang issues; html has an invalid one
    // Only the renderedHtml should be parsed
    const crawl = makeCrawl(
      '<html lang="en"><head><link rel="alternate" hreflang="INVALID!!" href="/"></head></html>',
      {
        renderedHtml: '<html lang="en"><head></head><body></body></html>',
        renderMode: 'headless',
      },
    );
    const result = await runCrawlabilityDepthChecks(crawl);
    expect(result.filter((f) => f.title.includes('hreflang'))).toHaveLength(0);
  });
});
