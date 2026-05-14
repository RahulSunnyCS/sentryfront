# Module Quality Ledger

Living record of FP closures, regression nets, and measured FP rates per scanner module. Created in Phase 3.4; populated incrementally as 3.5 patches and 3.7 telemetry land.

**Conventions:**

- A "closure" entry names the docs/blog/comment pattern that used to FP, the fix, and the regression fixture that locks it in.
- Once Phase 3.7 telemetry ships, each module gets a numeric FP rate alongside its qualitative entries.
- Modules without entries here have not had targeted FP work yet.

---

## P1-08 — Mixed Content

**Phase 3.4 closure:** docs-page / blog-post FP.

- *Trigger:* a page whose `<pre>` or `<code>` block displayed example markup like `<script src="http://example.com/lib.js">` (often HTML-encoded) used to fire the mixed-content regex against the literal text. HTML comments that referenced a deprecated HTTP CDN had the same effect.
- *Fix:* module now reads `crawl.cleanedHtml` (Phase 3.4 preprocessing) instead of `crawl.html`. `cleanHtml()` removes `<!-- ... -->`, `<script>` / `<style>` bodies, and `<pre>` / `<code>` / `<samp>` bodies while preserving every opening tag and its attributes — so a production `<script src="http://...">` still matches but a docs example does not.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-08-mixed-content.test.ts` → `Phase 3.4: DOM-aware FP suppression` describe block (docs `<pre><code>`, HTML comment, mixed real + docs).

## P1-12 — Error & Stack Trace Disclosure

**Phase 3.4 closure:** custom-404-with-example FP.

- *Trigger:* sites that route unknown paths to a marketing or docs page whose `<pre><code>` blocks contain example stack traces ("here's what an Express error looks like…") used to fire the Node.js / Python / SQL / connection-string regexes. HTML-comment examples (`<!-- example: postgres://user:pass@... -->`) had the same effect.
- *Fix:* probe response bodies pass through `cleanHtml()` before the disclosure regexes run. Snippet evidence is also sourced from the cleaned body so the match index stays valid.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-12-error-disclosure.test.ts` (Phase 3.4 FP suppression + a positive case proving real Node stack traces still fire).

## P1-13 — Exposed Development Interface

**Phase 3.4 closure:** keyword-in-docs FP for `swagger`, `openapi`, `PHP Version`.

- *Trigger:* probes for `/swagger`, `/swagger-ui.html`, `/api-docs`, `/openapi.json`, `/phpinfo.php` used `body.includes('swagger')` / `body.includes('PHP Version')` style substring matching. A 404 page that mentioned the keyword inside a `<code>` block or HTML comment ("we use OpenAPI internally — here's an example schema…") used to FP at MEDIUM/HIGH severity.
- *Fix:* probe response bodies pass through `cleanHtml()` before `probe.detect()`. JSON-bodied true positives (Spring `_links`, GraphQL `__schema`, OpenAPI JSON) are unaffected since `cleanHtml` only touches HTML structures.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-13-dev-interfaces.test.ts` (FP cases for Swagger-in-docs and PHPInfo-in-comment, plus positives proving real Swagger UI and real phpinfo still fire).

## P1-14 — robots.txt & Sitemap

**Phase 3.5 closure:** unanchored `/api/v\d` regex matching legitimate public subpaths.

