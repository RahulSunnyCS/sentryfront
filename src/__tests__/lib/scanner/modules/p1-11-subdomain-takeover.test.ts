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
