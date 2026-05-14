# Scan Coverage

What the passive scanner actually sees when it crawls a target — and, just as important, what it doesn't. Honest documentation here is required because most of our targets are AI-built SPAs (Lovable, Bolt, v0, Cursor outputs), where a naïve crawler sees an empty shell.

Phase 3.1 (2026-05-14) replaced the previous static `fetch()` crawl with a headless-rendered crawl that captures JS chunks. This document is the contract for what that crawl covers.

## What the crawler does

The entry point is `crawl()` in `src/lib/scanner/crawler.ts`. It runs in one of two modes:

### Mode 1 — `headless` (default)

1. Launches Chromium via Playwright with `--no-sandbox`.
2. Navigates to the target URL with `waitUntil: 'domcontentloaded'` (30s timeout).
3. Best-effort waits for `networkidle` (8s timeout) so lazy chunks have a chance to load. Sites with long-polling or analytics beacons typically never reach idle — we proceed anyway.
4. Records every request the browser issued (`networkRequests`) and every JS response body it received (`loadedChunkContents`, capped at 5 MB/chunk and 50 MB total).
5. Captures rendered HTML (`renderedHtml`) — what the DOM looks like after JS has executed.
6. Pulls the initial document response separately to populate the back-compat fields (`html`, `statusCode`, `headers`, `cookies`), preserving the semantics existing scanner modules depend on.
7. Probes well-known framework manifest paths (Strategy C below) for any chunks the browser didn't already load, and downloads them.
8. Falls back to mode 2 if Playwright fails to launch (e.g. Chromium binary missing in a constrained environment).

### Mode 2 — `fetch-only` (fallback)

Identical to the pre-Phase-3.1 behavior: single `fetch()`, raw HTML, no JS execution, no chunk downloads. New fields (`renderedHtml`, `consoleErrors`, `networkRequests`, `loadedChunkContents`) are undefined.

The active mode is recorded in `CrawlResult.renderMode` so downstream modules and the scan report can tell which path ran.

## Chunk coverage strategy

A real SPA has many JS chunks. We use two strategies together:

### Strategy A — entry-route render

Playwright loads the entry URL and we capture every `application/javascript` response the browser fetches. This catches:

- Framework runtime (React, Vue, Svelte, Angular)
- Vendor bundle (`vendor.js`, `chunk-vendors.js`, etc.)
- Every chunk the entry route synchronously imports
- Chunks loaded during initial render via `useEffect` / `onMounted` / etc., as long as they fire before networkidle

### Strategy C — framework-manifest probe

For known frameworks, we probe well-known manifest paths and download any chunks listed there that the browser didn't already load:

| Framework | Manifest path | What we read |
|---|---|---|
| Next.js | `/_next/static/chunks/_buildManifest.js` | Regex-extract `static/(chunks\|css)/...` paths from the manifest body. We do not eval the manifest. |
| Vite | `/manifest.json`, `/.vite/manifest.json` | JSON parse, walk every entry, collect `.file` values ending in `.js`. |

Other frameworks (Nuxt, SvelteKit, Remix) currently get Strategy A coverage only. We'll add their manifests when telemetry justifies the work.

### Strategies we explicitly do NOT use

- **B — multi-route render.** Following internal links and rendering each route is expensive (N renders per scan) and belongs naturally with Phase 5 (active scanning / authenticated flows), where the cost is already paid.
- **D — regex-extract dynamic imports from minified bundles.** Brittle. Modern minifiers rename or inline the chunk-name hints we'd need to grep for.

## What we can't see

Even with Strategies A + C, the following are structurally invisible to a passive scan:

- **Chunks behind authentication.** A login form, an OAuth redirect, a session-cookie gate — all opaque.
- **Chunks loaded only after user interaction.** Clicking through a wizard, opening a modal, submitting a form, hovering a tooltip with a lazy import.
- **Chunks gated by feature flags, A/B tests, or geo.** We see whatever variant the target serves to a US-IP datacenter-AS Playwright session.
- **Chunks served by a custom bundler we don't recognize.** Anything outside Next.js / Vite manifests gets Strategy A coverage only.
- **Chunks loaded by server-rendered pages mixed into an SPA.** Each SSR page is a separate render — we only render the entry URL.

These limits are inherent to passive scanning, not bugs in the crawler. Phase 5 (DAST / active scanning) is where authenticated and interaction-driven coverage lives.

## Per-scan cost

| Mode | Network operations | Approx. wall time |
|---|---|---|
| `fetch-only` | 1 fetch | <1s on most targets |
| `headless` (no SPA) | 1 render + a few chunk fetches | 3–6s |
| `headless` (typical Next.js SPA) | 1 render + 10–40 chunk fetches + manifest probe | 8–15s |
| `headless` (large SPA) | 1 render + up to 80 chunk fetches | up to 30s |

Caps that prevent runaway scans:

- 30s navigation timeout
- 8s additional networkidle wait
- 5 MB per chunk
- 50 MB total chunk budget
- 80 chunks per manifest

A scan that hits a cap continues with whatever it has — caps never abort the crawl.

## Disabling

If Playwright misbehaves in production, set the `FEATURES` env variable to disable headless mode:

```
FEATURES='{"headlessCrawl":false}'
```

All scans then run in `fetch-only` mode. New fields on `CrawlResult` will be undefined; modules that opt into them must handle the undefined case.
