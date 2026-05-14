# 3.1 — Headless-rendered crawl + JS chunk coverage

**TL;DR (60 seconds):**
- We crawl the target site with a real headless Chromium (Playwright) instead of a raw `fetch()` of the HTML. That lets us see what the visitor's browser actually receives after JavaScript runs.
- For SPAs (React, Vue, Bolt, Lovable, v0, Next.js client-rendered) the old static crawler saw an empty shell. The new crawler sees the rendered DOM, every JS chunk the browser loaded, all network requests, and console errors.
- Headline limit: we only render the entry route. Authenticated pages, multi-step flows, and clicks are not simulated — that lives in Phase 5 (active scanning).

## What this does, in one paragraph

VibeSafe's crawler now opens the target site in a real headless browser (Chromium via Playwright) instead of just downloading the raw HTML. Modern sites built with React, Vue, Next.js, Bolt, Lovable, etc. ship a near-empty HTML shell and *fill it in with JavaScript at runtime*. If we only fetch the HTML, we miss everything the visitor actually sees and everything the visitor's browser actually downloads. A real browser runs the JS, downloads every script chunk, and lets us snapshot the *real* page. We capture the post-render HTML, the list of network requests, console errors, and the contents of every JS chunk.

## Terms used in this doc

| Term | Meaning |
|---|---|
| **SPA** (Single-Page Application) | A website that renders most of itself with JavaScript in the browser. Examples: anything built with Bolt, Lovable, v0, Replit, Cursor; most React/Vue/Svelte apps. |
| **SSR / CSR / SSG** | Server-Side Rendered (HTML built on the server before each request), Client-Side Rendered (HTML built in the browser after page load), Static Site Generated (HTML pre-built at deploy time). Most "AI-built" sites are CSR. |
| **Chunk** | A piece of compiled JavaScript that the browser loads. Modern bundlers (webpack, Vite, Rollup, Turbopack) split your app into many chunks: a `main.js`, a `vendor.js` (third-party libraries), and one chunk per code-split route. |
| **Bundle / manifest** | The bundler emits a manifest file listing all chunks for the build. We read this to find chunks the browser didn't load on the entry page (e.g. chunks for `/dashboard` when we only visited `/`). |
| **Headless browser** | A real browser (Chrome/Chromium) running without a visible window, controlled by a script. We use Playwright; Puppeteer is the same idea. |
| **Network idle** | The browser is considered "done loading" when no new network request has started for ~500 ms. We wait for this before snapshotting. |
| **CSP** (Content Security Policy) | An HTTP header that restricts what scripts/styles a page is allowed to load. We capture it during render. |

## Why this matters for security

Most security findings live in things the visitor actually receives. Examples that the old static-fetch crawler **missed entirely**:

- **Vulnerable JS libraries in chunks.** If your `vendor.js` ships jQuery 1.4.4 (with known XSS) but the entry HTML doesn't mention jQuery, the static crawler sees nothing. We can't tell you to patch a library we can't see.
- **Client-rendered DOM that leaks data.** A React app might inject an API key, an admin URL, or a debug banner into the rendered DOM after hydration. The static crawler sees the pre-hydration shell.
- **Network requests to dangerous endpoints.** The static crawler sees `<script src="...">` tags but not the `fetch('/api/admin/...')` call that React makes after mount.
- **Console errors leaking stack traces / config.** Frameworks like Next.js log surprising amounts of internal state to the console during development. We capture those.

In short: scanning the empty HTML shell of an SPA tells you about as much as scanning `index.html` of a Create-React-App project does — almost nothing.

## How it works

File: `src/lib/scanner/crawler.ts`.

### 1. Launch a real browser

`crawler.ts:286` — `chromium.launch()`. We use the bundled Playwright Chromium so the scan environment is identical to a modern visitor's. Custom user agent string identifies us as `VibeSafe-Scanner/1.0`.

### 2. Navigate and wait for network idle

`crawler.ts:332` — `page.goto(targetUrl, { waitUntil: 'domcontentloaded' })`. Then `crawler.ts:346` — `page.waitForLoadState('networkidle')` with an 8-second cap. This is the moment "the page has finished loading itself."

We also instrument `page.on('request')` to log every URL the browser fetched during render. Anything with `Content-Type: application/javascript` (or that looks like a JS chunk) is captured.

