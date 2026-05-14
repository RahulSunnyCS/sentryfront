# 3.2 — Client-side dependency vulnerability scanning (module P1-16)

**TL;DR (60 seconds):**
- For every JS chunk the browser loaded, we identify which third-party library and version it is (jQuery 1.4.4, lodash 4.17.4, Bootstrap 3.3.7, etc.) using retire.js's signature database, then ask OSV.dev whether that exact version has known CVEs.
- This is `npm audit` for the **deployed** bundle. What `package.json` says and what `webpack`/`vite` actually shipped to your visitors can differ wildly — only the deployed copy matters for runtime security.
- Headline limit: a chunk whose minifier stripped all comments, whose URL is opaque, and whose SHA-1 isn't a known build, is invisible to us. Sourcemaps, recognisable CDN URLs, or upstream upgrades fix it.

## What this does, in one paragraph

For every JavaScript file the browser actually loaded (see [3.1](./01-headless-crawl.md)), we identify which third-party libraries are inside it (jQuery, lodash, Bootstrap, etc.) and what version. We then ask a public CVE database whether that exact version has any known security holes. If yes, we emit a finding with the library name, the version, the CVE IDs, and a fix recommendation. This is the same idea as `npm audit`, but applied to the *deployed* bundle rather than your `package.json` — because what your visitors actually receive can differ from what your dev box has installed.

## Terms used in this doc

| Term | Meaning |
|---|---|
| **CVE** (Common Vulnerabilities and Exposures) | A unique ID for a specific security bug, like `CVE-2018-3721`. Run by MITRE, mostly funded by the US Government. Every CVE is one bug in one piece of software. |
| **GHSA** (GitHub Security Advisory) | GitHub's own ID, like `GHSA-fvqr-27wr-82fm`. Often issued before a CVE is, then later linked. Same idea. |
| **CVSS** (Common Vulnerability Scoring System) | A 0.0–10.0 score for how bad a CVE is, in theory. CVSS 9.5 = "complete pwnage if exploited." CVSS 4.2 = "annoying but limited." Computed from a vector like `AV:N/AC:L/PR:N/UI:N/...`. Covered in detail in [3.3](./03-exploit-intel-severity-tiering.md). |
| **SCA** (Software Composition Analysis) | The class of tool this is. SCA = "look at all the libraries this project uses and tell me if any of them are known to be vulnerable." `npm audit`, Snyk, Dependabot, Trivy — all SCA tools. |
| **Fingerprint** | A pattern that identifies "this is library X at version Y" by looking at the file. Could be a regex match on a header comment, a regex on a URL, or a cryptographic hash of the whole file. |
| **SHA-1 hash** | A 40-character cryptographic checksum of a file. Two files with the same SHA-1 are (practically) identical. We use SHA-1 because retire.js's signature DB does. |
| **OSV.dev** | An open vulnerability database run by Google. Free public API. Aggregates GHSA, CVE, RustSec, PyPI advisories, etc., into one schema. |
| **retire.js** | An open-source project (Apache 2.0) that maintains fingerprints for known-vulnerable JS libraries. We use its fingerprint database; we do not use its CLI. |

## Why this matters for security

The libraries shipped in your production bundle are running in every visitor's browser. If `vendor.js` ships jQuery 1.4.4:

- It has `CVE-2011-4969` — XSS via `location.hash`. Any page that calls `$(...)` on URL fragment content is vulnerable, *forever*, on every visit.
- There is no server-side patch. No WAF rule helps. No header configuration helps. The vulnerable code runs in the visitor's browser.
- The only fix is upgrading the library and rebuilding the bundle.

Most "AI-built" SPAs ship a *lot* of third-party JavaScript and don't ship the versions you'd expect: themes and templates often pin to old versions, demo code copy-pasted from Stack Overflow brings stale CDN URLs, and `npm audit` only sees `package.json` — not what `webpack`/`vite` actually output.

P1-16 catches what's actually in the bundle.

## How it works

### Step 1 — collect the JS to scan

File: `src/lib/scanner/modules/p1-16-client-deps.ts:59` (`collectChunks`).

The headless crawler from [3.1](./01-headless-crawl.md) already populated `crawl.loadedChunkContents` with `{ url: jsBody }` for every chunk the browser loaded (Strategy A) plus everything found via framework manifests (Strategy C). P1-16 reads that map directly. Caps: 30 chunks per scan, 2 MB per chunk.

