# Implementation Plan v2 — Playwright E2E infra + CI + landing-page critical path

> Revised at Gate 1 with user decisions D1/D2/D3 + accepted AI recs R1/R2.
> Recommendation re-plan round 1 of 2.

## Goal
Bootstrap a Playwright E2E framework (none exists), wire it into GitHub
Actions CI, and add **non-hermetic** full critical-path tests for the
landing page that exercise the REAL `/api/v1/scans` flow.

## Gate-1 decisions folded in
- **D1 — DO NOT fake the API.** Tests submit a real URL; the real
  `POST /api/v1/scans` runs (validates, rate-limits, creates a `Scan` row,
  kicks `runScan` in the background). Tests assert the URL transition to
  `/en/scan/<real-id>` (regex `/\/en\/scan\/[^/?]+/`) — navigation does not
  wait for the scan to finish, so this stays fast. Request payload is
  asserted by **observing** the outgoing POST (`page.waitForRequest`), not
  by stubbing it. No `page.route` interception anywhere.
- **D2 — CI job: yes, with a local-first fallback.** Add a parallel `e2e`
  job to `.github/workflows/test.yml`. Locally, run `npm run test:e2e`
  during Phase 6; **if the suite cannot run here** (dev server won't boot /
  scanner browsers absent / no network egress for the real scan), mark the
  Automation Gate **CI-ONLY**, log the exact reason, and proceed without
  blocking (per CLAUDE.md Phase 6 Automation Gate CI-ONLY rule). Do NOT
  open a PR (not requested).
- **D3 — Add `data-testid` to product code.** Add minimal stable hooks to
  `src/app/[locale]/landing-hero.tsx`: `hero-url-input` (the input),
  `hero-scan-submit` (submit button), `hero-scan-form` (the form), and
  `final-cta-pricing` (the pricing Link in `FinalCTASection`). No behaviour
  change — attributes only.

## Red Team sprint 2 fixes folded in (verified in repo)
- **Wire format VERIFIED.** `src/lib/api.ts:10,47-52`: `createScan` does
  `fetch('/api/v1/scans', { method:'POST', body: JSON.stringify({ url }) })`.
  `landing-hero.tsx:92-93` then `router.push('/scan/${id}?url=...')` →
  next-intl yields `/en/scan/<id>?url=<encoded>` (query string present).
  So: POST body assertion `{ url: 'https://example.com' }` is correct (use
  `toMatchObject` for resilience); URL assertion uses
  `page.waitForURL(/\/en\/scan\/[^/?]+/)` (matches path before `?`).
  Anon scans allowed, 402 is `if(user)` weekly-quota only, `runScan` is
  fire-and-forget (route returns 201 immediately) → navigation is fast.
- **`reuseExistingServer: false`** (always let Playwright own the server)
  so the high `RATE_LIMIT_PER_HOUR` env AND a fresh `e2e.db` actually take
  effect. The rate limiter counts `Scan` rows per IP/hour with default
  **10** (`rate-limiter.ts:18`) — a stray reused dev server on the default
  would 429 mid-suite. Not reusing eliminates that class.
- **CI enforcement is real, local is advisory (user-accepted D2).** The CI
  `e2e` job is a normal job with NO `continue-on-error` → a broken
  critical path turns the CI workflow RED (real regression enforcement).
  Locally, if the suite can't run (no DNS/egress for the in-request
  `dns.resolve4` in `url-validator.ts:120`, or dev server won't boot) it is
  marked **CI-ONLY** and the pipeline proceeds — this is the user's
  explicit D2 choice and is surfaced at the Gate so it is knowingly
  accepted. No job split (avoids over-engineering).

## Work items
1. **Deps:** add devDependencies `@playwright/test` pinned EXACT `1.59.1`
   (must equal resolved `playwright@1.59.1`) and `@axe-core/playwright`
   (latest compatible). Regenerate + commit `package-lock.json`
   (lockfileVersion 3). Never touch `yarn.lock`. (Registry egress verified.)
2. **`playwright.config.ts`** (repo root): `testDir: './e2e'`,
   `baseURL: http://localhost:3000`, chromium-only, `workers: 1`,
   `webServer` = `npm run dev` with hermetic-infra env
   (DEV_DATABASE_URL=file:./e2e.db, NEXTAUTH_SECRET dummy,
   AUTH_PROVIDER=nextauth, RATE_LIMIT_PER_HOUR=100000 to stop the real
   scans endpoint 429-ing across retries), `reuseExistingServer: false`
   (Playwright always owns the server so env + fresh e2e.db apply),
   `webServer.timeout` 180000, `forbidOnly: !!CI`, retries 1 in CI / 0
   local, trace `on-first-retry`, navigation/expect timeouts generous,
   reporters list + html.
