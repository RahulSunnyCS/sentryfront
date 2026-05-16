# Phase 4 Synthesis Review — E2E infra + CI + landing critical path

**Branch:** claude/automation-landing-page-infra-8Hfhf
**Reviewer set (MEDIUM / feature-fast):** security-auditor (Opus), architecture-reviewer (Sonnet). Performance not run — test scaffolding has no runtime perf surface.

## Verdict: CONDITIONAL PASS

Condition to clear before the `@critical` suite is trusted as a CI regression gate:
**AR-H1** — make the `@critical landing page renders` console-error assertion robust (filter known-benign dev noise, OR keep only uncaught `pageerror` at `@critical` and demote the `console.error` check to `@functional`). One-line change in `e2e/landing.spec.ts`.

## Security (PASS) — pipeline/reviews/security-audit.md
- 0 Critical / 0 High / 0 Medium.
- **SEC-L1 (Low):** `.github/workflows/test.yml` has no least-privilege `permissions:` block — pre-existing repo-wide gap (existing `test`/`build` jobs share it), not a regression. Suggested follow-up: top-level `permissions: { contents: read }`.
- Info: dummy `NEXTAUTH_SECRET` is test-only/ephemeral, not a real exposure; full-diff secret scan clean; supply chain verified (official scopes, integrity hashes, version-consistent, no typosquats); no SSRF surface (tests only submit example.com, never stub the validator); data-testid additions attribute-only; `RATE_LIMIT_PER_HOUR` scoped to ephemeral CI env only.

## Architecture (CONDITIONAL PASS) — pipeline/reviews/architecture-review.md
- **AR-H1 (High):** `e2e/landing.spec.ts` `@critical` test asserts zero console errors with no category filter. Future Sentry/DSN misconfig or a Next.js dev hydration `console.error` would flip the flagship critical test red with a cryptic message, eroding CI trust. Fix: passlist benign patterns, or move console.error to `@functional` and keep `pageerror` at `@critical`.
- **AR-L1 (Low):** `getByRole('navigation')` has no accessible-name filter — safe today (verified exactly one nav landmark; mobile menu is `role=dialog`, footer `role=contentinfo`, SkipToContent is an `<a>`), but future landmarks would cause a strict-mode violation. Suggest `getByRole('navigation', { name: /primary/i })`.
- **AR-L2 (Low):** `byTestId` uses `page.locator('[data-testid=...]')` instead of `page.getByTestId()`; add `use:{ testIdAttribute:'data-testid' }` to playwright.config.ts so the attribute name has one home.
- **AR-L3 (Low):** Playwright browser cache key keyed only on `hashFiles('package-lock.json')` — any unrelated dep change evicts the ~300 MB browser. Prefix with the pinned version `...-playwright-1.59.1-...`.
- Info: non-hermetic egress to example.com is the accepted Gate-1 D1 / plan R-A risk (CI-ONLY fallback covers local; a network-restricted CI runner would fail at `url-validator.ts` dns.resolve4 — a `SKIP_DNS_VALIDATION` bypass would be the future fix). `playwright` (prod dep, scanner) vs `@playwright/test` (devDep) correctly distinct.
- Positives: waitForRequest registered before click (no race); reuseExistingServer:false + high rate limit + isolated e2e.db is the correct isolation combo; both vitest excludes present; axe correctly scoped to serious/critical and tagged @functional; data-testid purely additive.

## Conflicts between reviewers
None. Security and architecture findings are disjoint and non-contradictory.

## Recommendation
CONDITIONAL PASS. Apply **AR-H1** (blocking condition for trusting the critical gate) plus the cheap Low hardening (SEC-L1 permissions block, AR-L1 named nav, AR-L2 getByTestId/testIdAttribute, AR-L3 versioned cache key) as a single small fix cycle before Phase 6. None require redesign; the architecture is sound.
