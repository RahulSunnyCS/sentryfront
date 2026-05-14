# Phase 3 — Passive Scan Quality

**TL;DR (60 seconds):**
- Phase 3 took the scanner from "reads only the raw HTML the server first sends" to "renders the page in a real browser, fingerprints the JavaScript bundles it actually ships, and ranks findings by how exploitable they are in the wild."
- Three items shipped: 3.1 headless crawl + JS chunk coverage, 3.2 client-side dependency vulnerability detection (P1-16), 3.3 exploit-intel severity tiering (KEV + EPSS).
- This folder is canonical. If you want to know what the passive scanner does *right now*, read here, not the BUILD_PHASE plan.

This folder is the **source of truth** for what VibeSafe's passive scanner does as of Phase 3. Audience: web developers who build sites with React, Next.js, Bolt, Lovable, etc., and who do *not* spend their days reading CVE feeds. Every security term is defined the first time it's used; the [glossary](./glossary.md) is the cheat-sheet.

## What "passive scan" means

A **passive scan** looks at what a website publicly hands out — HTML, JS bundles, HTTP headers, cookies, TLS certificate — and analyses it for security problems *without sending any attack traffic*. The site is not modified. No login is attempted. No probe is sent to find SQL injection or XSS. We just read what the browser would already see, then reason about it.

The opposite is **active scanning** (called DAST — Dynamic Application Security Testing), which we deliberately do **not** do in Phase 3. Active scanning needs user consent, can break things, and lives in Phase 5.

## What changed in Phase 3

Phase 3 took the scanner from "scans the HTML the server first serves you" to "scans what a real browser actually loads, knows which libraries are vulnerable, and tells you which findings are actually being exploited in the wild."

| # | Item | Document |
|---|---|---|
| 3.1 | **Headless-rendered crawl + JS chunk coverage.** Replace the static `fetch()` crawler with a real headless browser (Playwright) that runs JavaScript, follows lazy imports, and lets us see what's actually shipped to a visitor. | [01-headless-crawl.md](./01-headless-crawl.md) |
| 3.2 | **Client-side dependency vulnerability scanning (P1-16).** Detect known-vulnerable JS libraries in the bundles (jQuery 1.x, old lodash, Bootstrap 3) using retire.js fingerprints + OSV.dev CVE data. | [02-client-side-dependency-scanning.md](./02-client-side-dependency-scanning.md) |
| 3.3 | **Exploit-intel severity tiering (KEV + EPSS).** Stop scoring vulnerabilities by theoretical CVSS alone — combine with "is this actually being exploited?" (CISA KEV) and "how likely is exploitation?" (FIRST EPSS) for severity that reflects real-world risk. | [03-exploit-intel-severity-tiering.md](./03-exploit-intel-severity-tiering.md) |

Supporting docs:

- [glossary.md](./glossary.md) — every acronym in one place.
- [`../core/SEVERITY_RUBRIC.md`](../core/SEVERITY_RUBRIC.md) — the published severity table.
- [`../core/FIXTURE_GUIDE.md`](../core/FIXTURE_GUIDE.md) — how the per-module fixture tests work.

## Reading order

Read 3.1 first. Phases 3.2 and 3.3 both depend on 3.1's chunk coverage: without a real browser running the JS, we can't see the bundles, so we can't fingerprint libraries or score CVEs in them.

## Out of scope

These docs cover only what was *implemented*. The full Phase 3 plan in `BUILD_PHASE.md` includes items (DOM-aware regex preprocessing, scan-quality corpus, production FP telemetry, paid LLM enrichment, more) that are tracked but not yet shipped. When those land they will get their own doc here.

## Sources of truth across the codebase

| Doc | Lives in | Audience |
|---|---|---|
| This folder | `docs/phase-3/` | Web developers learning what we do and why |
| Severity rubric (canonical table) | [`../core/SEVERITY_RUBRIC.md`](../core/SEVERITY_RUBRIC.md) | Engineers consuming the `severity` field |
| Fixture-test authoring guide | [`../core/FIXTURE_GUIDE.md`](../core/FIXTURE_GUIDE.md) | Engineers adding regression cases |
| Phase plan (forward-looking) | `BUILD_PHASE.md` (repo root) | Roadmap reviewers — *aspirational, not implemented* |
| Scan-coverage matrix | [`../core/SCAN_COVERAGE.md`](../core/SCAN_COVERAGE.md) | Module-by-module catalogue |

## How to keep this current

When a new Phase 3.x item ships:

1. Add a numbered doc (`04-...md`, `05-...md`) in this folder.
2. Link it from the "What changed in Phase 3" table above.
3. Define any new acronyms in [`glossary.md`](./glossary.md).
4. If a finding type or severity rule changed, update `../core/SEVERITY_RUBRIC.md` too — these docs should *summarize* it, not duplicate it.
