# TODO — Comprehensive E2E Integration Coverage

> At-a-glance mirror of the Phase-1 plan. Source of truth: pipeline/plan.md +
> pipeline/tasks/T-XX.json (seeded at Phase 2). Orchestrator is the sole writer.

Status: **Phase 1 — awaiting Human Gate 1** (plan converged 8/10, 5 Red Team sprints).

## Wave 0 — blocking (surfaced to user)
- [ ] Fix commented-out PAYMENT_TEST_FLOW production guard in checkout/route.ts (live security defect)
- [ ] vitest regression test for the prod guard (no DB write, 404, no leak)
- [ ] Reconcile existing 6 specs + empirical `npm run dev` boot measurement

## Wave 1 — shared infra (single-owner each)
- [ ] playwright.config: keep `npm run dev`, raise webServer.timeout, add ADMIN_EMAILS
- [ ] globalSetup (delete e2e.db*, db-config development, assert sqlite, db push, seed) + globalTeardown
- [ ] e2e/support/auth-seed.ts (DB User+Session seeder, storageState, tier isolation)
- [ ] Wave-1 PROBE spec (auth provider + getCurrentUser + DB touch; Prisma-init = hard stop)
- [ ] Expand DB seed helpers (userId-scoped, completed scan, verification, P5, tiered users)
- [ ] Hybrid data-testid sweep + selectors.ts constants (one task, static literals only)

## Wave 2/3 — risk-tiered page + component specs
- [ ] 🔴 behavioral: login/signup/verify/active-test/checkout/dashboard/scan/report/internal×6
- [ ] 🟡 interaction: interactive components within owning page specs + hostless standalone
- [ ] 🟢 smoke: legal×3/docs/demo×3/error/not-found + presentational components
- [ ] Seeded scan-lifecycle (RUNNING/TIMEOUT/COMPLETED) + 1 real-scan submission
- [ ] Coverage matrix appendix + locale-switch smoke + a11y sweep

(Decomposed into T-XX contracts at Phase 2 after Gate 1 approval.)
