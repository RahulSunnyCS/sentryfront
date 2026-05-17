# Scan API — Architecture

How VibeSafe accepts a URL, runs a multi-domain scan that can take up to two
minutes, and streams progress + results back to the browser — without ever
blocking an HTTP request for the duration of the work.

> Scope: the v1 scan surface (`/api/v1/scans/*`) and the background scan
> pipeline (`scan-worker` → `scanner` → modules). The intrusive DAST surface
> (`/api/v1/active-test/*`) is a separate flow and is only referenced where it
> shares machinery.

---

## 1. The core problem

A full scan crawls the target, runs 18 passive security modules, and
optionally Lighthouse (performance), accessibility, and SEO passes. End to end
this is tens of seconds and is hard-capped at **120 s**
(`SCAN_TIMEOUT_MS`, default `120000`). An HTTP request cannot block that long.

The architecture decouples **request** from **work** and uses an
**event-polling** model for progress:

```
POST /api/v1/scans ─► create Scan row ─► runScan(id)  [NOT awaited]
                                              │            └─► 201 {id} returned at once
                                              ▼  background, ~60–120 s
                    ┌────────────────────────────────────────────┐
                    │ scan-worker → scanner → modules + Lighthouse │
                    │ inserts ScanEvent rows as it progresses      │
                    └────────────────────────────────────────────┘
                                              ▲
Browser polls  GET /api/v1/scans/[id]/events?since=<cursor>   ─┘
Browser reads  GET /api/v1/scans/[id]            (summary, when status flips)
Browser reads  GET /api/v1/scans/[id]/findings   (full results, when terminal)
```

---

## 2. API surface

All routes live under `src/app/api/v1/scans/` and return `NextResponse.json`.
Access control is uniform: `getCurrentUser()` + `canViewScan(scan, user)`;
denied access returns **404, not 403**, so scan existence is never leaked.

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/v1/scans` | Create + start a scan | Auth optional; rate + quota gated; returns `201 {id,status,targetUrl}` |
| `GET /api/v1/scans` | List caller's scans | Auth required; cursor pagination; `Cache-Control: private, max-age=15` |
| `GET /api/v1/scans/[id]` | Scan summary | Status, scores/grades, per-domain metrics |
| `GET /api/v1/scans/[id]/events` | Progress polling | `?since=<cursor>`; monotonic id cursor |
| `GET /api/v1/scans/[id]/findings` | Full findings | 409 unless terminal; tier-gated; demo is public |
| `GET /api/v1/scans/[id]/performance-suggestions` | AI improvement plan | From P2-* findings; 404 if no perf data |
| `GET /api/v1/scans/[id]/diff/[prevId]` | Compare two scans | Feature-flagged (`features.scanDiff`); same target only |
| `POST\|GET .../findings/[findingId]/disposition` | User verdict on a finding | Append-only; auth always required |

### `POST /api/v1/scans` — request path (`scans/route.ts`)

1. Resolve identifier — user id, else `x-forwarded-for` / `x-real-ip`.
2. `checkRateLimit(identifier, tier)` — tier-aware hourly cap → **429** with
   `Retry-After` if exceeded.
3. Parse JSON body → **400** on malformed input.
4. `validateAndNormalize(url)` (`lib/url-validator.ts`) — SSRF / scheme /
   host validation → **4xx / 422** on a `ValidationError`.
5. Signed-in users: `checkWeeklyScanQuota(user.id, tier)` → **402**
   `weekly_quota_exhausted` with `nextScanAt` + `upgradeUrl`.
6. Create the `Scan` row.
7. **Fire `runScan(scan.id)` without `await`** — only `.catch()` attached.
8. Return `201 {id, status, targetUrl}` + rate-limit headers immediately.

The route is queue-agnostic: with `REDIS_URL` set the worker is intended to
run via BullMQ; without it, `runScan` is an in-process detached Promise (fine
for local/dev — see trade-offs).

---

## 3. The long-running process

### 3.1 Status state machine

`Scan.status` (Prisma) is the single source of truth that decouples the
single writer (worker) from many readers (API):

```
PENDING ─► RUNNING ─► COMPLETED
                   ├─► FAILED
                   └─► TIMEOUT