### 3. Snapshot the post-render state

`crawler.ts:352` — `await page.content()` returns the *current* HTML, after React/Vue/etc. have done their work. This is what we feed to downstream regex modules: mixed-content scans, error-disclosure scans, etc., now see the real page instead of an empty shell.

We also capture:
- Every `console.error` / `console.warn` message (`crawl.consoleErrors`).
- Every network request the browser made (`crawl.networkRequests`).
- The list of script URLs and the **actual JS bodies** of each (`crawl.loadedChunkContents`).

### 4. Strategy A — chunks the browser loaded

The browser-loaded set covers everything the entry page synchronously needs: framework runtime, vendor bundle, the entry-route's code-split chunk. That's the bulk of any SPA.

### 5. Strategy C — framework-manifest probe

`crawler.ts:407` — after the browser is done, we probe well-known manifest URLs for the major frameworks:

| Framework | Manifest URL | What it lists |
|---|---|---|
| Next.js | `/_next/static/chunks/_buildManifest.js` | All chunks the build emitted, keyed by route |
| Vite | `/manifest.json` or `/.vite/manifest.json` | Same idea, JSON shape |

If a manifest is found, we parse out the chunk URLs and fetch each one in parallel (capped at 80 chunks per scan, 5 MB per chunk, 50 MB total to bound memory). These cover chunks for routes the visitor *didn't* navigate to — e.g. `/dashboard` chunks even though we only loaded `/`.

We deliberately do **not** click around the site or follow links (that's Strategy B, deferred to Phase 5). Strategy C is the cheap way to widen coverage without simulating user behaviour.

### 6. Fallback to fetch-only

If Playwright fails (no Chromium binary on the host, navigation crash, network error), the crawler falls back to the old static-fetch path. `crawl.renderMode` records which path actually ran (`'headless'` vs `'fetch-only'`). Downstream modules treat both modes the same — they read `crawl.html` and `crawl.loadedChunkContents`. The fallback ensures a partially-broken scan environment still produces *some* findings.

Kill switch: `FEATURES='{"headlessCrawl":false}'` forces fetch-only mode even when Playwright is available.

## Data added to `CrawlResult`

`src/lib/scanner/types.ts`:

```ts
renderedHtml?: string;             // post-JS HTML snapshot
consoleErrors?: string[];          // browser console errors during render
networkRequests?: NetworkRequest[];// every request the browser made
loadedChunkContents?: Record<string, string>; // url -> JS body
renderMode?: 'headless' | 'fetch-only';
```

Existing scanner modules ignore fields they don't know about, so adding these was backwards-compatible.

## Honest limits

- **No multi-route coverage on the entry render.** We see one route in the browser plus whatever the manifest reveals. Authenticated dashboards, multi-step flows, modals triggered by specific data — invisible until Phase 5 (active scanning) introduces user-driven navigation.
- **Custom bundlers are blind.** If your site uses a bundler not in the manifest list (esbuild without metafile, Parcel, hand-rolled), we only get Strategy A coverage.
- **Per-scan cost.** One static `fetch()` (≈100 ms) became one headless render + N chunk fetches (≈3–8 s on a Next.js site). Caching helps cross-scan, but each new target pays the full render once.
- **JavaScript-gated content is still gated.** If a chunk only loads after the visitor clicks something, we don't click. Strategy C catches some of these via the manifest, but not all.
- **No login.** No authenticated routes. Phase 5.

## Files touched

| File | Purpose |
|---|---|
| `src/lib/scanner/crawler.ts` | All of the above. Playwright launch, network instrumentation, manifest probing, fetch-only fallback. |
| `src/lib/scanner/types.ts` | `CrawlResult` extended with `renderedHtml`, `consoleErrors`, `networkRequests`, `loadedChunkContents`, `renderMode`. |
| `src/lib/features.ts` | `headlessCrawl` flag (default on). |
| `package.json` | Playwright was already a dependency from an earlier phase; no new deps. |

## Verification

- Unit tests: `src/__tests__/lib/scanner/crawler.test.ts`.
- Integration: every fixture under `src/__tests__/fixtures/modules/P1-16/` that sets `renderMode: 'headless'` exercises a chunk-aware code path through the downstream library detector.
