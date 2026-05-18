# Epic: Security Module Improvement

| Field      | Value                                          |
|------------|------------------------------------------------|
| Status     | Completed                                      |
| Date       | 2026-05-18                                     |
| Branch     | claude/review-security-module-PR98q            |
| Tasks      | T-01, T-02, T-03, T-04, T-05                  |
| Risk level | HIGH                                           |

## 1. What was done

- **T-01 — P1-05: HttpOnly cookie check.** Added a new check inside the existing cookie module that flags session cookies missing the `HttpOnly` attribute at `severity=HIGH`. Only cookies that match the existing `looksLikeSessionCookie()` heuristic are in scope; non-session cookies and correctly flagged cookies are silently ignored. This mirrors the existing `Secure` flag check in structure.

- **T-02 — P1-03: CSP strictness parser and HSTS parameter validation.** Added two new bespoke functions to the headers module. `checkCsp()` analyses the `Content-Security-Policy` (and `Content-Security-Policy-Report-Only`) header for concrete weaknesses: `unsafe-inline` without a nonce or hash, `unsafe-eval`, and bare wildcard sources (`*`, `http:`, `https:`). It correctly suppresses findings when `strict-dynamic` or a nonce/hash is present, since those neutralise the weakness in CSP2/3. `checkHsts()` validates the `Strict-Transport-Security` header's `max-age` value against a 6-month minimum threshold and checks for `includeSubDomains`.

- **T-03 — P1-10: DKIM best-effort probe and PSL-aware apex extraction.** Added a parallel DNS probe against 9 common DKIM selectors (`google`, `mail`, `selector1`, `selector2`, `default`, `mandrill`, `sendgrid`, `smtp`, `dkim`) using `Promise.allSettled`, so a resolver error on one selector does not abort the rest. If none of the 9 selectors resolve, the finding is emitted at `severity=INFO` and explicitly framed as inconclusive rather than a confirmed absence. Also fixed a correctness bug: the apex domain used for SPF, DMARC, and DKIM lookups was previously computed as `hostname.split('.').slice(-2).join('.')`, which produces the wrong domain for multi-part public suffixes (`.co.uk`, `.com.au`, `.gov.uk`). The fix uses the `tldts` library to extract the registrable domain, falling back to the old slice only when `tldts` cannot resolve it.

- **T-04 — P1-19: New DOM-based XSS surface detection module.** A new module (`p1-19-dom-xss.ts`) that scans the JavaScript bundle chunks captured during a headless crawl (`crawl.loadedChunkContents`) for four confirmed source+sink patterns: `document.write(location...)`, `innerHTML = ...location...` (within 80 characters), `eval(location...)`, and `setTimeout(location...)`. Findings are emitted at `severity=HIGH, confidence=low` to signal that they require human code review before treating as exploitable. Total findings are capped at 10 per scan. The module is a complete no-op when `loadedChunkContents` is absent (the static-fetch fallback path), making it byte-identical in behaviour to the pre-feature state for sites that cannot be headlessly crawled.

- **T-05 — P1-07: CORS OPTIONS preflight probe.** Extended the CORS module with a second pass that sends an `OPTIONS` preflight request (with `Origin: https://evil.attacker.example`, `Access-Control-Request-Method: DELETE`, `Access-Control-Request-Headers: Authorization`) to each URL that was already probed by the existing GET pass. The OPTIONS pass checks for reflected-origin responses (CRITICAL with credentials, HIGH without) and for preflight responses that permit destructive HTTP methods (`DELETE`, `PUT`, `PATCH`) on non-API paths (MEDIUM). The OPTIONS probe is skipped for any URL where the GET pass already found a CRITICAL finding, avoiding redundant requests. Also fixed a critical probe-cap bug from Phase 4 review: the original code guarded the API-path discovery loop with `apiPaths.length < 3` but never pushed to `apiPaths`, so the cap never engaged. The guard is now `urlsToProbe.length < 4`, which correctly limits the total probe set to 1 main URL plus up to 3 API paths.

## 2. How this helps the project

