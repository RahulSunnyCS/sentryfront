/**
 * Integration tests for the scanner's new Phase-5 modules.
 *
 * Approach: rather than calling runScanner() (which would invoke the full
 * Playwright crawl against a real URL), we import each module function
 * directly and exercise them against a shared CrawlResult fixture. This
 * validates that:
 *   1. Each module is wired correctly (exports the right function).
 *   2. The function signatures accept a valid CrawlResult.
 *   3. Findings are produced when the right conditions are present in the
 *      crawl data — i.e., the module is responsive to the same input shape
 *      the real crawler produces.
 *   4. Modules are no-ops when the triggering conditions are absent.
 *
 * Tests are kept independent: each builds its own CrawlResult from the
 * factory and asserts in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DNS mock (must be hoisted so it is available when vi.mock factory runs) ──
const { mockResolveTxt } = vi.hoisted(() => ({
  mockResolveTxt: vi.fn(),
}));

vi.mock('dns', () => ({
  promises: { resolveTxt: mockResolveTxt },
  default: { promises: { resolveTxt: mockResolveTxt } },
}));

// ── Module imports (after mocks) ─────────────────────────────────────────────
import { runDomXssModule } from '@/lib/scanner/modules/p1-19-dom-xss';
import { runCookiesModule } from '@/lib/scanner/modules/p1-05-cookies';
import { runHeadersModule } from '@/lib/scanner/modules/p1-03-headers';
import { runDnsEmailModule } from '@/lib/scanner/modules/p1-10-dns-email';
import { runCorsModule } from '@/lib/scanner/modules/p1-07-cors';
import type { CrawlResult, ParsedCookie } from '@/lib/scanner/types';

// ── CrawlResult factory ───────────────────────────────────────────────────────

/**
 * Builds a minimal, valid CrawlResult. Every field required by CrawlResult is
 * populated with a safe default so individual tests only need to override what
 * matters to them.
 */
function makeCrawl(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: 'Next.js',
    ...overrides,
  };
}

/**
 * Minimal ParsedCookie factory. Defaults to a well-formed session cookie with
 * both Secure and HttpOnly so tests can selectively remove flags.
 */
function makeCookie(overrides: Partial<ParsedCookie> = {}): ParsedCookie {
  return {
    name: 'session',
    value: 'test-session-value',
    domain: 'example.com',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    ...overrides,
  };
}

// ── DNS helpers (mirrors p1-10 unit test pattern) ────────────────────────────

/** Configure DNS to return healthy SPF + DMARC, and a DKIM record for 'google'. */
function setupHealthyDns() {
  mockResolveTxt.mockImplementation((name: string) => {
    if (name.startsWith('_dmarc.')) return Promise.resolve([['v=DMARC1; p=reject']]);
    if (name.startsWith('google._domainkey.')) return Promise.resolve([['v=DKIM1; k=rsa; p=abc']]);
    if (name.includes('._domainkey.')) return Promise.resolve([]);
    return Promise.resolve([['v=spf1 include:_spf.google.com -all']]);
  });
}

