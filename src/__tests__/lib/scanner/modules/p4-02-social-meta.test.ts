/**
 * Tests for P4-02 social meta module.
 *
 * Covers:
 *  - runSocialMetaModule: OG tag detection, Twitter card detection, relative og:image
 *  - runSocialMetaDepthChecks: og:image reachability probe
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock probeImage so tests don't hit the network
vi.mock('@/lib/scanner/tools/seo-fetch', () => ({
  probeImage: vi.fn().mockResolvedValue({ reachable: true, status: 200, contentType: 'image/png' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { runSocialMetaModule, runSocialMetaDepthChecks } from '@/lib/scanner/modules/p4-02-social-meta';
import type { CrawlResult } from '@/lib/scanner/types';
import { probeImage } from '@/lib/scanner/tools/seo-fetch';

const mockProbeImage = probeImage as ReturnType<typeof vi.fn>;

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

// Full set of valid OG + Twitter tags
const FULL_OG_HTML = `
  <html><head>
    <meta property="og:title" content="My Title">
    <meta property="og:description" content="My Desc">
    <meta property="og:image" content="https://example.com/og.png">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
  </head><body></body></html>
`;

// ─────────────────────────────────────────────────────────────────────────────

describe('runSocialMetaModule — Open Graph tags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns no OG finding when all four OG tags are present', () => {
    const result = runSocialMetaModule(makeCrawl(FULL_OG_HTML));
    expect(result.find((f) => f.title.includes('Open Graph'))).toBeUndefined();
  });

  it('emits MEDIUM finding when all OG tags are missing', () => {
    const result = runSocialMetaModule(makeCrawl('<html><head></head><body></body></html>'));
    const f = result.find((x) => x.title.includes('Open Graph tags'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('MEDIUM');
    expect(f?.moduleId).toBe('P4-02');
    expect(f?.category).toBe('SEO');
    expect(f?.evidence).toContain('og:title');
    expect(f?.evidence).toContain('og:description');
    expect(f?.evidence).toContain('og:image');
    expect(f?.evidence).toContain('og:type');
  });

  it('emits finding with correct missing-tag count when some are present', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Title">
        <meta property="og:description" content="Desc">
      </head><body></body></html>
    `;
    const result = runSocialMetaModule(makeCrawl(html));
    const f = result.find((x) => x.title.includes('Open Graph tags'));
    expect(f).toBeDefined();
    // og:image + og:type missing → 2 tags
    expect(f?.title).toContain('2 tags');
    expect(f?.evidence).toContain('og:image');
    expect(f?.evidence).toContain('og:type');
  });

  it('uses singular grammar when exactly 1 OG tag is missing', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="T">
        <meta property="og:description" content="D">
        <meta property="og:type" content="website">
      </head><body></body></html>
    `;
    const result = runSocialMetaModule(makeCrawl(html));
    const f = result.find((x) => x.title.includes('Open Graph tags'));
    expect(f?.title).toContain('1 tag)');
  });
});

describe('runSocialMetaModule — Twitter Card', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits LOW finding when twitter:card is absent', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="T">
        <meta property="og:description" content="D">
        <meta property="og:image" content="https://example.com/img.png">
        <meta property="og:type" content="website">
      </head><body></body></html>
    `;
    const result = runSocialMetaModule(makeCrawl(html));
    const f = result.find((x) => x.title.includes('Twitter Card'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('LOW');
  });

  it('does NOT emit Twitter finding when twitter:card is present', () => {
    const result = runSocialMetaModule(makeCrawl(FULL_OG_HTML));
    expect(result.find((x) => x.title.includes('Twitter Card'))).toBeUndefined();
  });
});

describe('runSocialMetaModule — og:image URL type', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits MEDIUM finding when og:image is a relative URL', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="T">
        <meta property="og:description" content="D">
        <meta property="og:image" content="/images/og.png">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary">
      </head><body></body></html>
    `;
    const result = runSocialMetaModule(makeCrawl(html));
    const f = result.find((x) => x.title.includes('relative URL'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('MEDIUM');
    expect(f?.evidence).toContain('/images/og.png');
  });

  it('does NOT emit relative-URL finding when og:image is absolute https', () => {
    const result = runSocialMetaModule(makeCrawl(FULL_OG_HTML));
    expect(result.find((x) => x.title.includes('relative URL'))).toBeUndefined();
  });

  it('does NOT emit relative-URL finding when og:image is absolute http', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="T">
        <meta property="og:description" content="D">
        <meta property="og:image" content="http://example.com/img.png">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary">
      </head><body></body></html>
    `;
    const result = runSocialMetaModule(makeCrawl(html));
    expect(result.find((x) => x.title.includes('relative URL'))).toBeUndefined();
  });
});

describe('runSocialMetaModule — empty page', () => {
  it('returns OG finding and Twitter finding for completely empty head', () => {
    const result = runSocialMetaModule(makeCrawl('<html><head></head><body></body></html>'));
    expect(result.some((f) => f.title.includes('Open Graph'))).toBe(true);
    expect(result.some((f) => f.title.includes('Twitter Card'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runSocialMetaDepthChecks — og:image reachability', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty findings when og:image is absent', async () => {
    const result = await runSocialMetaDepthChecks(
      makeCrawl('<html><head></head><body></body></html>'),
    );
    expect(result).toHaveLength(0);
  });

  it('returns empty findings when og:image is relative (legacy module owns it)', async () => {
    const html = `<html><head><meta property="og:image" content="/img.png"></head><body></body></html>`;
    const result = await runSocialMetaDepthChecks(makeCrawl(html));
    expect(result).toHaveLength(0);
    // probeImage must NOT be called for relative URLs
    expect(mockProbeImage).not.toHaveBeenCalled();
  });

  it('returns empty findings when og:image is reachable', async () => {
    mockProbeImage.mockResolvedValue({ reachable: true, status: 200, contentType: 'image/jpeg' });
    const result = await runSocialMetaDepthChecks(makeCrawl(FULL_OG_HTML));
    expect(result).toHaveLength(0);
  });

  it('emits MEDIUM finding when og:image returns non-2xx status', async () => {
    mockProbeImage.mockResolvedValue({ reachable: false, status: 404, contentType: null });
    const result = await runSocialMetaDepthChecks(makeCrawl(FULL_OG_HTML));
    const f = result.find((x) => x.title.includes('unreachable'));
    expect(f).toBeDefined();
    expect(f?.severity).toBeDefined();
    expect(f?.moduleId).toBe('P4-02');
    expect(f?.evidence).toContain('HTTP 404');
  });

  it('emits finding when og:image request fails (null status)', async () => {
    mockProbeImage.mockResolvedValue({ reachable: false, status: null, contentType: null });
    const result = await runSocialMetaDepthChecks(makeCrawl(FULL_OG_HTML));
    const f = result.find((x) => x.title.includes('unreachable'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('request failed');
  });

  it('emits finding when content-type is not image/*', async () => {
    mockProbeImage.mockResolvedValue({ reachable: false, status: 200, contentType: 'text/html' });
    const result = await runSocialMetaDepthChecks(makeCrawl(FULL_OG_HTML));
    const f = result.find((x) => x.title.includes('unreachable'));
    expect(f).toBeDefined();
    expect(f?.evidence).toContain('text/html');
  });

  it('calls probeImage with the absolute og:image URL', async () => {
    mockProbeImage.mockResolvedValue({ reachable: true, status: 200, contentType: 'image/png' });
    await runSocialMetaDepthChecks(makeCrawl(FULL_OG_HTML));
    expect(mockProbeImage).toHaveBeenCalledWith('https://example.com/og.png');
  });
});
