/**
 * E2E tests for VibeSafe security-module improvements:
 *   T-01 P1-05  HttpOnly cookie flag
 *   T-02 P1-03  CSP strictness + HSTS validation
 *   T-03 P1-10  DKIM presence probe
 *   T-04 P1-19  DOM XSS surface detection  (new module, R1)
 *   T-05 P1-07  CORS OPTIONS preflight probe (R2)
 *
 * Maps to pipeline/qa-checklist.md — all C-xx and F-xx items are covered here.
 * Every checklist item gets exactly one test (runnable or explicitly skipped).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Architecture — how these tests work without a running server
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * The scanner modules (runCookiesModule, runHeadersModule, runDomXssModule,
 * runDnsEmailModule, runCorsModule) are imported directly into the Playwright
 * test runner's Node.js process — the same technique used by
 * e2e/report-calibration.spec.ts.  Playwright 1.59 compiles TypeScript with
 * esbuild and honours the tsconfig "@/*" path alias, so the imports resolve
 * without launching a browser or a dev server.
 *
 * Modules that make real outbound network calls (P1-07 CORS, P1-10 DKIM)
 * are not safe to call from an E2E test harness because:
 *   - P1-07 fetches the target URL and sends a crafted Origin header — in an
 *     E2E context there is no target to call, and the call might escape to a
 *     real host.
 *   - P1-10 calls dns.resolveTxt() against the real DNS infrastructure.
 * Those checklist items are represented as explicitly skipped tests with a
 * documented reason and a pointer to the relevant Vitest unit tests.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Required env vars
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * None — all runnable tests are pure-logic and need no env vars.
 */

import { test, expect } from '@playwright/test';
import { runCookiesModule } from '@/lib/scanner/modules/p1-05-cookies';
import { runHeadersModule } from '@/lib/scanner/modules/p1-03-headers';
import { runDomXssModule } from '@/lib/scanner/modules/p1-19-dom-xss';
import type { CrawlResult, ParsedCookie } from '@/lib/scanner/types';

// ── CrawlResult factories ─────────────────────────────────────────────────────

/**
 * Minimal CrawlResult for cookie-module tests.
 * Only the `cookies` field is meaningful; everything else is a safe sentinel.
 */
function makeCookieCrawl(cookies: ParsedCookie[]): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers: {},
    cookies,
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
  };
}

/**
 * Minimal CrawlResult for header-module tests.
 * `headers` keys must be lower-cased (HTTP/2 canonical form).
 */
function makeHeaderCrawl(
  headers: Record<string, string>,
  overrides: Partial<CrawlResult> = {},
): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers,
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
    ...overrides,
  };
}

/**
 * Minimal CrawlResult for DOM-XSS module tests.
 * `loadedChunkContents` carries the JS bundle content to analyse.
 */
function makeDomXssCrawl(loadedChunkContents?: Record<string, string>): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
    loadedChunkContents,
  };
}

