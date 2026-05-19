# TODO — Comprehensive E2E Integration Coverage

> At-a-glance mirror of pipeline/tasks/T-XX.json. Orchestrator is sole writer.
> Status: **Phase 2 complete — awaiting approval to start implementation.**
> Cross-artifact check: PASS (pipeline/reviews/cross-artifact-check.md).

## Wave 0 — blocking (security + reconciliation)
- [ ] **T-01** Fix commented-out PAYMENT_TEST_FLOW prod guard + vitest regression (opus/high) — deps: none
- [ ] **T-02** Reconciliation audit + dev-server boot measurement (sonnet/high) — deps: none

## Wave 1 — shared infra (single-owner each, parallel; disjoint files)
- [ ] **T-03** playwright globalSetup/teardown + config (timeout, ADMIN_EMAILS) (sonnet/high) — deps: T-02
- [ ] **T-04** auth-seed.ts DB session seeder + storageState + tier isolation (opus/high) — deps: none
- [ ] **T-05** db-seed.ts userId-scoped + new domain seeders (sonnet/high) — deps: none
- [ ] **T-06** Hybrid data-testid sweep + selectors.ts constants — ONE task (opus/high) — deps: none
- [ ] **T-07** auth-seed PROBE spec — gates Waves 2/3 execution (opus/high) — deps: T-03, T-04

## Wave 2 — 🔴 behavioral page specs (+ R3 axe @functional; parallel)
- [ ] **T-08** Auth: login(real creds)/signup/verify/verify-email-sent/popups + axe (opus/high) — deps: T-04, T-06
- [ ] **T-09** Checkout/pricing: PAYMENT_TEST_FLOW outcomes, tier gating, disabled→404 + axe (opus/high) — deps: T-01, T-04, T-05, T-06
- [ ] **T-10** active-test DAST tier-gating both directions + axe (opus/high) — deps: T-04, T-05, T-06
- [ ] **T-11** dashboard user-scoped scans/pagination/states + axe (sonnet/high) — deps: T-04, T-05, T-06
- [ ] **T-12** scan/[id] seeded lifecycle + 1 real submission + axe (sonnet/high) — deps: T-05, T-06
- [ ] **T-13** report state matrix + print + section components + axe (sonnet/high) — deps: T-05, T-06
- [ ] **T-14** internal admin ×6 — non-admin 404 existence-hiding, admin 200 + axe (opus/high) — deps: T-04, T-06

## Wave 3 — 🟡/🟢 breadth + provable completeness (parallel)
- [ ] **T-15** Static-page smoke batch: legal×3/docs/demo×3/error/not-found 🟢 (sonnet/high) — deps: T-06
- [ ] **T-16** Hostless components + auto-derived coverage matrix (no orphans) (sonnet/high) — deps: T-06, T-08..T-15, T-17
- [ ] **T-17** Locale-switch smoke hi/ml/es/de 🟡 (sonnet/high) — deps: T-06

Execution gate: T-07 PROBE must pass in CI before Wave-2/3 specs are *run*
(authoring needs no browser; Phase-6 Automation Gate is CI-ONLY if chromium
cannot install in-sandbox).