```

Every result endpoint gates on this. `findings`, `diff`, and
`performance-suggestions` return **409** until the scan is terminal. Readers
never see partial in-flight state.

### 3.2 Hard timeout via `Promise.race` (`scan-worker.ts`)

`runScanWithTimeout` races the real work against a `setTimeout` rejection at
`SCAN_TIMEOUT_MS`:

```
Promise.race([ runScanInternal(scanId), timeoutPromise ])
```

- Work wins → normal `COMPLETED` path.
- Timeout wins → `handleScanTimeout`: count whatever `Finding` rows were
  already persisted, mark the scan `TIMEOUT`, emit a `scan_timeout` event.
  **Partial findings survive.**

This is the central design guarantee: the 120 s ceiling is enforced, not
hoped for. A hung crawl or slow Lighthouse run can never wedge the process.

### 3.3 Real work + placeholder progress, in parallel

```
await Promise.all([
  runScanner(targetUrl),
  emitPlaceholderProgress(scanId, ALL_MODULES.length),
])
```

The crawl + module phase is largely opaque (no fine-grained progress). A
scripted `emitPlaceholderProgress` emitter — paced to mirror the frontend's
mock module durations — runs concurrently so the UI progress bar moves during
the crawl. Real `moduleFindingCounts` overwrite the placeholders when
`scan_complete` fires. The progress bar is therefore **cosmetic / time-based**,
not bound to actual module completion.

### 3.4 The scanner: two-phase fan-out (`scanner/index.ts`)

1. `crawl(targetUrl)` once — Playwright headless, static `fetch` fallback.
   This is the slowest single step.
2. **Group 1** — 10 I/O-heavy P1 modules (secrets, sourcemaps, sensitive
   paths, CORS, DNS/email, subdomain takeover, error disclosure, dev
   interfaces, robots/sitemap, client deps) run fully parallel via
   `Promise.all`.
3. **Group 2** — 8 synchronous P1 modules (headers, TLS, cookies, mixed
   content, third-party scripts, cache, service worker, web manifest) operate
   on the already-fetched crawl data — no extra I/O.
4. **P2 / P3 / P4** — performance (Lighthouse), accessibility, SEO each run
   only if their feature flag is on, each wrapped in its own try/catch so a
   failure **degrades** (logged, scan continues) rather than failing the whole
   scan.

The parallel fan-out is what keeps an 18-module + Lighthouse scan inside the
120 s budget. Module signature is fixed:
`async runXxxModule(crawl): Promise<RawFinding[]>`.

### 3.5 Persistence + grading

On success the worker enriches findings via the optional LLM pass
(`lib/llm/enrichment.ts`, fails soft), `createMany`s the `Finding` rows,
computes a severity-weighted score → letter grade
(`CRITICAL 25 / HIGH 10 / MEDIUM 3 / LOW 1 / INFO 0`; `A`≤0, `B`≤5, `C`≤20,
`D`≤50, else `F`), and writes summary + per-domain
grade/score/metrics back onto the `Scan` row in one update.

### 3.6 Failure isolation (three independent layers)

1. Optional sub-scans (P2/P3/P4) fail soft — logged, scan continues.
2. `runScanInternal` is try/caught → `status = FAILED` + `scan_failed` event.
3. The timeout wrapper wraps everything → `status = TIMEOUT` + partial
   findings + `scan_timeout` event.
4. The detached `runScan(...).catch()` in the route is the final backstop so a
   worker crash never becomes an unhandled rejection.

---

## 4. Progress: DB-as-event-bus (`lib/events.ts`)

`publishEvent(scanId, type, payload)` simply inserts a `ScanEvent` row. There
is **no Redis pub/sub on the polling path** — it was deliberately removed
because the polling endpoint reads from the DB; routing events elsewhere would
make polling return nothing.

The browser polls `GET /api/v1/scans/[id]/events?since=<lastId>`. The cursor
is a monotonic row id (`where: { id: { gt: since } }`), so each poll fetches
only new events and returns the new high-water mark as `cursor`.

Event sequence emitted by the worker:

```
module_complete × N   (placeholder-paced)
llm_enrichment_started
llm_enrichment_complete
scan_complete | scan_failed | scan_timeout   (terminal)
```

`iterScanEvents` (SSE async generator) still exists for the legacy
active-test progress route, but the v1 scan progress path is pure polling.

---

## 5. Cross-cutting concerns

| Concern | Mechanism |
|---|---|
| Access control | `canViewScan(scan, user)`; denials → 404 (not 403) |
| Rate limiting | `checkRateLimit` (hourly, tier-aware) on scan creation |
| Quota | `checkWeeklyScanQuota` (per signed-in user) → 402 |
| Tier gating | `applyTierGating(findings, tier)`; `meta.isLimited` / `hiddenCount` |
| Async execution | detached `runScan` Promise or BullMQ (queue-agnostic route) |
| Progress | `ScanEvent` rows polled via `/events?since=` |
| Logging | `logger.setScanScope(id)` → Sentry-wrapped logger |
| Status guards | non-terminal scans → 409 on findings/diff/suggestions |
| Optional sub-scans | feature-flagged, fail-soft (perf/a11y/SEO) |

---

## 6. Architectural trade-offs

- **In-process worker by default.** Without Redis the scan runs in the web
  server's event loop. A server restart mid-scan loses the scan with no
  resumption — the row is left `RUNNING` indefinitely. BullMQ is the intended
  production path but the route does not enforce it.
- **DB-as-event-bus.** Simple and trivially pollable, but every progress tick
  is a row insert and the client polls on an interval — chattier than
  SSE/WebSocket and progress latency is bounded by poll frequency.
- **Placeholder progress is cosmetic.** It is time-based, not tied to real
  module completion, so the bar can desync (finish early → jump to 100%; slow
  crawl → bar stalls near the end).
- **No route-level concurrency cap.** Rate limits gate scan *creation*, not
  concurrent *execution*: N accepted scans = N in-process scanners contending
  for the same event loop and Playwright resources.
- **120 s is a wall, not a target.** A slow target site yields a `TIMEOUT`
  with partial findings rather than a complete report — by design, but callers
  must handle the `TIMEOUT` status explicitly.

---

## 7. Related code

| File | Role |
|---|---|
| `src/app/api/v1/scans/route.ts` | Create / list scans |
| `src/app/api/v1/scans/[id]/route.ts` | Scan summary |
| `src/app/api/v1/scans/[id]/events/route.ts` | Progress polling |
| `src/app/api/v1/scans/[id]/findings/route.ts` | Findings (tier-gated) |
| `src/lib/scan-worker.ts` | Timeout wrapper + orchestration + persistence |
| `src/lib/scanner/index.ts` | Crawl + two-phase module fan-out |
| `src/lib/events.ts` | `publishEvent` / SSE generator |
| `src/lib/rate-limiter.ts` | Hourly rate limit + weekly quota |
| `src/lib/tier-gating.ts` | Finding visibility by tier |
| `src/lib/report-access.ts` | `canViewScan` |
