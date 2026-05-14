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

// ── Phase 3.8.2: coverage-gap path additions ─────────────────────────────────

const DS_STORE_MAGIC = '\x00\x00\x00\x01Bud1' + '\x00'.repeat(60);

describe('P1-06 sensitive paths — Phase 3.8.2 VCS/source-code disclosure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags /.git/index at CRITICAL when the body starts with DIRC magic', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.git/index') return { status: 200, body: 'DIRC\x00\x00\x00\x02' + '\x00'.repeat(40) };
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    const f = findings.find((x) => x.severity === 'CRITICAL' && x.evidence.includes('/.git/index'));
    expect(f).toBeDefined();
  });

  it('does NOT flag /.git/index when the 200 body is HTML (SPA catch-all)', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.git/index') {
        return { status: 200, body: '<!doctype html><html><body>App shell</body></html>' };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((x) => x.evidence.includes('/.git/index'))).toBeUndefined();
  });

  it('flags /.svn/wc.db at CRITICAL', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.svn/wc.db') return { status: 200, body: 'SQLite format 3\x00' + '\x00'.repeat(50) };
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    const f = findings.find((x) => x.severity === 'CRITICAL' && x.evidence.includes('/.svn/wc.db'));
    expect(f).toBeDefined();
  });
});

describe('P1-06 sensitive paths — Phase 3.8.2 .DS_Store magic-byte sniffer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags /.DS_Store as HIGH when the body matches the Bud1 magic', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.DS_Store') return { status: 200, body: DS_STORE_MAGIC };
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    const f = findings.find((x) => x.evidence.includes('/.DS_Store'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('HIGH');
  });

  it('does NOT flag /.DS_Store when the 200 body is HTML (SPA catch-all)', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.DS_Store') {
        return { status: 200, body: '<!doctype html><html><body>Welcome</body></html>' };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((x) => x.evidence.includes('/.DS_Store'))).toBeUndefined();
  });
});

describe('P1-06 sensitive paths — Phase 3.8.2 backup variants', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags /.env.bak at CRITICAL', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/.env.bak') {
        return {
          status: 200,
          body: 'DATABASE_URL=postgres://user:pass@db/app\nSTRIPE_SECRET=sk_live_xyz\n',
        };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((x) => x.severity === 'CRITICAL' && x.evidence.includes('/.env.bak'))).toBeDefined();
  });

  it('flags /wp-config.php.bak at CRITICAL', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/wp-config.php.bak') {
        return { status: 200, body: "<?php define('DB_PASSWORD','hunter2');" };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((x) => x.severity === 'CRITICAL' && x.evidence.includes('/wp-config.php.bak'))).toBeDefined();
  });

  it('flags /index.html.bak at CRITICAL', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/index.html.bak') {
        return { status: 200, body: '<!doctype html><!-- old version with dev API endpoints --><html></html>' };
      }
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((x) => x.severity === 'CRITICAL' && x.evidence.includes('/index.html.bak'))).toBeDefined();
  });
});

describe('P1-06 sensitive paths — Phase 3.8.2 lockfile MEDIUM tier', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a single MEDIUM finding when multiple lockfiles are exposed', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/yarn.lock') return { status: 200, body: '# yarn lockfile v1\n"react@18.0.0":\n  version "18.0.0"\n' };
      if (path === '/package-lock.json') return { status: 200, body: '{"lockfileVersion":3,"packages":{}}' };
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    const lockfileFindings = findings.filter((f) => f.title.includes('dependency-lock file'));
    expect(lockfileFindings).toHaveLength(1);
    expect(lockfileFindings[0].severity).toBe('MEDIUM');
    expect(lockfileFindings[0].evidence).toContain('/yarn.lock');
    expect(lockfileFindings[0].evidence).toContain('/package-lock.json');
  });

  it('emits a MEDIUM finding for a single lockfile (Gemfile.lock alone)', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/Gemfile.lock') return { status: 200, body: 'GEM\n  remote: https://rubygems.org/\n  specs:\n    rails (7.0.0)\n' };
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    const lockfileFindings = findings.filter((f) => f.title.includes('dependency-lock file'));
    expect(lockfileFindings).toHaveLength(1);
    expect(lockfileFindings[0].severity).toBe('MEDIUM');
    expect(lockfileFindings[0].evidence).toContain('/Gemfile.lock');
  });

  it('keeps lockfile findings separate from CRITICAL .git/index findings on the same scan', async () => {
    stubFetchByPath((path) => {
      if (path === BASELINE_PATH) return { status: 404, body: BASELINE_BODY };
      if (path === '/yarn.lock') return { status: 200, body: '# yarn lockfile v1\n' };
      if (path === '/.git/index') return { status: 200, body: 'DIRC\x00\x00\x00\x02' + '\x00'.repeat(40) };
      return { status: 404, body: BASELINE_BODY };
    });

    const findings = await runSensitivePathsModule(baseCrawl());
    expect(findings.find((f) => f.severity === 'MEDIUM' && f.evidence.includes('/yarn.lock'))).toBeDefined();
    expect(findings.find((f) => f.severity === 'CRITICAL' && f.evidence.includes('/.git/index'))).toBeDefined();
  });
});
