import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSourcemapsModule } from '@/lib/scanner/modules/p1-02-sourcemaps';
import type { CrawlResult } from '@/lib/scanner/types';

describe('P1-02: Sourcemap Exposure Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect accessible .map files', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ status: 200 }) // app.js.map - accessible
      .mockResolvedValueOnce({ status: 404 }); // vendor.js.map - not accessible

    global.fetch = mockFetch;

    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      scripts: [],
      links: [],
      resources: [],
      statusCode: 200,
      inlineScriptContent: '',
      jsBundleUrls: [
        'https://example.com/_next/static/chunks/app.js',
        'https://example.com/_next/static/chunks/vendor.js',
      ],
    };

    const findings = await runSourcemapsModule(crawlResult);

    expect(findings).toHaveLength(1);
    expect(findings[0].moduleId).toBe('P1-02');
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].category).toBe('Sourcemap Exposure');
    expect(findings[0].title).toContain('Production sourcemaps expose full source code');
    expect(findings[0].location).toContain('/_next/static/chunks/app.js.map');
    expect(findings[0].evidence).toContain('HEAD');
    expect(findings[0].evidence).toContain('HTTP 200');
  });

  it('should detect multiple exposed sourcemaps', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ status: 200 }) // app.js.map
      .mockResolvedValueOnce({ status: 200 }) // vendor.js.map
      .mockResolvedValueOnce({ status: 200 }); // main.js.map

    global.fetch = mockFetch;

    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      scripts: [],
      links: [],
      resources: [],
      statusCode: 200,
      inlineScriptContent: '',
      jsBundleUrls: [
        'https://example.com/static/app.js',
        'https://example.com/static/vendor.js',
        'https://example.com/static/main.js',
      ],
    };

    const findings = await runSourcemapsModule(crawlResult);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('3 files');
    expect(findings[0].location).toContain('/static/app.js.map');
    expect(findings[0].location).toContain('/static/vendor.js.map');
    expect(findings[0].location).toContain('/static/main.js.map');
  });

  it('should return empty array when no sourcemaps are accessible', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValue({ status: 404 });

    global.fetch = mockFetch;

    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      scripts: [],
      links: [],
      resources: [],
      statusCode: 200,
      inlineScriptContent: '',
      jsBundleUrls: [
        'https://example.com/app.js',
        'https://example.com/vendor.js',
      ],
    };

    const findings = await runSourcemapsModule(crawlResult);

    expect(findings).toHaveLength(0);
  });

  it('should handle fetch errors gracefully', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValue(new Error('Network error'));

    global.fetch = mockFetch;

    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      scripts: [],
      links: [],
      resources: [],
      statusCode: 200,
      inlineScriptContent: '',
      jsBundleUrls: ['https://example.com/app.js'],
    };

    const findings = await runSourcemapsModule(crawlResult);

    expect(findings).toHaveLength(0);
  });

  it('should handle empty bundle URLs', async () => {
    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      scripts: [],
      links: [],
      resources: [],
      statusCode: 200,
      inlineScriptContent: '',
      jsBundleUrls: [],
    };

    const findings = await runSourcemapsModule(crawlResult);

    expect(findings).toHaveLength(0);
  });

  it('should use HEAD method for checking sourcemaps', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValue({ status: 200 });

    global.fetch = mockFetch;

    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      scripts: [],
      links: [],
      resources: [],
      statusCode: 200,
      inlineScriptContent: '',
      jsBundleUrls: ['https://example.com/app.js'],
    };

    await runSourcemapsModule(crawlResult);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/app.js.map',
      expect.objectContaining({ method: 'HEAD' })
    );
  });
});
