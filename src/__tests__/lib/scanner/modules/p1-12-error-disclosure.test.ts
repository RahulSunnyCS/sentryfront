import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runErrorDisclosureModule } from '@/lib/scanner/modules/p1-12-error-disclosure';
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

function stubProbeResponses(bodyForAllProbes: string, status = 500) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      text: async () => bodyForAllProbes,
    } as unknown as Response),
  );
}

describe('P1-12 error disclosure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags a Node.js stack trace in a real error response', async () => {
    stubProbeResponses(
      'Error: cannot read foo\n    at handler (/var/www/app/routes/x.js:42:11)\n    at next (/var/www/app/node_modules/express/lib/router/index.js:280:13)',
    );
    const findings = await runErrorDisclosureModule(baseCrawl());
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.title.includes('Node.js'))).toBe(true);
  });

  it('does not flag stack-trace examples inside a docs/404 page (Phase 3.4 FP)', async () => {
    // A common pattern: the site has a custom 404 page that includes a
    // documentation snippet showing what a stack trace looks like. The
    // text is inside <pre><code> blocks — the browser renders it as
    // example content, not a real error from the server.
    stubProbeResponses(`
      <html>
        <head><title>Page not found</title></head>
        <body>
          <h1>404 — Page not found</h1>
          <p>If you hit a real error, you might see something like:</p>
          <pre><code>at handler (/var/www/app/routes/foo.js:42:11)
at next (/var/www/app/node_modules/express/lib/router/index.js:280:13)</code></pre>
          <p>Need help? Email support.</p>
        </body>
      </html>
    `);
    const findings = await runErrorDisclosureModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('does not flag database connection strings buried inside a comment example', async () => {
    stubProbeResponses(`
      <html>
        <body>
          <h1>Welcome</h1>
          <!-- example connection: postgres://user:pass@db.example.com:5432/app -->
          <p>Nothing else.</p>
        </body>
      </html>
    `);
    const findings = await runErrorDisclosureModule(baseCrawl());
    expect(findings.find((f) => f.title.includes('connection string'))).toBeUndefined();
  });

  it('returns no findings on a clean 404 with no disclosure', async () => {
    stubProbeResponses('<html><body>Not found</body></html>', 404);
    const findings = await runErrorDisclosureModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });
});
