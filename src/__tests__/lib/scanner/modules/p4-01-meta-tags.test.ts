/**
 * Tests for P4-01 meta tags module.
 *
 * Covers:
 *  - runMetaTagsModule: Lighthouse-driven findings for title, description, canonical, http-status
 *  - runMetaTagsDepthChecks: crawl-driven viewport, html lang, and canonical chain checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the seo-fetch tool used by runMetaTagsDepthChecks for canonical chain resolution
vi.mock('@/lib/scanner/tools/seo-fetch', () => ({
  resolveCanonicalChain: vi.fn().mockResolvedValue({
    finalStatus: 200,
    hops: 1,
    loop: false,
    blocked: false,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { runMetaTagsModule, runMetaTagsDepthChecks } from '@/lib/scanner/modules/p4-01-meta-tags';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import type { CrawlResult } from '@/lib/scanner/types';
import { resolveCanonicalChain } from '@/lib/scanner/tools/seo-fetch';

const mockResolveCanonical = resolveCanonicalChain as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMetrics(issues: Partial<LighthouseMetrics['seoIssues'][0]>[] = []): LighthouseMetrics {
  return {
    lcp: null, fcp: null, cls: null, tbt: null, tti: null, si: null, ttfb: null,
    performanceScore: null, accessibilityScore: null, seoScore: null,
    opportunities: [], accessibilityViolations: [],
    seoIssues: issues.map((iss) => ({
      id: '', title: '', description: '', score: 0, type: null, items: [], ...iss,
    })),
  };
}

function makeCrawl(html: string, overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com',
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

// ─────────────────────────────────────────────────────────────────────────────

describe('runMetaTagsModule — Lighthouse-driven checks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty findings when seoIssues is empty', async () => {
    const result = await runMetaTagsModule(makeMetrics());
    expect(result).toHaveLength(0);
  });

  it('emits HIGH finding for missing document title (score < 1)', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'document-title', score: 0, displayValue: 'No title' }]),
    );
    const f = result.find((x) => x.title.includes('document title'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
    expect(f?.moduleId).toBe('P4-01');
    expect(f?.category).toBe('SEO');
    expect(f?.evidence).toBe('No title');
  });

  it('uses default evidence when displayValue is absent for title', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'document-title', score: 0 }]),
    );
    const f = result.find((x) => x.title.includes('document title'));
    expect(f?.evidence).toBe('Document does not have a <title> element');
  });

  it('does NOT emit title finding when score is exactly 1', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'document-title', score: 1 }]),
    );
    expect(result.find((x) => x.title.includes('document title'))).toBeUndefined();
  });

  it('does NOT emit title finding when score is null', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'document-title', score: null }]),
    );
    expect(result.find((x) => x.title.includes('document title'))).toBeUndefined();
  });

  it('emits MEDIUM finding for missing meta description (score < 1)', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'meta-description', score: 0, displayValue: 'No description' }]),
    );
    const f = result.find((x) => x.title.includes('meta description'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('MEDIUM');
    expect(f?.evidence).toBe('No description');
  });

  it('emits MEDIUM finding for canonical URL issue', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'canonical', score: 0, displayValue: 'Canonical URL mismatch' }]),
    );
    const f = result.find((x) => x.title.includes('Canonical URL'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('MEDIUM');
  });

  it('emits HIGH finding for HTTP status code issue', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([{ id: 'http-status-code', score: 0, displayValue: 'HTTP 404' }]),
    );
    const f = result.find((x) => x.title.includes('HTTP status'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
  });

  it('emits multiple findings when multiple issues present', async () => {
    const result = await runMetaTagsModule(
      makeMetrics([
        { id: 'document-title', score: 0 },
        { id: 'meta-description', score: 0 },
        { id: 'canonical', score: 0 },
        { id: 'http-status-code', score: 0 },
      ]),
    );
    expect(result.length).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runMetaTagsDepthChecks — viewport meta tag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits finding when viewport meta is absent', async () => {
    const html = '<html lang="en"><head><title>Test</title></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('viewport'));
    expect(f).toBeDefined();
    expect(f?.severity).toBeDefined();
    expect(f?.moduleId).toBe('P4-01');
  });

  it('emits finding when viewport lacks width=device-width', async () => {
    const html = '<html lang="en"><head><meta name="viewport" content="initial-scale=1"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('not responsive'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('initial-scale=1');
  });

  it('does NOT emit viewport finding when viewport is correctly set', async () => {
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    expect(result.find((x) => x.title.includes('viewport'))).toBeUndefined();
  });
});

describe('runMetaTagsDepthChecks — html lang attribute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits finding when html lang is absent', async () => {
    const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('lang'));
    expect(f).toBeDefined();
    expect(f?.moduleId).toBe('P4-01');
  });

  it('does NOT emit lang finding when lang is present', async () => {
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    expect(result.find((x) => x.title.includes('lang'))).toBeUndefined();
  });
});

describe('runMetaTagsDepthChecks — canonical chain resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT emit canonical finding when canonical resolves cleanly to 200', async () => {
    mockResolveCanonical.mockResolvedValue({ finalStatus: 200, hops: 1, loop: false, blocked: false });
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/page"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    expect(result.find((x) => x.title.includes('Canonical URL'))).toBeUndefined();
  });

  it('emits finding when canonical is a redirect loop', async () => {
    mockResolveCanonical.mockResolvedValue({ finalStatus: null, hops: 5, loop: true, blocked: false });
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/page"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('redirect loop'));
    expect(f).toBeDefined();
  });

  it('emits finding when canonical points to blocked address', async () => {
    mockResolveCanonical.mockResolvedValue({ finalStatus: null, hops: 1, loop: false, blocked: true });
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/page"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('blocked'));
    expect(f).toBeDefined();
  });

  it('emits finding when canonical resolves to non-2xx', async () => {
    mockResolveCanonical.mockResolvedValue({ finalStatus: 404, hops: 1, loop: false, blocked: false });
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/page"></head><body></body></html>';
    const result = await runMetaTagsDepthChecks(makeCrawl(html));
    const f = result.find((x) => x.title.includes('HTTP 404'));
    expect(f).toBeDefined();
  });

  it('returns empty findings when html is absent', async () => {
    const crawl = makeCrawl('');
    const result = await runMetaTagsDepthChecks(crawl);
    expect(result).toHaveLength(0);
  });

  it('uses renderedHtml over html when renderMode is headless', async () => {
    mockResolveCanonical.mockResolvedValue({ finalStatus: 200, hops: 1, loop: false, blocked: false });
    // renderedHtml has lang + correct viewport, html does not
    const crawl = makeCrawl('<html><head></head><body></body></html>', {
      renderedHtml: '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>',
      renderMode: 'headless',
    });
    const result = await runMetaTagsDepthChecks(crawl);
    // Should use renderedHtml which has lang and viewport — no viewport/lang findings
    expect(result.find((x) => x.title.includes('viewport'))).toBeUndefined();
    expect(result.find((x) => x.title.includes('lang'))).toBeUndefined();
  });
});