VibeSafe's passive scanner now catches a broader set of real, high-impact misconfigurations that it previously missed entirely. The HttpOnly cookie check and the CSP strictness parser address two of the most common security gaps a site owner will have — session cookie theft via XSS and a permissive content policy that negates the value of having a CSP at all. The DKIM probe and the HSTS parameter check add signal to the email authentication and transport security domains that were previously surfaced as absent-or-not. The DOM XSS module is the only check in the passive suite that looks inside JavaScript bundle content at runtime, which is a meaningful detection surface for client-side vulnerabilities. Together, these changes increase the practical detection value of a free scan for the large fraction of sites that have some security controls in place but have misconfigured them in ways the old checks could not see.

## 3. Limitations and tradeoffs (and why we chose this)

### Accepted Risks (from Phase 4 security audit)

**M1 — NextAuth `__Secure-`/`__Host-` cookie blind spot (Low, accepted).** The `looksLikeSessionCookie()` heuristic does not match cookie names with RFC 6265bis prefixes such as `__Secure-next-auth.session-token`. This means the new HttpOnly check (and the existing Secure and SameSite checks) are silent on the most common Next.js auth library. The task contract explicitly forbade editing `tools/cookies.ts` to keep this task scoped; the fix — stripping the prefix before pattern matching — is logged as a follow-up. The practical impact is lower than it sounds because the `__Secure-` prefix itself requires the browser to enforce `Secure`, so the Secure-flag miss is moot by construction. The HttpOnly miss is real but only bites a deliberate, unusual custom NextAuth cookie configuration.

**M2 — JWT claim classifier produces false positives on mainstream IdP tokens (Low, accepted).** The `looksLikeJWT()` function accepts any 3-part dot-separated value whose middle segment base64-decodes to a JSON object, and the claim key match regex is an unanchored substring (`/role|tier|plan|premium|admin|subscription|is_pro|level/i`). This means cookies from Auth0, Cognito, and Google sign-in that carry legitimate OIDC claims like `role` or a `plan` field will be flagged HIGH. The fix — anchoring the regex to whole claim names and validating the JWT header segment — is deferred. The impact is alert fatigue and false confidence reduction, not a VibeSafe security hole.

**M3 — DOM XSS innerHTML regex has false-negative risk on long minified assignments and bounded false-positive risk on semicolon-free builds (Low, accepted).** The pattern `[^;\n]{0,80}?` that separates `innerHTML =` from a `location` token is a tradeoff: it avoids matching across unrelated statements in most minified code, but the 80-character window misses real concatenation chains longer than 80 characters. The `confidence: 'low'` label and the finding text explicitly call for human code review, which is the correct mitigation. Widening the cap to 160-200 would catch more true positives at a marginal false-positive cost and is noted as a future quality improvement.

**M5 — CORS OPTIONS Allow-Methods check produces false positives from CDN/proxy edge defaults (Low, accepted).** CDNs (Cloudflare, CloudFront, Akamai) and reverse proxies frequently respond to `OPTIONS` with a broad, static `Access-Control-Allow-Methods` that reflects whatever method was requested, regardless of what the origin server actually handles. The `/api/` path filter reduces but does not eliminate this, because sites using `/v1/`, `/graphql/`, or other API prefixes classify genuine API endpoints as "non-API paths." The finding is emitted at MEDIUM with hedged language ("does not appear to be an API endpoint"), which correctly conveys uncertainty. A corroboration approach — requiring the reflected origin check to also pass — would reduce FP rate and is logged as a quality improvement.

### Known False Positive Potential by Module

- **P1-05 (cookies) — JWT claim classifier:** Systematic FP for sites using mainstream IdP tokens with legitimate `role`, `plan`, or similar claims. Partially mitigated by the hedged finding text; fix deferred.
- **P1-03 (CSP strictness):** The `report-only` header path produces INFO findings rather than HIGH, correctly reflecting enforcement reality. No known FP risk in the strictness logic; `strict-dynamic` and nonce/hash neutralisation are correctly implemented.
- **P1-10 (DKIM):** The inconclusive framing eliminates the primary FP risk. Domains using custom or provider-specific selectors (Amazon SES, Postmark, Mailchimp, etc.) will receive an INFO finding even when DKIM is correctly configured; the finding explicitly says this is not a confirmed absence.
- **P1-19 (DOM XSS):** Moderate FP risk on semicolon-free minified builds where an incidental `location` token appears within 80 characters of an `innerHTML` assignment. The `confidence: 'low'` label and the human-review instruction in the finding text are the primary controls. Cap of 10 findings prevents report flooding.
- **P1-07 (CORS OPTIONS):** MEDIUM-rated false positives from CDN-reflected Allow-Methods headers on non-API paths, as described above.

