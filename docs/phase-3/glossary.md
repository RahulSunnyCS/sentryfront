# Glossary

One definition per term, plain English, no security background assumed.

## Security identifiers and scoring

**CVE — Common Vulnerabilities and Exposures.** A unique ID for one specific security bug in one specific piece of software, like `CVE-2018-3721`. Run by MITRE Corporation, mostly funded by the US Government. When someone says "a CVE was disclosed," they mean a bug was given an ID and made public.

**GHSA — GitHub Security Advisory.** GitHub's own vulnerability ID, like `GHSA-fvqr-27wr-82fm`. Often issued before a CVE is, then later linked to one. Same idea as a CVE, just GitHub's namespace.

**CWE — Common Weakness Enumeration.** A taxonomy of *categories* of security bug (e.g. CWE-79: XSS, CWE-89: SQL injection, CWE-22: path traversal). One CWE describes a class of mistake; a CVE is one instance of that mistake in a real product.

**CVSS — Common Vulnerability Scoring System.** A 0.0–10.0 score for how *bad* a CVE would be if exploited, in theory. Derived from a vector string like `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` that describes attack vector, complexity, privileges required, etc. CVSS is purely theoretical — it doesn't say whether anyone is actually exploiting the bug.

**KEV — Known Exploited Vulnerabilities.** A public list run by CISA of CVEs confirmed to be actively exploited in the wild. About 1,500 CVEs out of ~250,000 known. Being on KEV is a strong signal that attackers are using this bug right now.

**EPSS — Exploit Prediction Scoring System.** A daily-updated score from FIRST.org for each known CVE, estimating the probability it will be exploited in the next 30 days. Comes as a raw score (0.0–1.0) and a percentile rank within all CVEs. We use the percentile because raw scores are tiny for most CVEs.

**SBOM — Software Bill of Materials.** A machine-readable list of every component (library, package, version) inside a piece of software. Like an ingredients label. Standard formats: SPDX, CycloneDX. VibeSafe doesn't emit an SBOM directly today; the P1-16 module's findings are conceptually a partial SBOM-plus-CVE-overlay for client-side JS.

## Organizations

**CISA — Cybersecurity and Infrastructure Security Agency.** A US federal agency. Publishes KEV. Issues binding-operational-directives requiring federal agencies to patch KEV-listed CVEs within strict deadlines. KEV data is public-domain.

**FIRST.org — Forum of Incident Response and Security Teams.** A global non-profit. Publishes EPSS. Also maintains the CVSS specification. EPSS data is CC-BY-4.0.

**MITRE.** The non-profit that runs the CVE program. They assign CVE IDs.

**OSV.dev — Open Source Vulnerabilities.** A free vulnerability database run by Google. Aggregates GHSA, RustSec, PyPA advisories, GoVulnDB, etc. into one JSON schema. We hit `api.osv.dev` to look up CVEs for `(ecosystem, name, version)` tuples.

## Scanning approaches

**Passive scan.** Looks at what a site publicly serves (HTML, JS bundles, headers, cookies, TLS) without sending attack traffic. The target isn't modified, no logins are attempted, no exploits are tried. This is what VibeSafe does in Phase 3.

**Active scan / DAST — Dynamic Application Security Testing.** Sends actual attack payloads (test SQL injection strings, XSS probes, path-traversal attempts) to find vulnerabilities. Requires consent and can break things. Lives in Phase 5, not yet shipped.

**SAST — Static Application Security Testing.** Reads the source code (not the running site) and flags patterns that look risky. Examples: ESLint security rules, Semgrep, CodeQL. Different problem from what VibeSafe solves.

**IAST — Interactive Application Security Testing.** Instruments the running application from inside (an agent inside the app server) and watches what user traffic actually does. Hybrid of DAST and SAST. Not in scope for VibeSafe.

**SCA — Software Composition Analysis.** The class of tool that checks "what libraries does this software use, and which ones have known CVEs?" `npm audit`, Snyk, Dependabot, Trivy. VibeSafe's P1-16 module is client-side SCA — it does this analysis on the *deployed* JS bundle, not on `package.json`.

## Web fundamentals

**SPA — Single-Page Application.** A site that renders most of its UI with JavaScript in the browser after an initial near-empty HTML shell loads. Most "AI builder" outputs (Bolt, Lovable, v0, Replit, Cursor) and most React/Vue/Svelte apps work this way.

**SSR — Server-Side Rendering.** The HTML is constructed on the server for each request, then sent fully-rendered to the browser. Next.js Server Components, Rails, Django all do this.

**CSR — Client-Side Rendering.** The opposite of SSR. The server sends an empty shell; the browser runs JS to produce the actual UI. Pure SPAs are CSR.

**SSG — Static Site Generation.** The HTML is pre-built at deploy time (not per request) and served as static files. Astro, Hugo, Jekyll, Next.js static export.

**Chunk.** One piece of compiled JavaScript that the browser loads. Modern bundlers split your app into many chunks: a `main.js`, a `vendor.js` (third-party libraries), and one chunk per code-split route.

**Bundle.** Same idea as chunk — a compiled JS file shipped to the browser. "Bundle" usually implies the *whole* output of the bundler (or one of its top-level files); "chunk" implies *one of the parts*.

**Manifest (build manifest).** A file the bundler emits that lists every chunk in the build, often keyed by route or by entry point. Next.js emits `/_next/static/chunks/_buildManifest.js`; Vite emits `manifest.json`. We probe these to find chunks the browser didn't load on the entry page.

