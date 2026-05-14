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

---

## Carry-overs

- Phase 3.5 will add closure entries here for P1-14 (robots/sitemap regex anchoring), P1-05 (cookie heuristics), P1-15 (tracking vs session cookies), P1-06 (login-form 200 downgrade), P1-11 (subdomain takeover body confirmation).
- Phase 3.7 will append measured per-module FP rates from production telemetry once `finding_disposition` ships.