### HSTS `max-age` quoted-value false negative

The `checkHsts()` function extracts `max-age` with the regex `max-age\s*=\s*(\d+)`, which does not match RFC 6797-legal quoted forms such as `max-age="31536000"`. A correctly configured HSTS header with a quoted max-age will be treated as absent, producing a false LOW finding. This form is rare in practice but documented as a known gap (senior review L3).

### CORS probe serialisation budget

Even with the probe cap fixed, the CORS module sends one GET and one OPTIONS request per URL serially, each with an 8-second timeout, for up to 4 URLs. Worst-case per scan: 64 seconds of the 120-second `SCAN_TIMEOUT_MS` budget, leaving other modules to compete for the remaining 56 seconds. P1-07 runs in the Group-1 parallel block, which mitigates the impact, but internal serialisation within the module is a known performance concern. Parallelising across URLs was deferred because the GET-CRITICAL early-break logic would require significant rework.

### DNS lookups without per-query timeouts

P1-10 fires 11 DNS queries per scan (SPF, DMARC, plus 9 DKIM selectors) with no explicit per-lookup timeout beyond what the OS resolver enforces. A black-holed resolver could hold the module open until the scan-level timeout fires. This is acceptable given Group-1 parallelism, but a per-lookup timeout guard is noted as a future robustness improvement.

## 4. Tests the AI ran to verify this works

### Unit tests (Vitest)

All tests ran to completion. The final run recorded 1833 passing tests across 110 test files (1 skipped), with 0 failures and 0 regressions.

| Module | Test file | New test cases added | Result |
|--------|-----------|---------------------|--------|
| P1-05 cookies | `src/__tests__/lib/scanner/modules/p1-05-cookies.test.ts` | 3 (HttpOnly present → no finding; HttpOnly absent on session cookie → HIGH; HttpOnly absent on non-session cookie → no finding) | Pass |
| P1-03 headers | `src/__tests__/lib/scanner/modules/p1-03-headers.test.ts` | 12 (unsafe-inline HIGH; unsafe-eval HIGH; bare wildcard HIGH; nonce neutralises unsafe-inline; hash neutralises unsafe-inline; strict-dynamic neutralises unsafe-inline; scoped wildcard no finding; report-only INFO; HSTS short max-age LOW; HSTS missing includeSubDomains INFO; HSTS correct no finding; absent CSP no double-emit) | Pass |
| P1-10 DNS/email | `src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts` | 4 (one selector resolves → no finding; all selectors empty → INFO inconclusive; DNS error on all selectors → INFO inconclusive; multi-part TLD apex extraction regression guard) | Pass |
| P1-19 DOM XSS | `src/__tests__/lib/scanner/modules/p1-19-dom-xss.test.ts` | 6 (loadedChunkContents absent → empty; document.write(location.) → HIGH; innerHTML = location.hash → HIGH; generic document.write(variable) → no finding; React runtime location reference → no finding; multi-chunk cap at 10) | Pass |
| P1-07 CORS | `src/__tests__/lib/scanner/modules/p1-07-cors.test.ts` | 5 (OPTIONS reflects evil origin with credentials → CRITICAL; OPTIONS reflects evil origin without credentials → HIGH; GET already CRITICAL → OPTIONS probe skipped; DELETE on non-API path → MEDIUM; OPTIONS network error → no exception) | Pass |

Two regressions surfaced during Phase 3 implementation and were fixed before Phase 5: a CORS mock that did not account for the new OPTIONS fetch call, and a P1-03 fixture that encoded a stale finding count. Both were DIRECT regressions classified and fixed within the allowed 2-cycle retry budget.

### Integration tests

`src/__tests__/lib/scanner/integration.test.ts` was updated to cover end-to-end module orchestration including the new P1-19 registration in `scanner/index.ts`. 1833 total tests pass including integration.

### E2E tests

`e2e/security-modules.spec.ts` was written by the E2E Test Writer in Phase 5. The file contains 26 test cases: 18 tagged `@critical`, 6 tagged `@functional`, 2 tagged `@non-blocker` (skipped). Seven test cases for P1-07 CORS probe and P1-10 DNS were marked skip in the E2E suite because they require live outbound DNS and network I/O, which is not safe to perform from an E2E context; those paths are fully covered by Vitest unit tests.

