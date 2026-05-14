import { describe, it, expect, vi, beforeEach } from 'vitest';

// Force the fallback path so this test doesn't try to launch a real browser.
// Phase 3.1: when headlessCrawl is false, crawl() runs the static-fetch path.
vi.mock('@/lib/features', () => ({
  features: {
    headlessCrawl: false,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// TLS probe opens a real socket — stub it so the test stays hermetic.
vi.mock('tls', async () => {
  const actual = await vi.importActual<typeof import('tls')>('tls');
  return {
    ...actual,
    connect: () => ({
      getPeerCertificate: () => ({}),
      getProtocol: () => 'TLSv1.3',
      authorized: true,
      destroy: () => {},
      once: () => {},
    }),
  };
});

import { crawl } from '@/lib/scanner/crawler';

function makeMockResponse({
  url,
  status = 200,
  html,
  setCookies = [] as string[],
  headers = {} as Record<string, string>,
}: { url: string; status?: number; html: string; setCookies?: string[]; headers?: Record<string, string> }) {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  for (const c of setCookies) h.append('set-cookie', c);
  return {
    url,
    status,
    headers: h,
    text: async () => html,
  } as unknown as Response;
}

describe('crawler — fetch-only fallback path', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the documented CrawlResult shape with renderMode="fetch-only"', async () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <script src="/_next/static/chunks/main.js"></script>
          <script>console.log('inline payload');</script>
        </head>
        <body data-reactroot>hello</body>
      </html>
    `;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMockResponse({
      url: 'https://example.test/',
      html,
      setCookies: ['session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax'],
      headers: { 'content-type': 'text/html', 'x-powered-by': 'Next.js' },
    })));

    const result = await crawl('https://example.test/');

    expect(result.renderMode).toBe('fetch-only');
    expect(result.statusCode).toBe(200);
    expect(result.finalUrl).toBe('https://example.test/');
    expect(result.html).toContain('data-reactroot');
    expect(result.jsBundleUrls).toEqual([
      'https://example.test/_next/static/chunks/main.js',
    ]);
    expect(result.inlineScriptContent).toContain('inline payload');
    expect(result.cookies).toHaveLength(1);
    expect(result.cookies[0]).toMatchObject({
      name: 'session',
      value: 'abc123',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    });
    expect(result.stack).toMatch(/Next\.js|React/);
    expect(result.headers['content-type']).toBe('text/html');

    // New Phase 3.1 fields are undefined when the fallback path runs.
    expect(result.renderedHtml).toBeUndefined();
    expect(result.consoleErrors).toBeUndefined();
    expect(result.networkRequests).toBeUndefined();
    expect(result.loadedChunkContents).toBeUndefined();

    // Phase 3.4: cleanedHtml is populated on both crawl paths. The
    // inline <script>console.log('inline payload')</script> body should
    // be stripped, while the static <body> text remains.
    expect(result.cleanedHtml).toBeDefined();
    expect(result.cleanedHtml).not.toContain('inline payload');
    expect(result.cleanedHtml).toContain('data-reactroot');
  });

  it('resolves <script src> relative URLs against the final URL', async () => {
    const html = `<script src="bundle.js"></script><script src="//cdn.example.test/lib.js"></script>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMockResponse({
      url: 'https://target.test/dashboard',
      html,
    })));
    const result = await crawl('https://target.test/dashboard');
    expect(result.jsBundleUrls).toContain('https://target.test/bundle.js');
    expect(result.jsBundleUrls).toContain('https://cdn.example.test/lib.js');
  });

  it('caps jsBundleUrls extraction at 50 entries', async () => {
    const scripts = Array.from({ length: 80 }, (_, i) => `<script src="/c${i}.js"></script>`).join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMockResponse({
      url: 'https://target.test/',
      html: scripts,
    })));
    const result = await crawl('https://target.test/');
    expect(result.jsBundleUrls.length).toBe(50);
  });

  it('returns an empty cookies array when no Set-Cookie headers are present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMockResponse({
      url: 'https://target.test/',
      html: '<html></html>',
    })));
    const result = await crawl('https://target.test/');
    expect(result.cookies).toEqual([]);
  });
});
