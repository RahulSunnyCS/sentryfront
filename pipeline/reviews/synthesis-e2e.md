# Phase 4 Synthesis Review

Verdict: **CONDITIONAL PASS**

| Reviewer | Verdict | C | H | M | L |
|---|---|---|---|---|---|
| Security (Opus/max) | PASS | 0 | 0 | 0 | 3 |
| Performance | PASS | 0 | 0 | 0 | 7 |
| Architecture | CONDITIONAL PASS | 0 | 0 | 2 | 3 |
| Pricing | CONDITIONAL PASS | 0 | 0 | 1 | 1 |

No reviewer conflicts. All agree the two revenue/authz holes this epic
targeted (T-01 PAYMENT_TEST_FLOW prod guard, T-19 active-test tier gate) are
verifiably closed with no new holes; the security audit explicitly confirms it.

## Conditions (Phase 4.5 Bounded Fix Cycle — before Phase 5)

- **C1 (Arch Medium F1).** `e2e/support/coverage-matrix.ts` falsely marks
  `component/payment-modal` as DIRECT; checkout.spec.ts only exercises the
  checkout-modal, never the payment-modal upsell — a hidden orphan the
  anti-orphan gate passes over. Given the user's explicit "every component"
  goal, FIX properly: add a `@functional` payment-modal smoke (open the upsell,
  assert tier names visible, reuse the dollar-amount negative guard — never
  assert amounts) so the DIRECT entry is genuinely true.
- **C2 (Arch Medium F2).** `authStorageState()` is re-implemented as inline
  cookie literals in 4 specs (checkout.spec.ts, active-test.spec.ts,
  active-test.a11y.spec.ts, auth.a11y.spec.ts), breaking the single-home
  contract. Replace all with the exported `authStorageState()` from
  `e2e/support/auth-seed.ts`; delete the local `sessionStorageState` copies.
- **C3 (Pricing Low — its explicit PASS condition).**
  `src/app/[locale]/active-test/page.tsx:12,18` metadata/openGraph carry
  hardcoded `$5,000`/`$3.48` (May-2026 pivot exposure on crawled surfaces).
  Replace with non-price-anchored copy.

## Accepted risks / documented follow-ups (NOT conditions)

- Pricing Medium: T-09 acceptance #4 (post-bypass → active-test) proven at the
  vitest precondition layer, not a single E2E round-trip — architecturally
  forced (PAYMENT_TEST_FLOW can't be per-test on a shared server; same as the
  Phase-1 C4 / T-01 precedent). Dev/staging-only; prod guard closes the bypass
  entirely. Accepted, documented.
- Performance: NavPreferences transient CLS for signed-in users — follow-up
  (`visibility:hidden` instead of `return null`); non-blocking.
- Security 3 Low: all informational / by-design / pre-existing (T-01 NODE_ENV
  dependence is the tracked pre-GA item; T-19 flag asymmetry non-exploitable;
  seeder DEV_DATABASE_URL is dev-sqlite-only).
- Arch Low F3/F4/F5: selectors single-home gaps in a PRE-EXISTING spec
  (performance-report.spec.ts) + BENIGN_CONSOLE duplication — follow-up
  cleanup, non-blocking. T-10's one inline `active-test-upgrade-prompt`
  literal: ACCEPTED (selectors.ts was out of T-10 scope; testid shipped by
  T-19).
- Pre-existing: payment-modal.tsx hardcoded $9/$29/$15 (file not modified by
  this epic) — observation, not a condition.

VERDICT EXPLANATION: All Critical/High = 0. Core security objectives met and
independently verified. CONDITIONAL PASS because 3 small, well-scoped Medium/
PASS-condition items (a false coverage claim on a revenue-path component, a
broken single-home contract across 4 specs, and crawlable stale price copy)
should be remediated before Phase 5. All conditions are bounded and have
disjoint-enough file sets to parallelize in the Phase 4.5 fix cycle.