**Automation Gate result: CI-ONLY.** The E2E tests could not be executed locally because the ephemeral execution environment lacks the environment variables (`DATABASE_URL`, `NEXTAUTH_SECRET`, etc.) required for the Next.js dev server to start. This is an EXTERNAL failure — the test code and configuration are correct. The tests are expected to run in GitHub Actions, where secrets are injected. No E2E result (pass or fail) was observed; the gate verdict is CI-ONLY, not FAIL.

## 5. Manual test cases (for human verification)

Group by module. All tests assume a local or staging VibeSafe instance and a target URL under your control where you can set response headers and cookies.

**MTC-1 — P1-05: Session cookie missing HttpOnly triggers HIGH finding**
- Preconditions: A web server you control that sets a cookie named `session` (or `sid`, `auth_token`, or similar name matching the session heuristic) without the `HttpOnly` attribute.
- Steps:
  1. Start your controlled server on a reachable URL. Confirm the `Set-Cookie` header does not include `HttpOnly`.
  2. Submit the URL to VibeSafe and wait for the scan to complete.
  3. In the Security findings section, look for a finding in the "Cookie & Storage Hygiene" category.
- Expected result: A HIGH severity finding titled "Session cookie missing HttpOnly flag" appears, naming the cookie. No finding should appear if the cookie name does not match the session heuristic (e.g. a cookie named `theme`).

**MTC-2 — P1-05: Non-session cookie missing HttpOnly does not trigger a finding**
- Preconditions: A web server that sets only `theme=dark` with no `HttpOnly`.
- Steps:
  1. Submit the URL to VibeSafe.
  2. Inspect all P1-05 findings.
- Expected result: No HttpOnly finding is emitted. The Secure and SameSite checks also do not fire for a non-session cookie.

**MTC-3 — P1-03: CSP with `unsafe-inline` and no nonce triggers HIGH finding**
- Preconditions: A web server that responds with `Content-Security-Policy: script-src 'unsafe-inline' https://cdn.example.com`.
- Steps:
  1. Submit the URL to VibeSafe.
  2. Inspect Security findings, "Security Headers" category.
- Expected result: A HIGH finding "CSP allows 'unsafe-inline' scripts" appears.

**MTC-4 — P1-03: CSP with `unsafe-inline` and a nonce does not trigger a HIGH finding**
- Preconditions: A web server that responds with `Content-Security-Policy: script-src 'nonce-abc123' 'unsafe-inline'`.
- Steps:
  1. Submit the URL to VibeSafe.
  2. Inspect all P1-03 CSP findings.
- Expected result: No HIGH finding for `unsafe-inline`. The nonce neutralises the weakness per CSP2 rules.

**MTC-5 — P1-03: HSTS with short `max-age` triggers LOW finding**
- Preconditions: A web server that responds with `Strict-Transport-Security: max-age=3600`.
- Steps:
  1. Submit the URL to VibeSafe.
  2. Inspect P1-03 findings.
- Expected result: A LOW severity finding "Strict-Transport-Security max-age is too short" appears showing `max-age=3600`. No duplicate MEDIUM "Missing HSTS" finding should appear.

