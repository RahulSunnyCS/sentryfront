AUTOMATION GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result: CI-ONLY (does not block Gate 2/3)

Unit + integration: `npm run test` → 1693 passing / 10 skipped / 0 failing
(deterministic, verified twice). Includes 97 new compliance unit tests +
25 compliance integration tests.

E2E: `npx playwright test e2e/compliance-report.spec.ts` → 0 passed,
0 failed, 7 skipped (the 7 demo-route specs skip because no dev server is
reachable in this sandbox; the 7 P5-populated specs skip because
COMPLIANCE_SCAN_ID is unset). No browser+server runtime here.

Classification per failing E2E test: NONE failed. All compliance E2E are
EXTERNAL-deferred (environment: no dev server / seeded scan), not DIRECT or
COLLATERAL. Per the Automation Gate spec, environmental non-availability is
marked CI-ONLY and does NOT block — it is not counted as a @critical FAIL.

The 14 compliance specs (7 @critical / 5 @functional / 2 @non-blocker) are
fully written and tagged; they execute in CI once BASE_URL + a seeded
COMPLIANCE_SCAN_ID are provided.

Action: none required to proceed. CI must run the E2E suite with a dev
server and a seeded P5 scan to exercise the @critical legal-invariant specs.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
