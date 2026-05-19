AUTOMATION GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verdict: CI-ONLY (E2E) · Critical tier PASS (unit/integration/typecheck/build)

## Critical tier (QA checklist 🔴) — all PASS
- C-01 npm run typecheck .......... PASS (zero errors)
- C-02 npm run build ............... PASS (full route manifest, no plugin conflict)
- C-03 npm run test ............... PASS (1890 passed / 10 skipped / 0 failed)
- C-04 /api/health metrics field .. PASS (unit-tested: present, number, no status impact)
- C-05 instrumentation.ts + next.config withSentryConfig present .. PASS

## Functional tier (QA checklist 🟡)
- Unit-verifiable items covered: F-03 (url_hash not raw URL) and the
  redactUrls security assertions (token in query never survives) are
  covered by src/__tests__/sentry-redact-urls.test.ts (14 tests).
- F-01/F-02/F-04 (traces/measurement/release visible IN Sentry) require a
  live DSN + staging — not assertable in CI without secrets. Documented in
  docs/observability.md as operator verification steps. Not a gate failure.
- F-05 (active_scans increments live) — getter contract unit-tested;
  full inc/dec lifecycle covered by existing scan-worker integration tests.

## E2E
- Verdict: CI-ONLY.
- Rationale: this is an observability-only change. Sentry server-side
  instrumentation, beforeSend/beforeSendTransaction scrubbing, scan spans,
  and the additive health metrics field produce NO user-facing UI/flow
  change — there is no DIRECT E2E surface. Asserting Sentry ingestion
  requires a live DSN, unavailable in CI without secrets. Running the
  pre-existing Playwright suite in this ephemeral container (no seeded
  DB/auth env) is an EXTERNAL/environment condition, not a code signal.
- The full pre-existing E2E suite runs unchanged in GitHub CI on the PR
  (test.yml E2E job). No @critical E2E test exercises telemetry.
- Classification: EXTERNAL (environment), not DIRECT/COLLATERAL. No
  regression suspected — blast-radius is clean (0 unlinked, 0 shared-ripple).

## Gate impact
No @critical failure. Automation Gate does not block Gate 3.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