**MTC-6 — P1-03: Well-formed HSTS produces no finding**
- Preconditions: A web server that responds with `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- Steps:
  1. Submit the URL to VibeSafe.
  2. Inspect P1-03 HSTS findings.
- Expected result: No finding related to HSTS max-age or includeSubDomains.

**MTC-7 — P1-10: DKIM present via a common selector produces no DKIM finding**
- Preconditions: A domain whose DNS has a DKIM TXT record at one of the 9 probed selectors (e.g. `google._domainkey.<domain>`). Google Workspace and most large ESPs use one of these selectors.
- Steps:
  1. Submit the URL of a site on that domain.
  2. Inspect P1-10 "DNS & Email Security" findings.
- Expected result: No DKIM finding appears.

**MTC-8 — P1-10: DKIM not found via common selectors produces INFO inconclusive finding**
- Preconditions: A domain using a custom DKIM selector not in the 9-name probe list (or a domain with no DKIM configured).
- Steps:
  1. Submit the URL to VibeSafe.
  2. Inspect P1-10 findings.
- Expected result: An INFO finding "DKIM presence could not be confirmed via common selectors" appears. The finding text says "This is inconclusive" and does not say "DKIM is missing" or "DKIM is not configured".

**MTC-9 — P1-10: Multi-part TLD domain (e.g. `.co.uk`) looks up the correct apex**
- Preconditions: A site on a `.co.uk` or `.com.au` domain that has SPF and DMARC configured on the correct registrable apex.
- Steps:
  1. Submit the site URL to VibeSafe.
  2. Inspect SPF and DMARC findings in P1-10.
  3. Check the `location` field of any finding — it should show the registrable apex (e.g. `example.co.uk`), not the public suffix alone (`co.uk`).
- Expected result: If SPF and DMARC are correctly configured on the apex, no false MEDIUM "No SPF record found" or "No DMARC record found" finding appears.

**MTC-10 — P1-19: DOM XSS pattern in a headless-crawled bundle produces HIGH finding**
- Preconditions: A page whose JavaScript bundle contains the literal string `document.write(location.hash)` or `innerHTML = location.search`. VibeSafe must crawl it via the headless Playwright path (i.e. Playwright must not fall back to the static-fetch path).
- Steps:
  1. Confirm the test page is accessible and renders JavaScript (not server-side-only HTML).
  2. Submit the URL to VibeSafe.
  3. Inspect "Client-Side Security" findings.
- Expected result: A HIGH finding "Potential DOM-based XSS: unvalidated location used in dangerous sink" appears with `confidence: low` and an evidence snippet showing the matched code. The finding text instructs human code review before treating as exploitable.

**MTC-11 — P1-19: Static-fetch fallback path produces no DOM XSS finding and no error**
- Preconditions: A URL that VibeSafe cannot crawl headlessly (e.g. a server that blocks Playwright's User-Agent or a URL that only returns a redirect to a login wall).
- Steps:
  1. Submit the URL to VibeSafe and allow the scan to complete with a static-fetch fallback (check that no headless crawl occurred in the scan log or progress events).
  2. Inspect all findings.
- Expected result: No P1-19 finding appears and the scan completes without error. The absence is correct behaviour, not a failure.

**MTC-12 — P1-07: OPTIONS preflight origin reflection with credentials produces CRITICAL finding**
- Preconditions: A web server that, in response to an `OPTIONS` request with `Origin: https://evil.attacker.example`, replies with `Access-Control-Allow-Origin: https://evil.attacker.example` and `Access-Control-Allow-Credentials: true`.
- Steps:
  1. Configure your test server to reflect the request origin in both the GET and OPTIONS responses, with credentials.
  2. Submit the URL to VibeSafe.
  3. Inspect P1-07 "CORS Misconfiguration" findings.
- Expected result: At least one CRITICAL finding "CORS preflight reflects any origin with credentials" appears. If the GET probe also found CRITICAL for the same URL, the OPTIONS probe should be skipped for that URL (i.e. only one CRITICAL finding per URL).

**MTC-13 — P1-07: Probe cap — scanner sends at most 4 requests per probe type**
- Preconditions: A page whose HTML contains more than 3 distinct `/api/...` path strings (e.g. `/api/users`, `/api/items`, `/api/reports`, `/api/stats`, `/api/session`).
- Steps:
  1. Submit the URL to VibeSafe.
  2. Check the server access log on the target to count inbound requests from VibeSafe.
- Expected result: VibeSafe sends at most 4 GET requests and at most 4 OPTIONS requests (1 main URL + up to 3 API paths), regardless of how many `/api/...` strings appear in the HTML.

## 6. Security and risk notes

**Resolved Critical finding (C1 — P1-07 unbounded probe loop).** The API-path discovery loop in `p1-07-cors.ts` had a broken cap: the guard variable `apiPaths` was declared but never written, so the cap `apiPaths.length < 3` was permanently `0` and the loop ran against every `/api/...` string in the page HTML with no upper bound. This was confirmed Critical by both the senior reviewer and the security auditor. It caused unbounded GET+OPTIONS pairs against targets (a scan DoS for API-string-dense pages and a reputational/abuse concern for VibeSafe as a hosted product). Fixed in Phase 4.5 by switching the guard to `urlsToProbe.length < 4`.

