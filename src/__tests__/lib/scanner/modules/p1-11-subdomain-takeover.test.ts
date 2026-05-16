import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CrawlResult } from '@/lib/scanner/types';

// `runSubfinder` shells out to a binary that isn't installed in the
// test box. Stub it to return a fixed list of subdomains so the test
// is hermetic.
vi.mock('@/lib/scanner/tools/subfinder', () => ({
  runSubfinder: vi.fn().mockResolvedValue(['app.example.com', 'docs.example.com', 'pages.example.com']),
}));

// `dns.resolveCname` is hit per subdomain. Stub the module so each
// test scenario can dictate per-host responses. `vi.hoisted` is needed
// because vi.mock is hoisted above the file body — a top-level const
// would not exist by the time the mock factory runs.
const { resolveCnameMock } = vi.hoisted(() => ({ resolveCnameMock: vi.fn() }));
vi.mock('dns', () => ({
  promises: {
    resolveCname: (host: string) => resolveCnameMock(host),
  },
  default: {
    promises: {
      resolveCname: (host: string) => resolveCnameMock(host),
    },
  },
}));

import { runSubdomainTakeoverModule } from '@/lib/scanner/modules/p1-11-subdomain-takeover';
import { runSubfinder } from '@/lib/scanner/tools/subfinder';

const mockRunSubfinder = runSubfinder as ReturnType<typeof vi.fn>;

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

interface MockFetch {
  status?: number;
  body?: string;
  reject?: true;
}

function stubFetchByHost(byHost: (host: string) => MockFetch) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      const { host } = new URL(url);
      const r = byHost(host);
      if (r.reject) throw new Error('connection refused');
      return {
        status: r.status ?? 404,
        text: async () => r.body ?? '',
      } as unknown as Response;
    }),
  );
}

