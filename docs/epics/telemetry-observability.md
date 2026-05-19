# Epic: Production Telemetry & Observability

| Field      | Value                                                    |
|------------|----------------------------------------------------------|
| Status     | Completed                                                |
| Date       | 2026-05-19                                               |
| Branch     | claude/fix-will-he-scan-api-2iUCE                        |
| Tasks      | T-01, T-02, T-03, T-04                                   |
| Risk level | MEDIUM — no risk flags; lane: feature-fast               |

## 1. What was done

Before this work, VibeSafe's Sentry SDK was installed but its server-side
initialisation never actually ran in production: the three Sentry config files
existed but were never imported at runtime because Next.js 14.2.x App Router
requires a dedicated `instrumentation.ts` hook (and the
`experimental.instrumentationHook` flag) to load them. Every server error was
silently discarded.

Four tasks shipped:

- **T-01 — Fixed server-side Sentry wiring.** Created `src/instrumentation.ts`
  with an exported `register()` function that conditionally imports
  `sentry.server.config` or `sentry.edge.config` based on `NEXT_RUNTIME`.
  Added `experimental: { instrumentationHook: true }` and wrapped
  `next.config.mjs` export with `withSentryConfig` (ESM, `hideSourceMaps:
  true`, `disableLogger: true`). All three Sentry config files gained
  `release: process.env.SENTRY_RELEASE` for deploy attribution. Four new
  `.env.example` entries document `SENTRY_RELEASE`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT`.

- **T-02 — Scan-pipeline spans and measurements.** `scan-worker.ts` now wraps
  the entire scan in `Sentry.startSpan({ name: 'scan', op: 'scan.run' })` with
  attributes `scan_id`, `tier`, and `url_hash` (first 8 hex chars of
  SHA-256(url); raw URL is never an attribute). `Sentry.setMeasurement('scan.
  duration_ms', elapsedMs, 'millisecond')` fires on every outcome — complete,
  timeout, error. Two child spans in `scanner/index.ts` wrap the crawl phase
  and LLM enrichment. A `logger.info('scan_complete', { scanId, durationMs,
  result, tier })` structured log fires on all three outcomes.

- **T-03 — Per-instance active scan counter on `/api/health`.** A
  module-scoped `activeScanCount` variable in `scan-worker.ts` is incremented
  immediately before `Promise.race` and decremented unconditionally in the
  matching `finally` block, making it leak-proof on all exit paths. Exported as
  `getActiveScanCount()`. The `/api/health` response gains a
  `metrics: { active_scans_this_instance: number }` field; the existing 200/503
  status logic is unchanged.

- **T-04 — Observability runbook.** `docs/observability.md` covers Sentry
  environment variables and what each enables, structured JSON log shipping
  (stdout → operator-configured provider), and the `/api/health` contract for
  uptime monitoring. It explicitly separates what is wired in the codebase from
  what is operator responsibility.

- **Phase 4.5 security hardening (post-review fix).** The Phase 4 review
  identified that the `url_hash` attribute only protected the explicit span
  attribute — auto-captured exceptions and HTTP client spans from
  Playwright/fetch could still carry the raw scanned URL. `sentry.server.
  config.ts` now includes `beforeSend` scrubbing (exception values,
  breadcrumb messages, breadcrumb data fields, `event.request.url`) and a
  `beforeSendTransaction` hook that scrubs transaction name, request URL, and
  `http.url`/`description`/`url` on every child span. The scrub preserves the
  scheme+host and replaces path/query/fragment with `/[redacted]`, keeping
  enough information to identify which target site caused a failure.

## 2. How this helps the project

Before this work, VibeSafe had no production visibility: server crashes, scan
failures, and performance outliers produced no signal in Sentry, no structured
logs, and no way to know how many scans were running on any given instance.

After:
- Any unhandled server error is now captured in Sentry with a stack trace and
  release tag, so regressions are visible immediately after a deploy.
- Every scan produces a performance transaction in Sentry with its duration,
  tier, and url_hash — operators can chart scan timing, set duration alerts,
  and filter by tier.
- The structured `scan_complete` log (stdout JSON in production) feeds any
  log aggregator without code changes.
- `/api/health` exposes a live concurrency signal useful for load-balancer
  health checks and uptime monitors.

## 3. Limitations & tradeoffs (and why we chose this)

**`active_scans_this_instance` is per-process, not cluster-wide.**
A Redis INCR/DECR pattern would give an accurate cluster total, but Redis is
an optional dependency in VibeSafe and adding a hard dependency on it for a
metrics counter would break single-instance and dev deployments. The counter is
still operationally useful: each instance reports its own load, and a load
balancer can use it to route new scans to the least-loaded node.

**`SENTRY_RELEASE` degrades to "unknown" in a Docker build without `.git`.**
Computing the release from Git at Docker build time requires passing it as a
build ARG. The code handles the absent variable gracefully (Sentry treats it as
"unknown" rather than erroring), but release attribution in Sentry will be
blank unless the CI pipeline explicitly wires `SENTRY_RELEASE=$(git rev-parse
--short HEAD)` as a build ARG. This is flagged in `.env.example` and
`docs/observability.md` but left as operator responsibility because the CI
configuration is outside this repo's scope.

**Origin-only URL redaction, not full URL removal.**
`beforeSend` and `beforeSendTransaction` keep the scheme+host of scanned URLs
while scrubbing path, query, and fragment. Full removal would make it
impossible to identify which target site caused a scan failure. This is a
deliberate debuggability tradeoff documented in the `redactUrls` function
header.

**Log shipping and uptime alerting are provider config, not code.**
Log aggregator choice (Datadog, Logtail, CloudWatch, etc.) and uptime monitor
choice (BetterStack, UptimeRobot, etc.) vary by operator infrastructure.
Hardcoding a vendor would couple the app to one provider. The codebase emits
structured JSON to stdout and exposes a health endpoint; integration is the
operator's responsibility, as documented in `docs/observability.md`.

**E2E tests are CI-only for this change.**
Sentry server-side instrumentation produces no user-facing UI change. Asserting
that Sentry *receives* a span requires a live DSN with real credentials,
unavailable in CI without secrets. The pre-existing Playwright E2E suite runs
unchanged in GitHub CI on the PR.

## 4. Tests the AI ran to verify this works

All tests ran on branch `claude/fix-will-he-scan-api-2iUCE`.

| Check | Result |
|---|---|
| `npm run typecheck` | PASS — zero new TypeScript errors |
| `npm run build` | PASS — full route manifest produced; `withSentryConfig` + `withNextIntl` + `output: 'standalone'` compose without webpack-plugin conflict |
| `npm run test` | PASS — 1890 passed, 10 skipped, 0 failed |
| `npm run lint` | PASS — zero new errors (pre-existing warnings only, unchanged) |

New tests added: 22 total across two files.

- **`src/__tests__/sentry-redact-urls.test.ts`** — 14 tests for the
  `redactUrls` function in `sentry.server.config.ts`. Covers: plain HTTPS URL
  (path scrubbed, host kept), URL with query string (tokens scrubbed), URL with
  fragment, URL embedded mid-sentence, multiple URLs in one string, URL with no
  path (no change expected), non-URL strings (no-ops), null/undefined inputs,
  and the specific case of a token in the query string never surviving. These
  are the security-critical tests that directly verify the Phase 4.5 fix.

- **`src/__tests__/health-metrics.test.ts`** — 8 tests. Covers: `metrics`
  field present in `/api/health` response, field is a number, value is zero
  when no scan is running, field does not affect the 200/503 status logic.

E2E verdict: **CI-ONLY.** No user-facing surface changed. The Automation Gate
did not block Gate 3.

## 5. Manual test cases (for human verification)

The following cases require a staging environment with `SENTRY_ENABLED=true`
and a real `SENTRY_DSN` — they cannot be asserted in CI.

**MTC-1 — Sentry transaction appears for a completed scan**
- Preconditions: Staging instance running with `SENTRY_ENABLED=true`,
  `SENTRY_DSN` set to a live Sentry project, `NODE_ENV=production`.
- Steps:
  1. Submit a URL for scanning via the VibeSafe UI.
  2. Wait for the scan to complete (status shows "Completed").
  3. Open Sentry > Performance tab for the project.
  4. Filter by operation `scan.run`.
- Expected result: A transaction appears with attributes `scan_id` (a CUID),
  `tier` (e.g. "free"), `url_hash` (8-character hex string). The raw scanned
  URL does NOT appear in the span attributes.

**MTC-2 — `scan.duration_ms` measurement visible in Sentry**
- Preconditions: Same as MTC-1; at least one scan has completed.
- Steps:
  1. Open Sentry > Performance > select a `scan.run` transaction.
  2. Look at the Measurements panel on the transaction detail page.
- Expected result: `scan.duration_ms` is present with a value in milliseconds
  matching the approximate scan duration.

**MTC-3 — URL path/query is scrubbed from Sentry errors**
- Preconditions: Same as MTC-1; arrange for a scan to fail (e.g. submit a URL
  that returns a connection refused error or an invalid TLS cert).
- Steps:
  1. Submit the URL that triggers a scan error.
  2. Wait for the scan to fail.
  3. Open Sentry > Issues; find the captured exception.
  4. Inspect the exception value, breadcrumbs, and any HTTP span descriptions.
- Expected result: The exception message shows the target host (e.g.
  `https://example.com/[redacted]`) but not the original path or any query
  parameters. No breadcrumb contains a full URL with path or query string.

**MTC-4 — `SENTRY_RELEASE` appears on Sentry events**
- Preconditions: Staging deploy with `SENTRY_RELEASE` set to a known value
  (e.g. a git SHA).
- Steps:
  1. Trigger any event captured by Sentry (an error or a scan transaction).
  2. Open the event detail in Sentry.
  3. Check the "Release" field.
- Expected result: Release field shows the value of `SENTRY_RELEASE`, not
  "unknown".

**MTC-5 — `active_scans_this_instance` increments and returns to zero**
- Preconditions: Running instance accessible at its base URL.
- Steps:
  1. `GET /api/health` before starting a scan — note
     `metrics.active_scans_this_instance` value (expect 0 at idle).
  2. Trigger a scan (it will take several seconds to complete).
  3. During the scan, `GET /api/health` again.
  4. Wait for the scan to finish.
  5. `GET /api/health` a third time.
- Expected result: Step 1 returns 0. Step 3 returns a number ≥ 1 (the scan in
  flight). Step 5 returns 0 again. The overall health status (`status` field)
  is unaffected — it remains "ok" or "error" based on DB and env vars, not the
  scan counter.

**MTC-6 — Sentry disabled with no DSN: no behaviour change**
- Preconditions: Instance with `SENTRY_ENABLED=false` or `SENTRY_DSN` unset
  (this is the default dev configuration).
- Steps:
  1. Submit a URL for scanning.
  2. Observe scan completion in the UI.
- Expected result: Scan completes normally. No errors thrown. No Sentry events
  sent. Behaviour is identical to before this change.

## 6. Security & risk notes

Phase 4 verdict: **CONDITIONAL PASS** → resolved to **PASS** after Phase 4.5
fix cycle.

| Finding | Severity | Resolution |
|---|---|---|
| Raw scanned URL can reach Sentry via auto-captured exceptions and HTTP client spans despite `url_hash` on the span attribute | Medium | RESOLVED — `beforeSend` and `beforeSendTransaction` hooks in `sentry.server.config.ts` now scrub exception values, breadcrumb messages/data, request URLs, and child span `http.url`/`description`/`url` fields. 14 unit tests cover the scrubbing logic. |
| First-time `withSentryConfig` + `withNextIntl` + `output: 'standalone'` composition needed build verification | Medium | RESOLVED — `npm run build` passed; full route manifest produced, no webpack-plugin conflict. |

Accepted risks: none. All Medium findings were resolved before Gate 3.

Non-blocking recommendation (not actioned, operator responsibility): wire
`SENTRY_RELEASE` as a Docker/CI build ARG so production events carry release
attribution. The code degrades gracefully to "unknown" without it.

Opus deep-dive: NOT REQUIRED. No risk flags (no auth, payment, public API, or
file upload surface touched). The single Medium security finding was a
concrete, well-scoped single-file remediation.

Blast radius: 11 changed files, 11 valid, 0 unlinked, 0 shared-ripple.
`scan-worker.ts` was the one declared shared file (T-02 and T-03 both needed
it); tasks were serialised in decomposition to avoid a concurrent shared-write.

Rollback: set `SENTRY_ENABLED=false` (or leave `SENTRY_DSN` unset) to disable
all Sentry instrumentation with zero code change. The `active_scans_this_
instance` field on `/api/health` is additive and does not affect the 200/503
status; removing it requires reverting `src/app/api/health/route.ts` and
`src/lib/scan-worker.ts`.

## 7. Follow-ups & deferred work

- **Cluster-wide active scan counter via Redis** — `active_scans_this_instance`
  is per-process. A Redis INCR/DECR across instances would give an accurate
  cluster total; deferred because Redis is an optional dependency and the
  per-instance signal is already useful for single-instance deployments.
- **`SENTRY_RELEASE` in Dockerfile/CI** — the build currently degrades to
  "unknown" in Docker when `.git` is absent; wiring it as a build ARG is
  straightforward but requires CI config changes outside this repo.
- **Clear the timeout timer on fast scan completion** — `runScanWithTimeout`
  does not `clearTimeout` on the success path; the 120s timer holds a reference
  until it fires. Pre-existing, out of scope for an observability change.
- **Scanner module-level spans** — Group 1/Group 2 module groups do not have
  child spans (too granular per the task contract). Individual module timing
  could be added if performance analysis of specific modules becomes a need.

## 8. References

- Task contracts: `pipeline/tasks/T-01.json` through `T-04.json`
- Phase 4 review: `pipeline/reviews/senior-review.md`
- Phase 4 synthesis: `pipeline/reviews/synthesis.md`
- Blast-radius validation: `pipeline/reviews/blast-radius-validation.md`
- Automation Gate: `pipeline/reviews/automation-gate.md`
- QA checklist: `pipeline/qa-checklist.md`
- Runbook: `docs/observability.md`
- Key changed files: `src/instrumentation.ts`, `sentry.server.config.ts`,
  `next.config.mjs`, `src/lib/scan-worker.ts`, `src/app/api/health/route.ts`
