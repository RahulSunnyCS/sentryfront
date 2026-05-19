BLAST-RADIUS VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base : 90dd68f^ (2ec4da5 — last pipeline commit before T-01; the true epic
       start). NOT origin/main: the branch carries 6 pre-existing commits
       (scanner P5/perf/compliance, lighthouse, psi-cache, scan-worker,
       report-utils, yarn.lock — ~109 files) authored BEFORE this session.
       Those are out-of-epic prior-run work, not validated here, surfaced to
       the user for the Gate-3 PR-base decision.

Epic-scope changed files: 60 → all linked. Classification below.

| Changed file(s) | Linked task | Classification |
|---|---|---|
| e2e/support/global-setup.ts, global-teardown.ts, playwright.config.ts | T-03 | valid |
| e2e/support/auth-seed.ts | T-04 | valid (declared Wave-1 shared) |
| e2e/support/db-seed.ts | T-05 | valid (declared Wave-1 shared) |
| e2e/support/selectors.ts + ~17 src files (+1 data-testid attr each: checkout-button, locale-switcher, payment-modal, theme-toggle, toast, scan-progress, login-card, signup-card, verify-flow, domain-entry, report-view, scan-history, resend-button, login-gate-modal, pricing/page, checkout/success/page, active-test-flow) | T-06 | valid (declared Wave-1 shared selectors + attribute-only sweep) |
| e2e/probe.spec.ts | T-07 (+Phase5 gap +1) | valid |
| e2e/auth.spec.ts, e2e/auth.a11y.spec.ts | T-08 (+P4.5 C2) | valid |
| e2e/checkout.spec.ts, checkout.a11y.spec.ts, payment-test-flow-outcomes.test.ts | T-09 (+P4.5 C1/C2) | valid |
| e2e/active-test.spec.ts, active-test.a11y.spec.ts | T-10 (+P4.5 C2, +Phase5 gap +1) | valid |
| e2e/dashboard.spec.ts, dashboard.a11y.spec.ts | T-11 | valid |
| e2e/scan.spec.ts, scan.a11y.spec.ts | T-12 | valid |
| e2e/report-pages.spec.ts, report-pages.a11y.spec.ts | T-13 | valid |
| e2e/internal.spec.ts, internal.a11y.spec.ts | T-14 | valid |
| e2e/static-pages.spec.ts | T-15 | valid |
| e2e/components.spec.ts, support/coverage-matrix.ts, coverage-matrix.spec.ts | T-16 | valid |
| e2e/locale-switch.spec.ts | T-17 | valid |
| print-report.tsx (-2), src/lib/report-utils.ts (-10) | T-18 | valid (dead-code removal) |
| src/app/[locale]/active-test/page.tsx, api/v1/active-test/start/route.ts | T-19 (+P4.5 C3 metadata) | valid |
| src/components/auth-button.tsx, nav.tsx, messages/{en,hi,ml,es,de}.json | T-20 | valid |
| src/app/api/v1/checkout/route.ts, payment-test-flow-guard.test.ts | T-01 | valid |
| src/__tests__/app/active-test-page.test.tsx, app/api/active-test-start.test.ts, components/nav-preferences.test.tsx | Phase 5 (T-19/T-20 surface) | valid |

ESCALATED
- none. selectors.ts / auth-seed.ts / db-seed.ts are consumed by many specs
  but are DECLARED Wave-1 single-home shared modules (T-04/05/06) that
  dependent tasks listed as dependencies — by-design shared, not an
  uncontrolled shared-ripple. No unlinked change.

OUT-OF-EPIC (surfaced, not validated — General Rule 4)
- ~109 files / 6 commits of prior-run scanner P5/perf/compliance work +
  yarn.lock, present on the branch before T-01. A PR opened against origin/main
  will include these. Decision needed at Gate 3: PR base / scope.

SUMMARY
Changed files (epic) : 60
valid                : 60
unlinked             : 0
shared-ripple        : 0
out-of-epic (prior)  : ~109 (surfaced for Gate-3 PR-base decision)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