- *Trigger:* `SENSITIVE_PATH_PATTERNS` contained `/\/api\/v\d/i` (no anchor). A robots.txt listing `Disallow: /api/v2/docs` or `Disallow: /api/v1/health` was flagged as a sensitive-path leak even though those subpaths are legitimately public.
- *Fix:* anchor to `/\/api\/v\d+\/?$/i` so only `/api/v2`, `/api/v3/`, etc. (the bare API root — the actual disclosure concern) match.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-14-robots-sitemap.test.ts` (Disallow `/api/v2/docs` and `/api/v1/health` produce no findings; Disallow `/api/v2` and `/api/v3/` still flag).

## P1-05 — Cookie Security Attributes

**Phase 3.5 closure:** `auth_*` flow-state cookies being misclassified as session cookies.

- *Trigger:* `looksLikeSessionCookie` used `/^auth/i`, which fired on any cookie name beginning with "auth" — including `auth_timeout`, `auth_context`, `auth_redirect`, `auth_url`, `auth_callback`. None of these are session identifiers; they're transient values for login flow state. The old heuristic produced HIGH "missing Secure flag" / MEDIUM "missing SameSite" findings on cookies that don't carry session identity.
- *Fix:* heuristic extracted to shared `src/lib/scanner/tools/cookies.ts` and tightened to `/^auth(?:[._-]?(?:token|session|id))?$/i`. Matches `auth`, `auth_token`, `auth-token`, `auth.token`, `authtoken`, `auth_session`, `authsession`, `auth_id`, `authid`. Does **not** match `auth_timeout`, `auth_context`, `auth_redirect`, etc.
- *Regression fixtures:* `src/__tests__/lib/scanner/tools/cookies.test.ts` (heuristic-level negatives + positives) and `src/__tests__/lib/scanner/modules/p1-05-cookies.test.ts` (integration: flow-state cookies produce zero findings; `auth_token` missing Secure still flags HIGH).

## P1-15 — Cache Configuration

**Phase 3.5 closure:** tracking cookies (`_ga`, `_gid`, `_fbp`) being treated as session cookies for the no-store gate.

- *Trigger:* `looksAuthenticated` returned `true` whenever `cookies.length > 0`. A static marketing page that sets only Google Analytics (`_ga`, `_gid`) cookies was flagged with MEDIUM "missing Cache-Control: no-store" findings even though no session identity exists on the response.
- *Fix:* `looksAuthenticated` now calls `cookies.some(looksLikeSessionCookie)` (shared util from `tools/cookies.ts`). Tracking cookies no longer gate the cache check. Real session cookies (`connect.sid`, `next-auth.session-token`, etc) still do, and `Authorization` / `X-Auth-*` header checks remain.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-15-cache.test.ts` — `_ga`/`_gid`, `_fbp`/`_gcl_au`, `intercom-id`/`mp_mixpanel` produce zero findings; `session` / `connect.sid` still gate the no-store check; `Authorization` header gates independently of cookies.

## P1-06 — Sensitive Path Exposure

**Phase 3.5 closure:** properly-gated admin pages returning 200 with a login form being flagged as exposed.

- *Trigger:* a 200 response on `/admin`, `/dashboard`, `/wp-admin` etc. that differed sufficiently from the baseline body counted as a "non-404 hit" — even when the body was a sign-in challenge form. Authentication walls aren't exposure.
- *Fix:* `probeOne` now sniffs the first 30 KB of any 200 body for login-form indicators (`<input type="password">`, `<input name="password">`, `<form action="…login/signin/signon/auth…">`). When any pattern matches, the probe is suppressed entirely — a login challenge is the gate working, not a finding.
- *Decision:* the sniff applies to all SUSPICIOUS_CODES paths, not just admin-like ones. A `.env` request rendering a login form means the site routes everything to the auth page; suppressing is safer than flagging.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-06-sensitive-paths.test.ts` — `/admin` with login form produces zero findings; `/admin` with a real dashboard body still flags HIGH; `/.env` with credential-looking content still flags CRITICAL.

## P1-11 — Subdomain Takeover

**Phase 3.5 closure:** CNAME-suffix matches being flagged without body confirmation.

- *Trigger:* `checkSubdomainTakeover` had a fallback that returned a finding whenever the CNAME suffix matched a known service (`github.io`, `netlify.app`, etc.), even when the body fetch failed *or* succeeded with normal content. Every live `username.github.io` page tripped a HIGH "subdomain may be vulnerable to takeover" finding.
- *Fix:* require the HTTP response body to contain the service-specific dangling-evidence string ("There isn't a GitHub Pages site here.", "NoSuchBucket", "The deployment could not be found", etc). DNS or connection failure → no finding. The conservative tradeoff (some real takeovers where the target is unreachable get missed) was made deliberately to eliminate the live-page FP class.
- *Regression fixtures:* `src/__tests__/lib/scanner/modules/p1-11-subdomain-takeover.test.ts` — dangling GitHub Pages + S3 still flag; live GitHub Pages + connection refused + no-CNAME all produce zero findings.

---

## Carry-overs

- Nuxt / SvelteKit / Remix manifest probes (carry from Phase 3.1 Strategy C) remain unimplemented.
- Phase 3.7 will append measured per-module FP rates from production telemetry once `finding_disposition` ships.