If the headless crawler couldn't run (fetch-only fallback), we instead fetch up to 10 of the `<script src>` URLs from the entry HTML ourselves. Lower coverage, but better than nothing.

### Step 2 — fingerprint libraries with retire.js

File: `src/lib/scanner/tools/retire.ts`.

`retire.js` maintains a JSON file (`jsrepository.json`) listing every known-vulnerable JS library, with multiple ways to identify "is this jQuery? what version?":

| Signal | Example |
|---|---|
| **URI regex** | URL matches `/jquery-([0-9.]+)\.min\.js$` → library = jquery, version = capture group |
| **Filename regex** | Last path segment matches `^lodash-([0-9.]+)\.js$` |
| **filecontent regex** | First 8 KB of the body contains `/*! jQuery v(\\d[\\d.]*)`. This is what most modern minified bundles match on — header comments survive minification. |
| **SHA-1 hash** | Exact 40-char file checksum matches a known-shipped version. Used when minification has stripped all comments. |

We evaluate all four signals against every chunk. We deliberately skip retire.js's two "active" signals — `func` (runs JS expressions) and `ast` (parses to AST) — because passive scanning means we never execute or deeply parse the target's code.

A match emits a `DetectedComponent`: `{ library, version, chunkUrl, detection, npmName }`.

#### Sourcing of the signature database

The signature DB ships in two layers:

1. **Live source (primary).** At scan time we fetch `https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/jsrepository.json` and cache it for 24 hours, using the same Upstash-Redis-plus-in-memory pattern as the KEV and EPSS feeds (see [3.3](./03-exploit-intel-severity-tiering.md)). New CVEs that retire.js publishes upstream show up on our next cache miss — no manual refresh, no version bump.
2. **Vendored baseline (fallback).** A snapshot of `jsrepository.json` is committed under `src/lib/scanner/tools/data/jsrepository.json`. We use it for offline scans, cold starts before the cache populates, and test determinism (vitest bypasses the cache). It also means a GitHub outage can't blind the scanner — we degrade to "slightly stale but still working."

Why not just `npm install retire` and import the JSON? The `retire` npm package (v5+) doesn't bundle the signature DB anymore — its CLI downloads the same GitHub URL we do. So adding it as a dependency would give us the CLI but no JSON, plus a transitive dependency footprint we don't need.

Failure model: fetch fails (5xx, timeout, parse error) → log a warn → use the vendored baseline → scan continues. Production is never blocked on RetireJS's GitHub availability.

### Step 3 — look up CVEs in OSV.dev

File: `src/lib/scanner/tools/osv.ts`.

OSV.dev is a free public CVE database with a JSON API:

1. **`POST /v1/querybatch`** — we send all `(ecosystem='npm', name, version)` tuples in one request. OSV returns, for each tuple, the list of vuln IDs (GHSA-* or CVE-*) that affect it.
2. **`GET /v1/vulns/<id>`** — for each unique vuln ID returned, we fetch the full record: summary, references, severity (the CVSS vector), aliases (the CVE ID if the primary ID was a GHSA).

Both calls are wrapped in 24-hour caches (`src/lib/scanner/tools/osv-cache.ts`) keyed on `(ecosystem, name, version)` and on the vuln ID respectively. Cache backend: Upstash Redis when env-configured (cross-worker, persistent), in-process Map otherwise.

If either OSV call fails (timeout, 5xx, malformed body), we return an empty list for that tuple and the scan continues. We never abort a scan because OSV is having a bad day.

### Step 4 — pick out CVE IDs and CVSS scores

File: `src/lib/scanner/modules/p1-16-client-deps.ts:151`.

For each detected component:

- Walk the OSV vulns; prefer the `CVE-*` alias when present (more recognizable to readers), fall back to the OSV ID.
- For each vuln, parse the CVSS base score out of `vuln.severity`. OSV stores CVSS as a vector string like `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`; we extract the numeric base score with a small regex (`src/lib/scanner/tools/osv.ts:148`).

The result is a list per component: `{ cves: string[], cvssScores: number[] }`. Severity is then resolved by the [3.3 rubric](./03-exploit-intel-severity-tiering.md).

### Step 5 — emit a finding

