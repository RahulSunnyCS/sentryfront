# QA Checklist — Telemetry Observability Improvements

Lane: feature-fast | Risk: MEDIUM | Tiers: Critical + Functional only

---

## 🔴 Critical — All must pass at Automation Gate for Gate 2

C-01: `npm run typecheck` passes with zero new TypeScript errors after all three tasks land.
C-02: `npm run build` succeeds — `withSentryConfig` wrapping does not break the Next.js standalone build.
C-03: `npm run test` passes — no regressions in existing scan-worker, health endpoint, or scanner tests.
C-04: `/api/health` GET returns HTTP 200 with `metrics.active_scans_this_instance` present as a number field.
C-05: `src/instrumentation.ts` exists and exports an async `register()` function; `next.config.mjs` includes `experimental: { instrumentationHook: true }` and wraps export with `withSentryConfig`.

---

## 🟡 Functional — Failures → CONDITIONAL PASS at Gate 2

F-01: When `SENTRY_ENABLED=true` and `SENTRY_DSN` is set, a test scan in staging produces a Sentry transaction/trace tagged with `scan_id` and `tier` attributes.
F-02: `scan.duration_ms` measurement appears on the Sentry transaction for a completed scan.
F-03: The root Sentry span contains `url_hash` (8-char hex) and does NOT contain the raw scanned URL.
F-04: `SENTRY_RELEASE` env var value appears on Sentry events when set (release attribution working).
F-05: `active_scans_this_instance` in `/api/health` increments by 1 when a scan starts and returns to 0 after it completes or times out.
F-06: With `SENTRY_ENABLED=false` or DSN unset, all scan behaviour is identical to pre-change — Sentry calls are silent no-ops, no errors thrown.
F-07: `logger.info('scan_complete', ...)` log line with `durationMs`, `result`, and `tier` fields appears in stdout on scan completion, timeout, and error.
