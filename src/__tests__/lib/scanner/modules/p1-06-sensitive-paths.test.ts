import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CrawlResult } from '@/lib/scanner/types';

// Force the fetch-batch fallback path by stubbing httpx + nuclei to no-op.
// Both tools shell out to external binaries that aren't on the test box.
vi.mock('@/lib/scanner/tools/httpx', () => ({
  runHttpxProbe: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/scanner/tools/nuclei', () => ({
  runNuclei: vi.fn().mockResolvedValue([]),
}));

import { runSensitivePathsModule } from '@/lib/scanner/modules/p1-06-sensitive-paths';

const baseCrawl = (): CrawlResult => ({
  finalUrl: 'https://example.com/',
  statusCode: 200,
  headers: {},
  cookies: [],
  jsBundleUrls: [],
  inlineScriptContent: '',
  html: '',
  tls: null,
  stack: '',
});

interface MockResponse {
  status: number;
  body: string;
}

function stubFetchByPath(byPath: (pathname: string) => MockResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      const { pathname } = new URL(url);
      const r = byPath(pathname);
      return {
        status: r.status,
        text: async () => r.body,
      } as unknown as Response;
    }),
  );
}

const BASELINE_BODY = '<html><body>Not found</body></html>';
const BASELINE_PATH = '/vibesafe-probe-nonexistent-path-check';

describe('P1-06 sensitive paths — Phase 3.5 login-form FP suppression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not flag /admin when the 200 response is a login form', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/admin') {
        return {
          status: 200,
          body: `
            <html>
              <body>
                <h1>Sign in</h1>
                <form method="post" action="/login">
                  <input name="email" />
                  <input type="password" name="password" />
                  <button>Sign in</button>
                </form>
              </body>
            </html>`,
        };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((f) => f.evidence.includes('/admin'))).toBeUndefined();
  });

  it('still flags /admin when the 200 response is a dashboard with no login form', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/admin') {
        return {
          status: 200,
          body: '<html><body><h1>Admin dashboard</h1><nav>Users · Orders · Settings</nav><table>...</table></body></html>',
        };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((f) => f.evidence.includes('/admin'))).toBeDefined();
  });

  it('still flags /.env at CRITICAL even though the body could conceivably look like a form', async () => {
    // .env returning credential-looking content. No login-form regex
    // should match here, so the CRITICAL finding fires.
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.env') {
        return {
          status: 200,
          body: 'DATABASE_URL=postgres://user:pass@db/app\nAPI_KEY=sk_live_xyz\nJWT_SECRET=hunter2\n',
        };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    const critical = findings.find((f) => f.severity === 'CRITICAL' && f.evidence.includes('/.env'));
    expect(critical).toBeDefined();
  });

  it('returns no findings when every probe 404s', async () => {
    stubFetchByPath(() => ({ status: 404, body: BASELINE_BODY }));
    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });
});