/** Configure DNS so all lookups return empty arrays (simulates no records). */
function setupEmptyDns() {
  mockResolveTxt.mockResolvedValue([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// P1-19 DOM XSS — registration and basic integration
// ─────────────────────────────────────────────────────────────────────────────

describe('P1-19 registration — DOM XSS module wired into scanner', () => {
  it('produces a P1-19 HIGH finding when loadedChunkContents contains a document.write+location pattern', () => {
    const crawl = makeCrawl({
      loadedChunkContents: {
        'https://example.com/bundle.js': "document.write(location.hash)",
      },
    });

    const findings = runDomXssModule(crawl);

    expect(findings.length).toBeGreaterThan(0);
    const xssFinding = findings.find((f) => f.moduleId === 'P1-19');
    expect(xssFinding).toBeDefined();
    expect(xssFinding!.severity).toBe('HIGH');
    expect(xssFinding!.category).toBe('Client-Side Security');
    expect(xssFinding!.location).toBe('https://example.com/bundle.js');
  });

  it('produces a P1-19 finding when loadedChunkContents contains an innerHTML+location pattern', () => {
    const crawl = makeCrawl({
      loadedChunkContents: {
        'https://example.com/app.js': "el.innerHTML = location.search",
      },
    });

    const findings = runDomXssModule(crawl);

    const xssFinding = findings.find((f) => f.moduleId === 'P1-19');
    expect(xssFinding).toBeDefined();
    expect(xssFinding!.severity).toBe('HIGH');
  });

  it('produces findings from multiple chunks with the same-page CrawlResult shape', () => {
    // Simulates the headless-crawl path where several JS bundles are loaded.
    const crawl = makeCrawl({
      headers: { 'content-security-policy': "default-src 'self'" },
      loadedChunkContents: {
        'https://example.com/vendor.js': "// safe vendor code",
        'https://example.com/app.js': "eval(location.hash)",
        'https://example.com/utils.js': "// no XSS",
      },
    });

    const findings = runDomXssModule(crawl);

    // Only app.js has the XSS pattern; vendor.js and utils.js are clean.
    expect(findings).toHaveLength(1);
    expect(findings[0].location).toBe('https://example.com/app.js');
    expect(findings[0].moduleId).toBe('P1-19');
  });

  it('all required RawFinding fields are populated on a P1-19 finding', () => {
    const crawl = makeCrawl({
      loadedChunkContents: {
        'https://example.com/chunk.js': "setTimeout(location.hash, 0)",
      },
    });

    const findings = runDomXssModule(crawl);
    expect(findings).toHaveLength(1);

    const f = findings[0];
    expect(f.moduleId).toBe('P1-19');
    expect(typeof f.title).toBe('string');
    expect(f.title.length).toBeGreaterThan(0);
    expect(typeof f.evidence).toBe('string');
    expect(f.evidence.length).toBeGreaterThan(0);
    expect(typeof f.explanation).toBe('string');
    expect(f.explanation.length).toBeGreaterThan(0);
    expect(typeof f.impact).toBe('string');
    expect(Array.isArray(f.fixManual)).toBe(true);
    expect(f.fixManual.length).toBeGreaterThan(0);
    expect(typeof f.fixAiPrompt).toBe('string');
    // confidence is always 'low' on this regex-heuristic module
    expect(f.confidence).toBe('low');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-19 module isolation — static-fetch fallback path
// ─────────────────────────────────────────────────────────────────────────────

describe('P1-19 module isolation — static-fetch fallback path is a no-op', () => {
  it('returns no findings when loadedChunkContents is absent (undefined)', () => {
    // The static-fetch fallback path (non-Playwright) does not populate
    // loadedChunkContents. The module must be a pure no-op in this case.
    const crawl = makeCrawl();
    // loadedChunkContents is intentionally not set (undefined)
    expect(crawl.loadedChunkContents).toBeUndefined();

    const findings = runDomXssModule(crawl);

    expect(findings).toHaveLength(0);
  });

  it('returns no findings when loadedChunkContents is an empty object', () => {
    const crawl = makeCrawl({ loadedChunkContents: {} });
    const findings = runDomXssModule(crawl);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when all chunks contain only safe code (no source+sink pairs)', () => {
    const crawl = makeCrawl({
      loadedChunkContents: {
        'https://example.com/safe.js': [
          "window.location.href = '/page';",        // assignment TO location (navigation)
          "document.write('<p>Hello World</p>');",   // generic write, no location source
          "el.innerHTML = sanitize(userInput);",     // no location source
          "eval(myVar);",                            // eval with non-location arg
        ].join('\n'),
      },
    });

    const findings = runDomXssModule(crawl);

    expect(findings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-05 HttpOnly flag — registration and basic integration
// ─────────────────────────────────────────────────────────────────────────────

describe('P1-05 registration — HttpOnly flag check wired into cookies module', () => {
  it('produces a P1-05 HIGH finding with HttpOnly in the title when a session cookie lacks the flag', () => {
    const crawl = makeCrawl({
      cookies: [
        makeCookie({ name: 'session', secure: true, httpOnly: false, sameSite: 'Lax' }),
      ],
    });

    const findings = runCookiesModule(crawl);

    const httpOnlyFinding = findings.find((f) => f.title.includes('HttpOnly'));
    expect(httpOnlyFinding).toBeDefined();
    expect(httpOnlyFinding!.moduleId).toBe('P1-05');
    expect(httpOnlyFinding!.severity).toBe('HIGH');
    expect(httpOnlyFinding!.category).toBe('Cookie & Storage Hygiene');
    expect(httpOnlyFinding!.location).toContain('session');
  });

  it('HttpOnly finding evidence contains the cookie name and "(no HttpOnly)" marker', () => {
    const crawl = makeCrawl({
      cookies: [
        makeCookie({ name: 'auth_token', secure: true, httpOnly: false, sameSite: 'Strict' }),
      ],
    });

    const findings = runCookiesModule(crawl);

    const httpOnlyFinding = findings.find((f) => f.title.includes('HttpOnly'));
    expect(httpOnlyFinding).toBeDefined();
    expect(httpOnlyFinding!.evidence).toContain('no HttpOnly');
  });

  it('does not emit an HttpOnly finding when the flag is present', () => {
    const crawl = makeCrawl({
      cookies: [
        makeCookie({ name: 'session', secure: true, httpOnly: true, sameSite: 'Lax' }),
      ],
    });

    const findings = runCookiesModule(crawl);

    expect(findings.find((f) => f.title.includes('HttpOnly'))).toBeUndefined();
  });

  it('does not emit an HttpOnly finding for non-session cookies missing the flag', () => {
    const crawl = makeCrawl({
      cookies: [
        makeCookie({ name: 'theme', value: 'dark', secure: false, httpOnly: false, sameSite: null }),
      ],
    });

    const findings = runCookiesModule(crawl);

    expect(findings.find((f) => f.title.includes('HttpOnly'))).toBeUndefined();
  });

  it('HttpOnly check is independent of the Secure check — both can fire together', () => {
    // A session cookie missing both flags should produce two separate findings.
    const crawl = makeCrawl({
      cookies: [
        makeCookie({ name: 'session', secure: false, httpOnly: false, sameSite: 'Lax' }),
      ],
    });

    const findings = runCookiesModule(crawl);

    const secureFinding = findings.find((f) => f.title.includes('Secure flag'));
    const httpOnlyFinding = findings.find((f) => f.title.includes('HttpOnly flag'));
    expect(secureFinding).toBeDefined();
    expect(httpOnlyFinding).toBeDefined();
    expect(secureFinding!.severity).toBe('HIGH');
    expect(httpOnlyFinding!.severity).toBe('HIGH');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-03 CSP strictness — checkCsp() registered in headers module
// ─────────────────────────────────────────────────────────────────────────────

describe("P1-03 registration — CSP strictness check (checkCsp) wired into headers module", () => {
  it("produces a HIGH P1-03 finding for CSP containing 'unsafe-inline' alongside the other header checks", () => {
    // A real crawl result with a CSP that has unsafe-inline will produce:
    //   - (no missing-CSP finding — CSP is present)
    //   - (possibly missing other headers)
    //   - one HIGH finding from checkCsp() for unsafe-inline
    const crawl = makeCrawl({
      headers: {
        'content-security-policy': "script-src 'self' 'unsafe-inline'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'camera=()',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      },
    });

    const findings = runHeadersModule(crawl);

    const cspFinding = findings.find((f) => f.title.includes("unsafe-inline"));
    expect(cspFinding).toBeDefined();
    expect(cspFinding!.moduleId).toBe('P1-03');
    expect(cspFinding!.severity).toBe('HIGH');
    expect(cspFinding!.category).toBe('Security Headers');
  });

  it("produces a HIGH P1-03 finding for CSP with 'unsafe-eval' in default-src", () => {
    const crawl = makeCrawl({
      headers: {
        'content-security-policy': "default-src 'self' 'unsafe-eval'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
      },
    });

    const findings = runHeadersModule(crawl);

    const cspFinding = findings.find((f) => f.title.includes("unsafe-eval"));
    expect(cspFinding).toBeDefined();
    expect(cspFinding!.severity).toBe('HIGH');
    expect(cspFinding!.moduleId).toBe('P1-03');
  });

  it('CSP strictness findings coexist with findings from other missing headers in the same result', () => {
    // Only provide CSP (with unsafe-inline) and HSTS; omit other headers so
    // the table generates several missing-header findings. The unsafe-inline
    // HIGH finding should appear in addition to those.
    const crawl = makeCrawl({
      headers: {
        'content-security-policy': "script-src 'self' 'unsafe-inline'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
      },
    });

    const findings = runHeadersModule(crawl);

    const cspStrictness = findings.find((f) => f.title.includes("unsafe-inline"));
    const missingXfo = findings.find((f) => f.title.includes('X-Frame-Options'));

    expect(cspStrictness).toBeDefined();
    expect(cspStrictness!.severity).toBe('HIGH');
    expect(missingXfo).toBeDefined();

    // All findings belong to P1-03
    const nonP103 = findings.filter((f) => f.moduleId !== 'P1-03');
    expect(nonP103).toHaveLength(0);
  });

  it('does not emit an unsafe-inline finding when nonce neutralises it (CSP spec behaviour preserved)', () => {
    const crawl = makeCrawl({
      headers: {
        // nonce present → unsafe-inline is neutralised per CSP2 spec
        'content-security-policy': "script-src 'self' 'unsafe-inline' 'nonce-abc123='",
      },
    });

    const findings = runHeadersModule(crawl);

    expect(findings.find((f) => f.title.includes("unsafe-inline"))).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-03 HSTS validation — checkHsts() registered in headers module
// ─────────────────────────────────────────────────────────────────────────────

describe('P1-03 registration — HSTS validation check (checkHsts) wired into headers module', () => {
  it('produces a LOW P1-03 finding when HSTS max-age is below the 6-month threshold', () => {
    const crawl = makeCrawl({
      headers: {
        'strict-transport-security': 'max-age=3600; includeSubDomains',
        // Provide minimal other headers to keep test focused
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
      },
    });

    const findings = runHeadersModule(crawl);

    const hstsFinding = findings.find((f) => f.title.includes('max-age is too short'));
    expect(hstsFinding).toBeDefined();
    expect(hstsFinding!.moduleId).toBe('P1-03');
    expect(hstsFinding!.severity).toBe('LOW');
    expect(hstsFinding!.evidence).toContain('3600');
  });

  it('HSTS max-age finding and CSP unsafe-inline finding appear together from the same module', () => {
    // Both checkHsts() and checkCsp() run in the same runHeadersModule() call.
    // This verifies they are both registered and their findings are aggregated.
    const crawl = makeCrawl({
      headers: {
        'content-security-policy': "script-src 'self' 'unsafe-inline'",
        'strict-transport-security': 'max-age=3600; includeSubDomains',
      },
    });

    const findings = runHeadersModule(crawl);

    const cspFinding = findings.find((f) => f.title.includes("unsafe-inline"));
    const hstsFinding = findings.find((f) => f.title.includes('max-age is too short'));

    expect(cspFinding).toBeDefined();
    expect(cspFinding!.severity).toBe('HIGH');
    expect(hstsFinding).toBeDefined();
    expect(hstsFinding!.severity).toBe('LOW');
  });

  it('does not emit a max-age finding when HSTS is well-formed (>= 6 months + includeSubDomains)', () => {
    const crawl = makeCrawl({
      headers: {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'camera=()',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      },
    });

    const findings = runHeadersModule(crawl);

    // No HSTS-related findings should be present
    expect(findings.find((f) => f.title.includes('Strict-Transport-Security'))).toBeUndefined();
    expect(findings.find((f) => f.title.includes('max-age'))).toBeUndefined();
  });

  it('produces an INFO finding when HSTS is present and valid but lacks includeSubDomains', () => {
    const crawl = makeCrawl({
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'camera=()',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      },
    });

    const findings = runHeadersModule(crawl);

    const hstsFinding = findings.find((f) => f.title.includes('includeSubDomains'));
    expect(hstsFinding).toBeDefined();
    expect(hstsFinding!.severity).toBe('INFO');
    expect(hstsFinding!.moduleId).toBe('P1-03');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-10 DKIM probe — integration with dns mock
// ─────────────────────────────────────────────────────────────────────────────

describe('P1-10 registration — DKIM probe wired into DNS/email module', () => {
  beforeEach(() => {
    mockResolveTxt.mockReset();
  });

  it('emits an INFO finding when no common DKIM selector resolves', async () => {
    // All DNS responses empty → DKIM inconclusive → INFO
    setupEmptyDns();

    const crawl = makeCrawl({ finalUrl: 'https://example.com' });
    const findings = await runDnsEmailModule(crawl);

    const dkimFinding = findings.find((f) =>
      f.title === 'DKIM presence could not be confirmed via common selectors',
    );
    expect(dkimFinding).toBeDefined();
    expect(dkimFinding!.moduleId).toBe('P1-10');
    expect(dkimFinding!.severity).toBe('INFO');
    expect(dkimFinding!.category).toBe('DNS & Email Security');
  });

  it('does not emit a DKIM finding when a selector resolves to a valid DKIM record', async () => {
    // google._domainkey returns a real DKIM record → DKIM confirmed → no finding
    setupHealthyDns();

    const crawl = makeCrawl({ finalUrl: 'https://example.com' });
    const findings = await runDnsEmailModule(crawl);

    const dkimFinding = findings.find((f) =>
      f.title.includes('DKIM'),
    );
    expect(dkimFinding).toBeUndefined();
  });

  it('DKIM INFO finding coexists with SPF and DMARC findings when all three are absent', async () => {
    // All DNS returns empty → SPF MEDIUM + DMARC MEDIUM + DKIM INFO
    setupEmptyDns();

    const crawl = makeCrawl({ finalUrl: 'https://example.com' });
    const findings = await runDnsEmailModule(crawl);

    const spfFinding = findings.find((f) => f.title === 'No SPF record found');
    const dmarcFinding = findings.find((f) => f.title === 'No DMARC record found');
    const dkimFinding = findings.find((f) => f.title.includes('DKIM'));

    expect(spfFinding).toBeDefined();
    expect(dmarcFinding).toBeDefined();
    expect(dkimFinding).toBeDefined();
    expect(findings).toHaveLength(3);
  });

  it('DKIM probe queries are against the apex domain, not the subdomain', async () => {
    setupHealthyDns();

    // The URL has a subdomain; the module should still probe the apex domain.
    const crawl = makeCrawl({ finalUrl: 'https://app.sub.example.com' });
    await runDnsEmailModule(crawl);

    const dkimCalls = (mockResolveTxt.mock.calls as [string][])
      .map(([name]) => name)
      .filter((name) => name.includes('._domainkey.'));

    expect(dkimCalls.length).toBeGreaterThan(0);
    dkimCalls.forEach((name) => {
      // All DKIM queries must use the apex domain 'example.com', not 'app.sub.example.com'
      expect(name).toContain('._domainkey.example.com');
      expect(name).not.toContain('._domainkey.app.sub.example.com');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-07 CORS OPTIONS probe — integration with fetch mock
// ─────────────────────────────────────────────────────────────────────────────

describe('P1-07 registration — CORS OPTIONS probe wired into CORS module', () => {
  beforeEach(() => {
    // fetch is already globally mocked in vitest.setup.ts (global.fetch = vi.fn()).
    // Reset it before each test so requests from one test do not bleed into another.
    vi.mocked(global.fetch).mockReset();
  });

  it('emits a CRITICAL finding when the OPTIONS preflight reflects any origin with credentials', async () => {
    // GET probe returns a harmless 200; OPTIONS preflight reflects origin with credentials.
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        // First call: GET probe — no CORS headers
        new Response('', {
          status: 200,
          headers: {},
        }),
      )
      .mockResolvedValueOnce(
        // Second call: OPTIONS preflight — reflects evil origin with credentials.
        // Use 200 rather than 204: jsdom's Response constructor rejects null-body
        // status codes (204, 304) in the test environment.
        new Response('', {
          status: 200,
          headers: {
            'access-control-allow-origin': 'https://evil.attacker.example',
            'access-control-allow-credentials': 'true',
            'access-control-allow-methods': 'GET, POST',
          },
        }),
      );

    const crawl = makeCrawl({ finalUrl: 'https://example.com', html: '' });
    const findings = await runCorsModule(crawl);

    const criticalFinding = findings.find(
      (f) => f.moduleId === 'P1-07' && f.severity === 'CRITICAL',
    );
    expect(criticalFinding).toBeDefined();
    expect(criticalFinding!.title).toContain('credentials');
    expect(criticalFinding!.category).toBe('CORS Misconfiguration');
  });

  it('emits no finding when GET and OPTIONS probes return no CORS headers', async () => {
    // Both probes return a clean response with no CORS headers.
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('', { status: 200, headers: {} }),
    );

    const crawl = makeCrawl({ finalUrl: 'https://example.com', html: '' });
    const findings = await runCorsModule(crawl);

    expect(findings.filter((f) => f.moduleId === 'P1-07')).toHaveLength(0);
  });

  it('emits a HIGH finding when GET probe reflects origin without credentials', async () => {
    // GET reflects the evil origin (no credentials) → HIGH
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: {
            'access-control-allow-origin': 'https://evil.attacker.example',
          },
        }),
      )
      .mockResolvedValue(
        // OPTIONS probe — no interesting headers (GET critical already found HIGH,
        // not added to getCriticalUrls so OPTIONS still runs)
        new Response('', { status: 200, headers: {} }),
      );

    const crawl = makeCrawl({ finalUrl: 'https://example.com', html: '' });
    const findings = await runCorsModule(crawl);

    const highFinding = findings.find(
      (f) => f.moduleId === 'P1-07' && f.severity === 'HIGH',
    );
    expect(highFinding).toBeDefined();
    expect(highFinding!.category).toBe('CORS Misconfiguration');
  });

  it('is a no-op when fetch throws (network error silently skipped)', async () => {
    // The module catches fetch errors internally and continues — no findings.
    vi.mocked(global.fetch).mockRejectedValue(new Error('ECONNREFUSED'));

    const crawl = makeCrawl({ finalUrl: 'https://example.com', html: '' });
    const findings = await runCorsModule(crawl);

    expect(findings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-module: shared CrawlResult drives multiple modules independently
// ─────────────────────────────────────────────────────────────────────────────

describe('cross-module — shared CrawlResult is independently consumed by each module', () => {
  it('P1-19 and P1-05 produce independent findings from a shared CrawlResult fixture', () => {
    // A single crawl result with both a DOM XSS chunk AND a session cookie
    // missing HttpOnly should produce findings from both modules independently.
    const sharedCrawl = makeCrawl({
      cookies: [
        makeCookie({ name: 'session', secure: true, httpOnly: false, sameSite: 'Lax' }),
      ],
      loadedChunkContents: {
        'https://example.com/bundle.js': "document.write(location.hash)",
      },
    });

    const xssFindings = runDomXssModule(sharedCrawl);
    const cookieFindings = runCookiesModule(sharedCrawl);

    // P1-19 should find the DOM XSS pattern
    expect(xssFindings.find((f) => f.moduleId === 'P1-19')).toBeDefined();

    // P1-05 should find the missing HttpOnly flag
    expect(cookieFindings.find((f) => f.title.includes('HttpOnly'))).toBeDefined();

    // Neither module's output references the other module's ID
    expect(xssFindings.every((f) => f.moduleId === 'P1-19')).toBe(true);
    expect(cookieFindings.every((f) => f.moduleId === 'P1-05')).toBe(true);
  });

  it('P1-03 and P1-19 produce independent findings from a shared CrawlResult fixture', () => {
    // A crawl with both a weak CSP (unsafe-inline) AND a DOM XSS chunk.
    const sharedCrawl = makeCrawl({
      headers: {
        'content-security-policy': "script-src 'self' 'unsafe-inline'",
      },
      loadedChunkContents: {
        'https://example.com/app.js': "el.innerHTML = document.referrer",
      },
    });

    const headerFindings = runHeadersModule(sharedCrawl);
    const xssFindings = runDomXssModule(sharedCrawl);

    // P1-03 CSP strictness finding present
    expect(headerFindings.find((f) => f.title.includes("unsafe-inline"))).toBeDefined();
    // P1-19 DOM XSS finding present
    expect(xssFindings.find((f) => f.moduleId === 'P1-19')).toBeDefined();

    // No cross-contamination
    expect(headerFindings.every((f) => f.moduleId === 'P1-03')).toBe(true);
    expect(xssFindings.every((f) => f.moduleId === 'P1-19')).toBe(true);
  });
});