**Resolved Medium finding (M4 — P1-10 wrong-domain DNS lookups).** The naive `slice(-2)` apex extraction computed `co.uk` instead of `example.co.uk` for `.co.uk` domains, causing P1-10 to query SPF, DMARC, and DKIM against the public suffix rather than the registrable domain. This produced false MEDIUM "No SPF record" and "No DMARC record" findings with remediation instructions that told users to add records to `co.uk`, which is nonsensical and harmful. Fixed in the same Phase 4.5 cycle using the `tldts` library for PSL-aware apex extraction.

**Accepted Low findings (M1, M2, M3, M5).** All four were confirmed real by the security auditor but judged Low severity. They are detection-quality issues (false negatives and false positives in the scanner output) with no exploit path against VibeSafe itself. All four are tracked as follow-up work below.

**Feature flag / rollback.** No feature flag gates these changes. The existing `headerCoverageChecks` feature flag governs a different subset of header checks (Referrer-Policy, Permissions-Policy, COOP, COEP) and does not affect the new CSP/HSTS functions. P1-19 can be disabled by removing its call from `scanner/index.ts`; the other modules cannot be toggled without a code change. If any module produces widespread false positives in production, the fastest mitigation is to comment out its call site in `scanner/index.ts` and deploy; a feature-flag gate for per-module on/off is a deferred architecture improvement.

## 7. Follow-ups and deferred work

- **NextAuth `__Secure-`/`__Host-` cookie prefix support (M1).** Extend `SESSION_COOKIE_PATTERNS` in `src/lib/scanner/tools/cookies.ts` to strip RFC 6265bis prefixes before matching, recovering detection of `__Secure-next-auth.session-token` and all other prefixed session cookies. Deferred to keep T-01 scope bounded.

- **JWT claim classifier hardening (M2).** Anchor the claim-key regex to whole names (e.g. `^(role|roles|tier|plan|...)$`) and validate the JWT header segment for `alg`/`typ` before classifying as a JWT. Reduces systematic FPs on mainstream IdP tokens. Deferred because it requires changing a pre-existing check with its own test surface.

- **DOM XSS innerHTML pattern window widening (M3 quality improvement).** Widen the `{0,80}` cap in Pattern 2 to `{0,160}` or `{0,200}` to reduce false negatives on minified concatenation chains. Accept the marginally higher FP rate given the `confidence: low` control is already in place.

- **CORS OPTIONS corroboration requirement (M5 quality improvement).** Only emit the "destructive methods on non-API path" MEDIUM when the OPTIONS response also reflects the forged origin (or the allow-methods value is not trivially equal to the single requested method), reducing CDN-proxy false positives.

- **HSTS quoted `max-age` support (L3).** Update `checkHsts()` regex to handle `max-age="31536000"` per RFC 6797. Low-priority; the form is rare in practice.

- **P1-07 probe parallelisation (L1 performance).** Refactor GET and OPTIONS probes into a single "probe one URL" function and run across all URLs with `Promise.all`, reducing worst-case CORS probe time from ~64s to ~16s for 4 URLs. Requires reworking the CRITICAL early-break logic.

- **Per-lookup DNS timeout (L5).** Add an explicit timeout to each `getTxtRecords` call in P1-10 to cap hang time on unresponsive resolvers, independent of the overall scan timeout.

- **Feature-flag per-module toggle (architecture).** Add a `features.scanModules` map to allow individual P1 modules to be disabled via the `FEATURES` env var without code changes. Low urgency; useful for emergency mitigation in production without a deploy.

## 8. References

- Task contracts: `pipeline/tasks/T-01.json` through `pipeline/tasks/T-05.json`
- Senior review: `pipeline/reviews/senior-review.md`
- Security audit: `pipeline/reviews/security-audit.md`
- Blast-radius validation: `pipeline/reviews/blast-radius-validation.md`
- Automation gate: `pipeline/reviews/automation-gate.md`
- QA checklist: `pipeline/qa-checklist.md`
- Key changed source files:
  - `src/lib/scanner/modules/p1-05-cookies.ts`
  - `src/lib/scanner/modules/p1-03-headers.ts`
  - `src/lib/scanner/modules/p1-10-dns-email.ts`
  - `src/lib/scanner/modules/p1-19-dom-xss.ts` (new)
  - `src/lib/scanner/modules/p1-07-cors.ts`
  - `src/lib/scanner/index.ts`
  - `src/lib/data.ts`
  - `e2e/security-modules.spec.ts` (new)