3. **Product-code hooks (D3):** add the four `data-testid` attributes in
   `landing-hero.tsx` (HeroSection input/button/form + FinalCTASection
   pricing Link). Nothing else in that file changes.
4. **`e2e/` tests** (NO mocking; real backend):
   - `e2e/landing.spec.ts`:
     - `@critical` Landing renders: goto `/en`; assert hero heading,
       `[data-testid=hero-url-input]`, `[data-testid=hero-scan-submit]`,
       nav, footer visible; assert no console errors / no page errors
       **on the landing page before any submit**.
     - `@critical` Critical path (real scan): fill the input with
       `https://example.com`; start `page.waitForRequest('**/api/v1/scans')`
       BEFORE submit; submit; assert the captured request method=POST and
       body `{ url: 'https://example.com' }`; assert URL transitions to
       `/\/en\/scan\/[^/?]+/`. No assertions on the destination page.
     - `@functional` Empty input defaults to `example.com`: clear input,
       observe POST body `{ url: 'example.com' }`, assert URL transition.
     - `@functional` Final-CTA pricing link → `/en/pricing`.
     - `@functional` `/` → `/en` redirect.
     - `@non-blocker` Weekly counter renders a number (real
       `/api/v1/stats/scan-count`); FAQ first item open by default.
   - `e2e/landing.a11y.spec.ts` (R1):
     - `@functional` axe-core scan of `/en`: no `serious` or `critical`
       impact violations (minor/moderate pre-existing issues do not
       hard-block — keeps it from failing on cosmetic legacy issues while
       still guarding the product's own a11y promise).
   - No shared mock helper (D1 removes mocking). A tiny
     `e2e/support/selectors.ts` centralises the data-testid strings (DRY).
5. **`package.json` scripts:** `test:e2e` = `playwright test`;
   `test:e2e:ui` = `playwright test --ui`. Others untouched.
6. **`vitest.config.ts`:** add `'e2e/**'` to `exclude` (mandatory — the
   `**/*.spec.ts` include would otherwise run Playwright specs in the unit
   run and crash CI `npm run test`).
7. **CI:** add a parallel `e2e` job to `test.yml`: Node 20.19, `npm ci`,
   cache `~/.cache/ms-playwright` keyed on Playwright version,
   `npx playwright install --with-deps chromium`, env (CI=true, the same
   hermetic-infra env + high RATE_LIMIT_PER_HOUR), `npm run test:e2e`,
   upload `playwright-report/` artifact `if: always()`. Existing
   `test`/`build` jobs unchanged. The `e2e` job is non-blocking to the
   other jobs (separate job; its own check status).
8. **README (R2):** add the Tests-workflow CI status badge near the top and
   a short line: E2E report is published as the `playwright-report`
   workflow artifact. README is the only doc touched.
9. **`.gitignore`:** ignore `/test-results/`, `/playwright-report/`,
   `/blob-report/`, `/playwright/.cache/`, `e2e.db*`.

## Risks (re-attacked for the non-hermetic shift)
- **R-A (was R2, now elevated) Non-hermetic flakiness/feasibility.** Real
  submit triggers a real background scan (Playwright crawl + Lighthouse to
  example.com, up to 120s) and needs the scans API fully working
  (URL-validator, rate-limiter, DB, free-tier auth). The navigation test
  itself is fast (does not await scan completion), but the background scan
  loads the dev server and needs outbound network. Likelihood of
  not-runnable-locally: HIGH in this sandbox. Mitigation: D2 CI-ONLY
  fallback — attempt locally, on failure log+continue, rely on CI (which
  has egress). High RATE_LIMIT_PER_HOUR prevents 429 across retries.
- **R-B Rate limit / 402.** Free deterministic scan needs no payment (402
  is DAST-only) so the free path is fine; 429 mitigated by env. Validated
  by reading the scans route in Phase 3.
- **R-C vitest/playwright collision** — mandatory exclude (item 6).
- **R-D CI dev-server boot** — 180s budget, generous waits, browser cache.
- **R-E Locale prefix** — assert `/en/...`, redirect test covers `/`.
- **R-F axe noise** — scoped to serious/critical impact only so legacy
  cosmetic issues don't hard-fail a `@functional` test.
- **R-G data-testid in product code** — attributes only, zero behaviour
  change; reviewed by architecture-reviewer in Phase 4.

## Decisions — all resolved at Gate 1
D1 no-fake ✅ · D2 CI + local-or-CI-ONLY ✅ · D3 data-testid ✅ ·
R1 axe ✅ · R2 README badge ✅ · R3 second browser ❌ deferred.