`src/lib/scanner/modules/p1-16-client-deps.ts:100` (`buildFinding`). One `RawFinding` per vulnerable component:

```
Title:    "jquery 1.4.4 has 1 known vulnerability"
Severity: HIGH         (per the 3.3 rubric — was MEDIUM under the 3.2 stub)
Location: https://target.example/static/jquery.min.js
Evidence: Library: jquery@1.4.4 in <chunk url>
          CVEs: CVE-2011-4969
Fix:      "Upgrade jquery to the latest patched version..."
```

The finding also carries `kevMatch` (was the CVE on CISA's actively-exploited list?) and `epssPercentile` (FIRST.org's exploit-likelihood ranking) — those come from 3.3.

## Failure modes (all graceful)

| Scenario | Outcome |
|---|---|
| Headless crawler didn't run | Fall back to fetching top-10 `<script src>` URLs from entry HTML. Lower coverage, same code path. |
| OSV.dev unreachable | Skip vulnerability lookup for affected tuples. Module returns no findings rather than erroring. |
| Chunk over 2 MB | Skipped. Most minified vendor bundles are 200–800 KB; >2 MB is usually a CSS-in-JS dump or sourcemap. |
| Chunk count over 30 | Skipped after the 30th. Practically always sufficient. |
| Hydrated vuln list over 50 | Stop hydrating. Caller doesn't need every record — the worst CVSS dominates the rubric. |
| Library detected but OSV returns no vulns | No finding. Detection alone isn't a vulnerability; modern jQuery is fine. |
| OSV returns no parseable CVSS | Score treated as `null`. The 3.3 rubric handles null gracefully (defaults to LOW). |

The module is wrapped in an outer `try`/`catch` (`p1-16-client-deps.ts:173`); any unexpected exception is logged and the module returns `[]`. One bad module never aborts a scan.

## Honest limits

- **Source-map-only signatures will miss.** If your minifier strips the retire.js header comment, the URL is opaque (`/_next/static/chunks/xyz123.js`), and the SHA-1 doesn't match a known build, we cannot fingerprint the library. Workaround: ship sourcemaps, or use a known CDN URL, or upgrade.
- **Inline `<script>` libraries are ignored.** A `<script>` block in the HTML containing all of jQuery would not be analysed today. The current chunk pipeline reads external scripts. This is a known gap.
- **Webpack/Vite chunk-rewriting.** Some build setups combine multiple libraries into one chunk and minify the comments together. A single chunk can ship 5 libraries; we typically find 1–3 of them via filecontent matching. SHA-1 catches the rest only when the build pins to an exact upstream version.
- **OSV coverage is mostly npm.** A library distributed only via CDN (no npm package) may not have CVEs in OSV at all. P1-16 is most effective against the long tail of "old jQuery shipped from CDN with copy-pasted version pin."
- **We trust retire.js's signatures.** A bad signature in retire.js becomes a false positive for us. We don't (yet) cross-check.

## Files touched

| File | Purpose |
|---|---|
| `src/lib/scanner/modules/p1-16-client-deps.ts` | The module itself: chunk collection, OSV lookup, finding emission. |
| `src/lib/scanner/tools/retire.ts` | Library detection via retire.js fingerprints. |
| `src/lib/scanner/tools/data/jsrepository.json` | Vendored retire.js signature DB. Refresh path is manual today; see "Sourcing" above. |
| `src/lib/scanner/tools/osv.ts` | OSV.dev API client (`queryBatch`, `getVuln`, `extractCvssBaseScore`). |
| `src/lib/scanner/tools/osv-cache.ts` | 24h cache shared by both OSV calls. Upstash + in-memory. |
| `src/__tests__/fixtures/modules/P1-16/` | 8 fixture cases covering positive (jQuery/lodash/Bootstrap), negative (clean jQuery, React not-in-retire, Angular-v2 not AngularJS), edge (no chunks, OSV down). |

## Verification

- Fixture tests: `src/__tests__/lib/scanner/fixtures/fixtures.test.ts` runs every fixture under `src/__tests__/fixtures/modules/P1-16/`. Currently 8 cases, all green.
- The fetch-mock harness lets fixtures supply canned OSV responses, so the tests are deterministic and run offline.
- See [`docs/core/FIXTURE_GUIDE.md`](../core/FIXTURE_GUIDE.md) for how to add a new fixture.