describe('P1-11 subdomain takeover — Phase 3.5 body confirmation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resolveCnameMock.mockReset();
  });

  it('flags a dangling GitHub Pages subdomain (CNAME + evidence body)', async () => {
    resolveCnameMock.mockImplementation((host: string) => {
      if (host === 'app.example.com') return Promise.resolve(['oldorg.github.io']);
      return Promise.reject(new Error('NXDOMAIN'));
    });
    stubFetchByHost((host) => {
      if (host === 'app.example.com') {
        return { status: 404, body: "There isn't a GitHub Pages site here." };
      }
      return { status: 404, body: '' };
    });

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings.some((f) => f.location === 'app.example.com')).toBe(true);
  });

  it('does NOT flag a live GitHub Pages subdomain (CNAME match, real body)', async () => {
    resolveCnameMock.mockImplementation((host: string) => {
      if (host === 'app.example.com') return Promise.resolve(['org.github.io']);
      return Promise.reject(new Error('NXDOMAIN'));
    });
    stubFetchByHost((host) => {
      if (host === 'app.example.com') {
        return {
          status: 200,
          body: '<html><body><h1>Welcome to our docs</h1><p>Real content lives here.</p></body></html>',
        };
      }
      return { status: 404, body: '' };
    });

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag when the body fetch fails (timeout / connection refused)', async () => {
    resolveCnameMock.mockImplementation((host: string) => {
      if (host === 'pages.example.com') return Promise.resolve(['unreachable.netlify.app']);
      return Promise.reject(new Error('NXDOMAIN'));
    });
    stubFetchByHost(() => ({ reject: true }));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag when no CNAME resolves for any subdomain', async () => {
    resolveCnameMock.mockRejectedValue(new Error('NXDOMAIN'));
    stubFetchByHost(() => ({ status: 200, body: 'ignored' }));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('flags dangling S3 bucket (NoSuchBucket evidence)', async () => {
    resolveCnameMock.mockImplementation((host: string) => {
      if (host === 'docs.example.com') return Promise.resolve(['orphan.s3.amazonaws.com']);
      return Promise.reject(new Error('NXDOMAIN'));
    });
    stubFetchByHost((host) => {
      if (host === 'docs.example.com') {
        return {
          status: 404,
          body: '<Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>',
        };
      }
      return { status: 404, body: '' };
    });

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings.some((f) => f.location === 'docs.example.com')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Additional branch coverage tests
// ---------------------------------------------------------------------------
describe('P1-11 subdomain takeover — crt.sh fallback path', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resolveCnameMock.mockReset();
    // Make subfinder return empty so crt.sh fallback is exercised
    mockRunSubfinder.mockResolvedValue([]);
  });

  it('falls back to crt.sh when subfinder returns no subdomains', async () => {
    // crt.sh returns one subdomain; that subdomain has no CNAME
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('crt.sh')) {
          return {
            ok: true,
            json: async () => [{ name_value: 'sub.example.com' }],
          } as unknown as Response;
        }
        // subdomain check fetch — no CNAME so this won't be called
        return { status: 404, text: async () => '' } as unknown as Response;
      }),
    );
    resolveCnameMock.mockRejectedValue(new Error('NXDOMAIN'));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when crt.sh returns empty array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      } as unknown as Response),
    );
    resolveCnameMock.mockRejectedValue(new Error('NXDOMAIN'));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when crt.sh fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('crt.sh timeout')),
    );
    resolveCnameMock.mockRejectedValue(new Error('NXDOMAIN'));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when crt.sh returns non-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => [],
      } as unknown as Response),
    );
    resolveCnameMock.mockRejectedValue(new Error('NXDOMAIN'));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    expect(findings).toHaveLength(0);
  });

  it('crt.sh filters out entries that match the apex or do not end with the apex suffix', async () => {
    // Entries: apex itself (filtered), wildcard prefix (filtered after strip), valid subdomain
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('crt.sh')) {
          return {
            ok: true,
            json: async () => [
              { name_value: 'example.com' },          // equals apex — filtered
              { name_value: '*.example.com' },         // strip wildcard → example.com = apex — filtered
              { name_value: 'other.net' },             // wrong domain — filtered
              { name_value: 'valid.example.com' },     // valid subdomain
            ],
          } as unknown as Response;
        }
        return { status: 404, text: async () => '' } as unknown as Response;
      }),
    );
    resolveCnameMock.mockRejectedValue(new Error('NXDOMAIN'));

    const findings = await runSubdomainTakeoverModule(baseCrawl());
    // No CNAME found → no findings
    expect(findings).toHaveLength(0);
    // Verify crt.sh was called
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.some((c: [string]) => c[0].includes('crt.sh'))).toBe(true);
  });
});

describe('P1-11 subdomain takeover — apex hostname handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resolveCnameMock.mockReset();
    mockRunSubfinder.mockResolvedValue([]);
    // No crt.sh subdomains by default
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      } as unknown as Response),
    );
  });

  it('uses full hostname as apex when there are only 2 parts (e.g. example.com)', async () => {
    // A crawl with only 2-part hostname — parts.length === 2, apex = hostname
    const crawl: CrawlResult = {
      finalUrl: 'https://example.com/',
      statusCode: 200,
      headers: {},
      cookies: [],
      jsBundleUrls: [],
      inlineScriptContent: '',
      html: '',
      tls: null,
      stack: '',
    };
    const findings = await runSubdomainTakeoverModule(crawl);
    expect(findings).toHaveLength(0);
  });

  it('extracts apex from a 3-part hostname (sub.example.com → example.com)', async () => {
    // parts.length > 2 → apex = last two parts
    const crawl: CrawlResult = {
      finalUrl: 'https://sub.example.com/',
      statusCode: 200,
      headers: {},
      cookies: [],
      jsBundleUrls: [],
      inlineScriptContent: '',
      html: '',
      tls: null,
      stack: '',
    };
    const findings = await runSubdomainTakeoverModule(crawl);
    expect(findings).toHaveLength(0);
    // runSubfinder should have been called with 'example.com'
    expect(mockRunSubfinder).toHaveBeenCalledWith('example.com');
  });
});