/** Build a minimal session-like ParsedCookie. */
function makeSessionCookie(overrides: Partial<ParsedCookie> = {}): ParsedCookie {
  return {
    name: 'session',
    value: 'abc123',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    domain: 'example.com',
    path: '/',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// T-01: P1-05 HttpOnly cookie flag
// QA checklist IDs: C-01, C-02, C-03
// ══════════════════════════════════════════════════════════════════════════════

test.describe('T-01 P1-05 — HttpOnly cookie flag', () => {

  /**
   * QA C-01 @critical
   * Session cookie present WITHOUT HttpOnly → finding severity=HIGH.
   */
  test('C-01: session cookie missing HttpOnly emits HIGH finding @critical', () => {
    const crawl = makeCookieCrawl([
      makeSessionCookie({ httpOnly: false }),
    ]);

    const findings = runCookiesModule(crawl);
    const httpOnlyFindings = findings.filter((f) =>
      f.title.toLowerCase().includes('httponly'),
    );

    expect(httpOnlyFindings.length).toBeGreaterThanOrEqual(1);
    expect(httpOnlyFindings[0].severity).toBe('HIGH');
  });


  /**
   * QA C-02 @critical
   * Session cookie WITH HttpOnly → no finding emitted.
   */
  test('C-02: session cookie with HttpOnly flag emits no HttpOnly finding @critical', () => {
    const crawl = makeCookieCrawl([
      makeSessionCookie({ httpOnly: true }),
    ]);

    const findings = runCookiesModule(crawl);
    const httpOnlyFindings = findings.filter((f) =>
      f.title.toLowerCase().includes('httponly'),
    );

    expect(httpOnlyFindings).toHaveLength(0);
  });


  /**
   * QA C-03 @critical
   * Non-session cookie (name: "theme") missing HttpOnly → no finding emitted.
   * The P1-05 HttpOnly check is gated on looksLikeSessionCookie(), which only
   * matches session-like names — theme cookies must not fire.
   */
  test('C-03: non-session cookie "theme" missing HttpOnly emits no finding @critical', () => {
    const crawl = makeCookieCrawl([
      {
        name: 'theme',
        value: 'dark',
        secure: false,
        httpOnly: false,
        sameSite: 'Lax',
        domain: 'example.com',
        path: '/',
      },
    ]);

    const findings = runCookiesModule(crawl);
    const httpOnlyFindings = findings.filter((f) =>
      f.title.toLowerCase().includes('httponly'),
    );

    expect(httpOnlyFindings).toHaveLength(0);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// T-02: P1-03 CSP strictness
// QA checklist IDs: C-04 through C-13
// ══════════════════════════════════════════════════════════════════════════════

test.describe('T-02 P1-03 — CSP strictness', () => {

  /**
   * QA C-04 @critical
   * CSP: script-src 'unsafe-inline' → finding severity=HIGH.
   */
  test("C-04: CSP script-src 'unsafe-inline' emits HIGH finding @critical", async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': "script-src 'unsafe-inline'",
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings.length).toBeGreaterThanOrEqual(1);
    const finding = cspHighFindings[0];
    expect(finding.evidence.toLowerCase()).toContain('unsafe-inline');
  });


  /**
   * QA C-05 @critical
   * CSP: default-src 'unsafe-eval' → finding severity=HIGH.
   */
  test("C-05: CSP default-src 'unsafe-eval' emits HIGH finding @critical", async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': "default-src 'unsafe-eval'",
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings.length).toBeGreaterThanOrEqual(1);
    expect(cspHighFindings[0].evidence.toLowerCase()).toContain('unsafe-eval');
  });


  /**
   * QA C-06 @critical
   * CSP: script-src * (bare wildcard) → finding severity=HIGH.
   */
  test('C-06: CSP script-src bare wildcard (*) emits HIGH finding @critical', async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': 'script-src *',
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings.length).toBeGreaterThanOrEqual(1);
  });


  /**
   * QA C-07 @critical — FALSE-POSITIVE GUARD
   * CSP: script-src 'nonce-abc123' (nonce-only) → NO HIGH finding.
   */
  test("C-07: CSP script-src nonce-only — no HIGH finding (false-positive guard) @critical", async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': "script-src 'nonce-abc123'",
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings).toHaveLength(0);
  });


  /**
   * QA C-08 @critical — FALSE-POSITIVE GUARD
   * CSP: script-src 'nonce-abc123' 'unsafe-inline' → NO HIGH finding.
   * A nonce present in the same directive neutralises unsafe-inline per CSP2.
   */
  test("C-08: CSP nonce neutralises unsafe-inline — no HIGH finding (false-positive guard) @critical", async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': "script-src 'nonce-abc123' 'unsafe-inline'",
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings).toHaveLength(0);
  });


  /**
   * QA C-09 @critical — FALSE-POSITIVE GUARD
   * CSP: script-src *.googleapis.com (scoped wildcard) → NO HIGH finding.
   * Scoped wildcards restrict to a known domain family and must not be flagged.
   */
  test('C-09: CSP scoped wildcard *.googleapis.com — no HIGH finding (false-positive guard) @critical', async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': 'script-src *.googleapis.com',
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings).toHaveLength(0);
  });


  /**
   * QA C-10 @critical — FALSE-POSITIVE GUARD
   * CSP: script-src 'strict-dynamic' 'unsafe-inline' → NO HIGH finding.
   * strict-dynamic overrides host-source lists and neutralises unsafe-inline in CSP3.
   */
  test("C-10: CSP strict-dynamic neutralises unsafe-inline — no HIGH finding (false-positive guard) @critical", async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': "script-src 'strict-dynamic' 'unsafe-inline'",
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings).toHaveLength(0);
  });


  /**
   * QA C-11 @critical
   * HSTS: max-age=3600 (well below threshold) → finding severity=LOW.
   */
  test('C-11: HSTS max-age=3600 (too short) emits LOW finding @critical', async () => {
    const crawl = makeHeaderCrawl({
      'strict-transport-security': 'max-age=3600',
    });

    const findings = await runHeadersModule(crawl);
    // HSTS is present so the MISSING-HSTS MEDIUM finding must NOT fire.
    const hstsMissingFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.title.includes('Missing Strict-Transport-Security'),
    );
    expect(hstsMissingFindings).toHaveLength(0);

    // The short-max-age finding must be LOW.
    const hstsLowFindings = findings.filter(
      (f) =>
        f.moduleId === 'P1-03' &&
        f.severity === 'LOW' &&
        f.evidence.includes('max-age=3600'),
    );
    expect(hstsLowFindings.length).toBeGreaterThanOrEqual(1);
  });


  /**
   * QA C-12 @critical
   * X-Frame-Options absent → finding severity=LOW (unchanged — no recalibration).
   */
  test('C-12: X-Frame-Options absent emits LOW finding @critical', async () => {
    // Pass a minimal set of headers that includes everything EXCEPT x-frame-options
    // so the module has no choice but to flag its absence.
    const crawl = makeHeaderCrawl({
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
    });

    const findings = await runHeadersModule(crawl);
    const xfoFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.title.includes('X-Frame-Options'),
    );

    expect(xfoFindings.length).toBeGreaterThanOrEqual(1);
    expect(xfoFindings[0].severity).toBe('LOW');
  });


  /**
   * QA C-13 @critical
   * SRI missing on cross-origin scripts → finding severity=LOW (no recalibration).
   */
  test('C-13: SRI missing on cross-origin script emits LOW finding @critical', async () => {
    const htmlWithCrossOriginScript =
      '<script src="https://cdn.external.example/lib.js"></script>';

    const crawl = makeHeaderCrawl(
      {
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
      },
      { html: htmlWithCrossOriginScript },
    );

    const findings = await runHeadersModule(crawl);
    const sriFinding = findings.find(
      (f) =>
        f.moduleId === 'P1-03' &&
        f.title.toLowerCase().includes('subresource integrity'),
    );

    expect(sriFinding).toBeDefined();
    expect(sriFinding!.severity).toBe('LOW');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// T-02: P1-03 — CSP + HSTS functional tier
// QA checklist IDs: F-01 through F-05
// ══════════════════════════════════════════════════════════════════════════════

test.describe('T-02 P1-03 — CSP + HSTS (functional tier)', () => {

  /**
   * QA F-01 @functional
   * Content-Security-Policy-Report-Only: default-src * → finding severity=INFO,
   * text notes "report-only".
   */
  test('F-01: CSP-Report-Only default-src * emits INFO finding noting "report-only" @functional', async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy-report-only': 'default-src *',
    });

    const findings = await runHeadersModule(crawl);
    const roFindings = findings.filter(
      (f) =>
        f.moduleId === 'P1-03' &&
        f.severity === 'INFO' &&
        (f.evidence.toLowerCase().includes('report-only') ||
          f.title.toLowerCase().includes('report-only')),
    );

    expect(roFindings.length).toBeGreaterThanOrEqual(1);
  });


  /**
   * QA F-02 @functional
   * HSTS: max-age=31536000 but missing includeSubDomains → finding severity=INFO.
   */
  test('F-02: HSTS max-age=31536000 without includeSubDomains emits INFO finding @functional', async () => {
    const crawl = makeHeaderCrawl({
      'strict-transport-security': 'max-age=31536000',
    });

    const findings = await runHeadersModule(crawl);
    // There must be no MISSING-HSTS finding (header is present).
    const missingHsts = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.title.includes('Missing Strict-Transport-Security'),
    );
    expect(missingHsts).toHaveLength(0);

    // The missing-includeSubDomains finding must be INFO.
    const infoHsts = findings.filter(
      (f) =>
        f.moduleId === 'P1-03' &&
        f.severity === 'INFO' &&
        f.evidence.includes('max-age=31536000') &&
        !f.evidence.includes('includeSubDomains'),
    );
    expect(infoHsts.length).toBeGreaterThanOrEqual(1);
  });


  /**
   * QA F-03 @functional
   * HSTS: max-age=31536000; includeSubDomains (correct) → NO finding.
   */
  test('F-03: HSTS max-age=31536000 includeSubDomains emits no HSTS finding @functional', async () => {
    const crawl = makeHeaderCrawl({
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
    });

    const findings = await runHeadersModule(crawl);
    const hstsFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.title.includes('Strict-Transport-Security'),
    );

    expect(hstsFindings).toHaveLength(0);
  });


  /**
   * QA F-04 @functional
   * CSP: script-src http: (bare HTTP scheme) → finding severity=HIGH.
   */
  test('F-04: CSP script-src http: (bare HTTP scheme) emits HIGH finding @functional', async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': 'script-src http:',
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings.length).toBeGreaterThanOrEqual(1);
  });


  /**
   * QA F-05 @functional
   * CSP: script-src 'sha256-abc123' (hash-only, no unsafe-inline) → NO finding.
   */
  test("F-05: CSP script-src hash-only — no HIGH finding @functional", async () => {
    const crawl = makeHeaderCrawl({
      'content-security-policy': "script-src 'sha256-abc123xyz'",
    });

    const findings = await runHeadersModule(crawl);
    const cspHighFindings = findings.filter(
      (f) => f.moduleId === 'P1-03' && f.severity === 'HIGH',
    );

    expect(cspHighFindings).toHaveLength(0);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// T-03: P1-10 DKIM — skipped (real DNS calls)
// QA checklist IDs: C-14, C-15, F-06, F-07, F-08
// ══════════════════════════════════════════════════════════════════════════════

test.describe('T-03 P1-10 — DKIM / SPF / DMARC (skipped — real DNS calls)', () => {

  /**
   * QA C-14 @critical
   * SPF uses ~all → finding severity=LOW.
   */
  test.skip('C-14: SPF ~all emits LOW finding @critical', () => {
    // Reason: runDnsEmailModule() calls dns.resolveTxt() against live DNS.
    // Playwright E2E cannot mock Node core modules without Vitest vi.mock().
    // Full coverage in src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts.
  });

  /**
   * QA C-15 @critical
   * DMARC p=none → finding severity=LOW.
   */
  test.skip('C-15: DMARC p=none emits LOW finding @critical', () => {
    // Reason: same as C-14 — real DNS dependency.
    // Full coverage in src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts.
  });

  /**
   * QA F-06 @functional
   * DKIM common selector resolves → no finding.
   */
  test.skip('F-06: DKIM selector found — no finding @functional', () => {
    // Reason: real DNS call required to simulate a selector resolution.
    // Full coverage in src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts.
  });

  /**
   * QA F-07 @functional
   * No common DKIM selector resolves → finding severity=INFO, text says "inconclusive".
   */
  test.skip('F-07: DKIM inconclusive — INFO finding text says "inconclusive" not "missing" @functional', () => {
    // Reason: real DNS call required.
    // Full coverage in src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts.
    // Critical language requirement: finding text must say "inconclusive", not "missing".
  });

  /**
   * QA F-08 @functional
   * DNS error during DKIM lookup → graceful handling, treated as inconclusive.
   */
  test.skip('F-08: DNS error during DKIM lookup handled gracefully — inconclusive, no throw @functional', () => {
    // Reason: real DNS call required; error injection needs vi.mock(dns).
    // Full coverage in src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts.
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// T-04: P1-19 DOM XSS detection
// QA checklist IDs: C-16, C-17, C-18, C-19, F-09, F-10
// ══════════════════════════════════════════════════════════════════════════════

test.describe('T-04 P1-19 — DOM XSS surface detection', () => {

  /**
   * QA C-16 @critical
   * document.write(location. found in loadedChunkContents → finding severity=HIGH,
   * confidence=low.
   */
  test('C-16: document.write(location. in bundle content emits HIGH confidence=low finding @critical', () => {
    const crawl = makeDomXssCrawl({
      'https://example.com/chunk.js': 'document.write(location.href);',
    });

    const findings = runDomXssModule(crawl);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].confidence).toBe('low');
  });


  /**
   * QA C-17 @critical
   * eval(location.hash found in loadedChunkContents → finding severity=HIGH,
   * confidence=low.
   */
  test('C-17: eval(location.hash in bundle content emits HIGH confidence=low finding @critical', () => {
    const crawl = makeDomXssCrawl({
      'https://example.com/app.js': 'eval(location.hash.slice(1));',
    });

    const findings = runDomXssModule(crawl);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].confidence).toBe('low');
  });


  /**
   * QA C-18 @critical
   * No loadedChunkContents (static-fetch fallback) → no finding, no error.
   * The module must be a byte-identical no-op when loadedChunkContents is absent.
   */
  test('C-18: absent loadedChunkContents — no finding, no error (graceful no-op) @critical', () => {
    // No loadedChunkContents at all (simulates static-fetch fallback path).
    const crawl = makeDomXssCrawl(undefined);

    let findings: ReturnType<typeof runDomXssModule> | undefined;
    let thrownError: unknown;

    try {
      findings = runDomXssModule(crawl);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeUndefined();
    expect(findings).toBeDefined();
    expect(findings!).toHaveLength(0);
  });


  /**
   * QA C-19 @critical — FALSE-POSITIVE GUARD
   * Generic document.write(varName) with no location source → NO finding.
   * The module must NOT flag sinks without a confirmed URL-controlled source.
   */
  test('C-19: generic document.write(varName) without location source — no finding (false-positive guard) @critical', () => {
    const crawl = makeDomXssCrawl({
      'https://example.com/util.js': 'document.write(someVariable);',
    });

    const findings = runDomXssModule(crawl);

    expect(findings).toHaveLength(0);
  });


  /**
   * QA F-09 @functional
   * innerHTML = location.hash in bundle content → finding severity=HIGH, confidence=low.
   */
  test('F-09: innerHTML = location.hash in bundle content emits HIGH confidence=low finding @functional', () => {
    const crawl = makeDomXssCrawl({
      'https://example.com/app.js': 'element.innerHTML = location.hash;',
    });

    const findings = runDomXssModule(crawl);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].confidence).toBe('low');
  });


  /**
   * QA F-10 @functional — FALSE-POSITIVE GUARD
   * Vendor/framework bundle that uses location.href for NAVIGATION (not a sink)
   * must NOT trigger a false-positive finding.
   *
   * The P1-19 patterns require a confirmed sink+source pair. Bare location.href
   * in an assignment to window.location (navigation) is not a dangerous sink.
   */
  test('F-10: location.href used only for navigation — no false-positive finding @functional', () => {
    // A typical framework router push: no document.write / innerHTML / eval sink.
    const crawl = makeDomXssCrawl({
      'https://example.com/vendor.js': 'window.location.href = nextUrl;',
    });

    const findings = runDomXssModule(crawl);

    expect(findings).toHaveLength(0);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// T-05: P1-07 CORS OPTIONS preflight probe — skipped (real network calls)
// QA checklist IDs: C-20, C-21
// ══════════════════════════════════════════════════════════════════════════════

test.describe('T-05 P1-07 — CORS OPTIONS preflight (skipped — real network calls)', () => {

  /**
   * QA C-20 @critical
   * OPTIONS returns Access-Control-Allow-Origin: <reflected evil origin> with
   * credentials → finding severity=CRITICAL.
   */
  test.skip('C-20: OPTIONS reflected origin with credentials emits CRITICAL finding @critical', () => {
    // Reason: runCorsModule() uses fetch() to send a real HTTP OPTIONS probe.
    // The Playwright E2E context has no target server to probe, and the call
    // would escape to a real host. Mock support requires Vitest's vi.mock(fetch).
    // Full coverage in src/__tests__/lib/scanner/modules/p1-07-cors.test.ts.
  });

  /**
   * QA C-21 @critical
   * GET probe already found CRITICAL CORS → OPTIONS probe skipped (no double-emit).
   */
  test.skip('C-21: existing GET CRITICAL finding causes OPTIONS probe to be skipped @critical', () => {
    // Reason: same as C-20 — real fetch() dependency.
    // Full coverage in src/__tests__/lib/scanner/modules/p1-07-cors.test.ts.
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// Regression guards (all tasks)
// QA checklist IDs: F-11, F-12, F-13
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Regression guards — all tasks', () => {

  /**
   * QA F-11 @functional
   * All 5 modified/created modules pass full pre-existing unit test suite.
   *
   * Skipped: verifies the Vitest suite is green — not a browser/DOM concern.
   */
  test.skip('F-11: all 5 modified modules pass pre-existing unit test suite @functional', () => {
    // Reason: Vitest suite state — run `npm run test` locally or in CI to verify.
  });


  /**
   * QA F-12 @functional
   * P1-05 Secure flag missing → HIGH (unchanged, regression guard).
   */
  test('F-12: session cookie missing Secure flag still emits HIGH finding (regression guard) @functional', () => {
    const crawl = makeCookieCrawl([
      makeSessionCookie({ secure: false, httpOnly: true }),
    ]);

    const findings = runCookiesModule(crawl);
    const secureFlagFindings = findings.filter(
      (f) => f.moduleId === 'P1-05' && f.title.toLowerCase().includes('secure flag'),
    );

    expect(secureFlagFindings.length).toBeGreaterThanOrEqual(1);
    expect(secureFlagFindings[0].severity).toBe('HIGH');
  });


  /**
   * QA F-13 @functional
   * CSP absent → MEDIUM (unchanged, regression guard).
   */
  test('F-13: absent CSP header still emits MEDIUM finding (regression guard) @functional', async () => {
    // Pass headers that have nothing to do with CSP — the missing-CSP finding must fire.
    const crawl = makeHeaderCrawl({
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'x-frame-options': 'SAMEORIGIN',
    });

    const findings = await runHeadersModule(crawl);
    const cspMissingFinding = findings.find(
      (f) =>
        f.moduleId === 'P1-03' &&
        f.severity === 'MEDIUM' &&
        f.title.includes('Content-Security-Policy'),
    );

    expect(cspMissingFinding).toBeDefined();
    expect(cspMissingFinding!.severity).toBe('MEDIUM');
  });

});
