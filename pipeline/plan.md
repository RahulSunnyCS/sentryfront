# Phase 1 Plan — Comprehensive E2E Integration Coverage (v5, converged 8/10)

Lane: feature-full · Risk: HIGH · Epic split (5 tags) · 5 Red Team sprints, converged.

## Goal
Playwright E2E coverage for every one of ~28 pages and 31 components of VibeSafe,
at risk-appropriate depth, so coverage is provably complete (every page/component
maps to >=1 asserting spec).

## Reconciliation with existing E2E assets (factual prerequisite)
Existing: playwright.config.ts (`npm run dev`, explicitly "non-hermetic"), 6 specs
(landing, landing.a11y, performance-report, compliance-report, report-calibration,
security-modules), perf-db-seed.ts, selectors.ts. Decision: the two philosophies
**coexist by domain, not reversed** — the scan-submission flow stays non-hermetic
(real /api/v1/scans: landing/security specs unchanged); page/component coverage is
hermetic seeded-DOM via a new auth-seed. perf-db-seed.ts coexists (additive),
auth-seed.ts is new, selectors.ts is extended (AR-L2 single-home preserved).
globalSetup truncate-before-suite is safe for the 6 existing specs (none depend on
persistent cross-spec e2e.db rows).

## Wave 0 — blocking, surfaced to user
- (a) CODE FIX: implement the PAYMENT_TEST_FLOW production guard in
  `src/app/api/v1/checkout/route.ts`. It is currently **commented out**
  (lines 41-47) — a live free-tier-grant / revenue-integrity defect. The guard
  (`NODE_ENV==='production' && PAYMENT_TEST_FLOW==='true'` → log + HTTP 404,
  consistent with the route's existing not-enabled 404 at line 81, avoids leaking
  the bypass's existence) MUST return **before** any `getCurrentUser()` (line ~49)
  and **before** any `prisma.user.update` (line ~58).
- (b) prod-guard regression test is **vitest unit/integration**, not E2E. In the
  prod+flag case it asserts ALL of: `getCurrentUser` not called, `prisma.user.update`
  not called, status 404, body carries no tier/session payload.
- (c) Reconciliation audit (above) + a one-time empirical boot of `npm run dev`
  with the e2e webServer.env; record first-ready time in the Plan Report.

## Wave 1 — shared infra, single-owner each, blocking
- `playwright.config.ts`: keep `command: 'npm run dev'` UNCHANGED (no
  next-build/next-start; that path is eliminated, not patched — `npm run dev`
  always calls `db-config development`, so the schema can never be rewritten to
  postgresql). Raise `webServer.timeout` 180000 → value from the Wave-0 boot
  measurement (>=600000 expected); update the lines 14-15 comment. Add
  `ADMIN_EMAILS=e2e-admin@vibesafe.test` to `webServer.env`. Do NOT add
  NODE_ENV; do NOT add PAYMENT_TEST_FLOW globally (only the checkout-flow spec
  injects it).
- `playwright globalSetup` (owns ALL schema+seed; server does none extra):
  delete glob `e2e.db*` (incl -wal/-shm) → `node scripts/db-config.js development`
  → assert `prisma/schema.prisma` datasource provider == sqlite (hard fail if
  postgresql) → `prisma db push` → seed. Invariant (documented, comment-guarded):
  globalSetup completes fully before webServer starts; seeding must never move to
  a server-parallel hook. The dev server's own idempotent `prisma db push` against
  the already-seeded sqlite db is declarative/non-destructive on zero schema delta
  (Prisma 5.22). `globalTeardown` runs `git checkout -- prisma/schema.prisma` only
  when `CI` is set (protects in-progress local schema edits).
- `e2e/support/auth-seed.ts`: insert User + Session rows. Contract: cookie
  `next-auth.session-token` value == `Session.sessionToken` row value (any
  cryptographically-random unique string; format need NOT mirror establishSession);
  `Session.expires = now + 30d`. Exports `seedAuthUser(email,tier)`+cleanup,
  `authStorageState(token)`. NOT a global seed.
- Wave-1 PROBE spec (runs after full cold compile): asserts (i) server reports
  `getAuthProvider()==='nextauth'` (via getFeatureStatus/health), (ii)
  `getCurrentUser()` resolves through a real protected route with the seeded
  cookie, (iii) a real DB write+read through the server succeeds. A
  `PrismaClientInitializationError` (error **class**, not message substring) on
  the probe is a HARD Wave-1 STOP (no retry, surface to user); any other non-2xx
  is a normal DIRECT Wave-1 failure.
- Tier-isolation rule (generalized): EVERY tier-sensitive or tier-mutating spec
  (checkout-bypass, active-test, dashboard-by-tier, admin) seeds its OWN dedicated
  unique-email user and cleans it in afterAll — never the global seeded user
  (the nextauth session callback re-reads tier from DB each request and the
  checkout bypass mutates User.tier server-side).
- DB seed helpers: add userId-scoped variants (dashboard/scan filter by userId —
  anonymous userId:null rows are invisible to them); keep anonymous variant only
  for the public report page. Seeds for: completed multi-domain scan,
  user-with-scans, domain-verification, P5 compliance, tiered users.
- testid sweep: ONE Wave-1 task (race-safety). testids are STATIC string literals
  only, never bound to user/session/scan/scanId data; every new testid declared
  as a constant in `e2e/support/selectors.ts` (no inline literals). Phase-4
  senior-engineer must specifically diff the security-surface files
  (checkout, login, signup, active-test), not treat the sweep as bulk mechanical.

## Wave 1→2 gating (relaxed)
Wave 2/3 spec files are AUTHORED regardless of in-sandbox browser availability
(authoring needs no browser). Only EXECUTION is the checkpoint: Phase-6
Automation Gate is CI-ONLY if chromium cannot install in-sandbox. No mid-pipeline
CI stall.

## Wave 2/3 — risk-tiered depth (every page+component IS covered)
- 🔴 behavioral E2E: login (real credentials sign-in), signup, verify, active-test
  (tier-gated both directions), checkout flow (PAYMENT_TEST_FLOW outcomes per
  pricing memo: one-shot +1 credit, pro +5 one-time NOT subscription, studio
  subscription +0 credits; unauth checkout → 401; payments-disabled → 404),
  dashboard (user-scoped), scan/[id], report variants, internal×6 (incl.
  non-admin-404 using a VALID authenticated NON-admin session to prove
  existence-hiding for logged-in non-admins).
- 🟡 interaction: interactive components asserted WITHIN their owning page's
  spec where they render; standalone specs only for hostless components
  (toast, locale-switcher, theme-toggle).
- 🟢 smoke (200 + heading + no console error): static legal×3, docs, demo×3,
  error/not-found, pure-presentational components (logo, icons, severity-badge,
  grade-display, footer).
- Scan-lifecycle specs (RUNNING/TIMEOUT/COMPLETED): ONLY pre-seeded
  Scan/Finding/ScanEvent rows, never call /api/v1/scans. The single real-scan
  spec asserts submission + redirect ONLY, never awaits a terminal state.
- Wave 3: component→spec coverage matrix as an auto-derived appendix proving
  every 28 pages + 31 components map to >=1 spec; locale-switch smoke spec
  (hi/ml/es/de — rationale: next-intl key presence is unit-testable, E2E only
  needs the switch mechanism); a11y sweep extension.

## Gate-1 decisions
- D1 selectors: hybrid data-testid (forms/CTAs/dynamic regions/tab panels) +
  role/text elsewhere.
- D2 "every component" = provable page-driven coverage matrix, NOT 31 mount
  harnesses (Playwright component testing not viable for Next App Router).
- D3 locale: assert content on `en`; ONE locale-switch smoke for hi/ml/es/de.
- D4 auth: DB-session auth-seed + ONE real credentials-login spec.
- D5 scan: ~1 real /api/v1/scans submission flow + seeded lifecycle states.
- D6 depth: risk-tiered 🔴/🟡/🟢 (this is HOW "every page+component" is
  delivered without coverage theater — not a scope cut; user's literal ask is
  honored, depth is the decision).
- D7 prod-guard behaviour: production + PAYMENT_TEST_FLOW=true → 404 (recommended).

## Risks (tracked)
R1 testid product-code churn (bounded, static-literal criterion, security-file
diff). R2 auth-seed DB-session contract (probe gates it). R3 CI serial wall-time
(workers:1 non-hermetic; quantified, timeout sized, stated). R4 browsers not
installed → Phase-6 Automation Gate likely CI-ONLY (stated honestly). R5
PAYMENT_TEST_FLOW must never reach prod (Wave-0 fixes the live commented-out
guard). R6 admin 404 existence-hiding tested with a real non-admin session.
R7 scope explosion bounded by the depth tiers. R8 OAuth-popup / Stripe-redirect
pages get bounded documented partial coverage, not faked green.
