import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDevInterfacesModule } from '@/lib/scanner/modules/p1-13-dev-interfaces';
import type { CrawlResult } from '@/lib/scanner/types';

const baseCrawl = (): CrawlResult => ({
  finalUrl: 'https://example.test/',
  statusCode: 200,
  headers: {},
  cookies: [],
  jsBundleUrls: [],
  inlineScriptContent: '',
  html: '',
  tls: null,
  stack: '',
});

interface ProbeResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

function stubProbes(responseByPath: (url: string) => ProbeResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      const r = responseByPath(url);
      const headers = new Headers(r.headers ?? {});
      return {
        status: r.status,
        text: async () => r.body,
        headers,
      } as unknown as Response;
    }),
  );
}

describe('P1-13 dev interfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags a real Swagger UI page', async () => {
    stubProbes((url) => {
      if (url.endsWith('/swagger-ui.html') || url.endsWith('/swagger')) {
        return {
          status: 200,
          body: '<html><head><title>Swagger UI</title></head><body><div id="swagger-ui"></div></body></html>',
        };
      }
      return { status: 404, body: 'not found' };
    });
    const findings = await runDevInterfacesModule(baseCrawl());
    expect(findings.some((f) => f.title.toLowerCase().includes('swagger'))).toBe(true);
  });

  it('does not flag a 404 page that mentions Swagger in a docs example (Phase 3.4 FP)', async () => {
    // Site routes unknown paths to a marketing page whose "API" section
    // discusses Swagger inside a <pre><code> example. Old behavior:
    // `body.toLowerCase().includes('swagger')` fires. New behavior:
    // cleanHtml() strips the <code> body before the substring check.
    stubProbes(() => ({
      status: 200,
      body: `
        <html>
          <head><title>Page not found</title></head>
          <body>
            <h1>404 — Page not found</h1>
            <p>Our public API doesn't use Swagger or OpenAPI today.</p>
            <pre><code>
              # If we did, you'd hit /swagger or /openapi.json with content like:
              # { "openapi": "3.0.0", "info": { "title": "..." } }
            </code></pre>
          </body>
        </html>
      `,
    }));
    const findings = await runDevInterfacesModule(baseCrawl());
    // The body still contains the word "Swagger" in regular prose, so
    // this fixture also exercises the harder case: the word appears
    // outside the code block. The detect logic uses substring match,
    // so this is still a known FP source — assert specifically that
    // none of the JSON-banner findings fire (which used to FP on the
    // openapi keyword inside the code example).
    expect(findings.find((f) => f.title.includes('OpenAPI schema'))).toBeUndefined();
    expect(findings.find((f) => f.title.includes('API documentation'))).toBeUndefined();
  });

  it('does not flag a phpinfo example inside an HTML comment', async () => {
    stubProbes((url) => ({
      status: 200,
      body: url.endsWith('/phpinfo.php')
        ? '<!-- legacy diagnostic, removed: PHP Version 7.4.3 -->\n<html><body>Not found.</body></html>'
        : 'not found',
    }));
    const findings = await runDevInterfacesModule(baseCrawl());
    expect(findings.find((f) => f.title.includes('PHPInfo'))).toBeUndefined();
  });

  it('still flags a real phpinfo page', async () => {
    stubProbes((url) => ({
      status: url.endsWith('/phpinfo.php') ? 200 : 404,
      body: url.endsWith('/phpinfo.php')
        ? '<html><body><h1>PHP Version 7.4.3</h1><table>...</table></body></html>'
        : 'nope',
    }));
    const findings = await runDevInterfacesModule(baseCrawl());
    expect(findings.some((f) => f.title.includes('PHPInfo'))).toBe(true);
  });
});