**Network idle.** The headless browser's signal that "the page is done loading itself" — no new network request has started for a short interval (we use ~500 ms with an 8-second cap). We wait for this before snapshotting the rendered DOM.

**Hydration.** The process where a React/Vue/Svelte SPA "wakes up" the initial server-rendered HTML by attaching event listeners and synchronizing state. Until hydration finishes, the page looks normal but is non-interactive.

## Crawl mechanics

**Headless browser.** A real browser (Chromium, Firefox, WebKit) running without a visible window, controlled programmatically. We use Playwright; Puppeteer is the same idea, slightly older API.

**Playwright.** Microsoft's library for driving headless browsers. Apache 2.0. We use it in `crawler.ts` to load the target site exactly as a visitor's Chrome would.

**Strategy A (entry-route render).** Our crawler loads the entry URL in headless Chromium, waits for network idle, and records every JS resource the browser fetched. Covers framework runtime, vendor bundle, and any chunks the entry route synchronously imports.

**Strategy C (framework-manifest scan).** After strategy A, we probe well-known manifest URLs (Next.js, Vite, Nuxt, SvelteKit, Remix). If found, we parse out the listed chunks and fetch each one. Covers route-split chunks for routes the user *didn't* navigate to.

**Strategy B (multi-route render).** Visit additional routes (e.g. `/dashboard`, `/settings`) in the same session. Not yet shipped — deferred to Phase 5 where authenticated / user-driven flows live.

## Library detection

**Fingerprint.** A pattern that identifies "this is library X at version Y" by looking at the file. Could be a regex match on a header comment, on a URL, on the basename, or a cryptographic hash of the whole file.

**SHA-1.** A 40-character cryptographic checksum. Two files with the same SHA-1 are (practically) identical. We use SHA-1 because retire.js's signature DB does — a SHA-1 match means "this chunk is byte-identical to a known shipped version of library X."

**retire.js.** An open-source project (Apache 2.0) that maintains a JSON database of fingerprints for known-vulnerable JS libraries. We use the database; we don't use the CLI. The database lives at `https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/jsrepository.json`; we fetch it at scan time and cache for 24h.

## Common JS vulnerability classes

**XSS — Cross-Site Scripting.** A bug where attacker-supplied content gets executed as code in another visitor's browser. Classic example: jQuery 1.4.4 happily evaluates `$(<URL fragment>)` as HTML, including any `<script>` tag the attacker put there.

**Prototype pollution.** A JS-specific bug where attacker input can modify `Object.prototype`, which silently changes the behavior of every object in the application. lodash 4.17.4 had this via `_.merge({}, JSON.parse(userInput))`.

**Mixed content.** When an HTTPS page loads an HTTP subresource (image, script, iframe). The HTTP request is unauthenticated and tamperable; for scripts and stylesheets this is a full code-injection vector. P1-08 module flags this.

**Insecure direct object reference (IDOR).** When a URL like `/api/users/123` lets you fetch any user's data just by guessing IDs. Active-scanning territory (Phase 5), not passive.

**CSRF — Cross-Site Request Forgery.** A bug where another website can cause a logged-in visitor's browser to make an unwanted authenticated request to your app. Usually mitigated by `SameSite=Lax` cookies and CSRF tokens.

## HTTP / browser security headers

**CSP — Content Security Policy.** An HTTP header that restricts what scripts/styles/iframes a page is allowed to load. `script-src 'self'` means "only load scripts from my own origin." A strong CSP prevents XSS even when there's a code bug.

**HSTS — HTTP Strict Transport Security.** An HTTP header that tells the browser "for the next N seconds, never connect to this domain over plain HTTP, even if the user types `http://`."

**SRI — Subresource Integrity.** A cryptographic hash attached to a `<script>` or `<link>` tag (`integrity="sha384-..."`); the browser refuses to load the resource if its content doesn't match. Protects against compromised CDNs.

**SameSite cookie attribute.** A flag on a Set-Cookie header that says whether the cookie is sent on cross-site requests. `SameSite=Lax` (default in modern browsers) blocks most CSRF.

**Permissions-Policy.** An HTTP header that whitelists which browser features (camera, mic, geolocation, etc.) a page is allowed to use.

**COOP / COEP.** Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy. Headers that isolate your page from Spectre-class attacks and enable `SharedArrayBuffer`. Mostly relevant if you use Web Workers heavily.

## Infrastructure

**Upstash.** A hosted Redis service we use for cross-worker caches (KEV CVE set, EPSS records, OSV results, retire.js signature DB). When `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars are set, our cache helpers use it; otherwise they fall back to an in-process Map (single worker, lost on restart).

**Vitest.** Our test runner. Sets `VITEST=true` in the environment, which our cache helpers detect and use to bypass caching entirely — every test gets a clean canned response. See `docs/core/FIXTURE_GUIDE.md` for the fixture authoring guide.

**Module-failure isolation.** A pattern in `src/lib/scanner/index.ts` and inside every scanner module: every module's entry point is wrapped in `try/catch`, so a bug or external-feed outage in one module never aborts the whole scan. The module returns `[]` (no findings) and the rest of the scan proceeds.

## Related docs

- [`./README.md`](./README.md) — Phase 3 doc index.
- [`../core/SEVERITY_RUBRIC.md`](../core/SEVERITY_RUBRIC.md) — Severity-tiering rubric.
- [`../core/SCAN_COVERAGE.md`](../core/SCAN_COVERAGE.md) — Module-by-module catalogue of what we scan for.
- [`../core/FIXTURE_GUIDE.md`](../core/FIXTURE_GUIDE.md) — How to write per-module fixture tests.
