# Implementation Plan — Playwright E2E infra + CI + landing-page critical path

## Goal
Bootstrap a Playwright E2E test framework (none exists today), wire it into
GitHub Actions CI, and add full critical-path automated tests for the landing
page (`src/app/[locale]/page.tsx` → `landing-hero.tsx`).

## Context (verified in repo)
- No `playwright.config.*`, no `e2e/`, no `test:e2e` script. `playwright@^1.59.1`
  is a dependency (used by the scanner crawler), `@playwright/test` is NOT.
- Landing route: `/en` (next-intl `localePrefix: 'always'`; `/` → `/en`).
- Hero scan form: `form[role=search].url-bar` with `input#hero-url` + submit
  button. `handleScan()` → `createScan(target)` POSTs `/api/v1/scans`, then
  `router.push('/scan/{id}?url=...')`. Empty input defaults to `example.com`.
- Landing also fetches `GET /api/v1/stats/scan-count` for the weekly counter.
- `vitest.config.ts` `include` globs `**/*.{test,spec}.ts` — it WILL pick up
  Playwright `*.spec.ts` and crash the unit run unless `e2e/**` is excluded.
- CI: `.github/workflows/test.yml` has `test` + `build` jobs, Node 20.19.

## Red Team revisions folded in (sprint 1)
- Nav assertion fixed: `landing-hero.tsx` uses next-intl's locale-prefixing
  `useRouter` → submit lands at `/en/scan/<id>` (NOT `/scan/<id>`). Assert
  `/\/en\/scan\/[^/?]+/`.
- Destination `/en/scan/<id>` page polls `GET /api/v1/scans/:id`,
  `/scans/:id/findings`, `/scans/:id/events` and reads cookie
  `sentry:lastScanVariant`. The `@critical` critical-path test asserts the
  URL transition ONLY; the "no console/page errors" assertion is confined to
  the landing-render test (pre-submit). Shared mock helper additionally
  stubs the three `/scans/:id*` GETs defensively so the destination never
  500s in a test.
- `@playwright/test` pinned to EXACT `1.59.1` (no caret) to match the
  resolved `playwright@1.59.1` — verified published; npm registry egress
  verified reachable from this environment.
- `package-lock.json` regenerated + committed is a HARD acceptance criterion
  and a CI prerequisite (npm ci needs it).
- `webServer.timeout` 180s; generous navigation/expect timeouts (cold Next
  compile + prisma db push in CI). CI caches `~/.cache/ms-playwright` keyed
  on the Playwright version.
- `workers: 1` for the first iteration (removes a flake class cheaply).

## Work items
1. **Dependency:** add `@playwright/test` pinned to EXACT `1.59.1` (no
   caret — must equal resolved `playwright@1.59.1`) as a devDependency;
   regenerate `package-lock.json` via npm (lockfileVersion 3). Do NOT touch
   `yarn.lock`.
2. **`playwright.config.ts`** (repo root): `testDir: './e2e'`,
   `baseURL: http://localhost:3000`, chromium-only project, `workers: 1`,
   `webServer` running `npm run dev` with hermetic env
   (DEV_DATABASE_URL=file:./e2e.db, NEXTAUTH_SECRET dummy,
   AUTH_PROVIDER=nextauth), `reuseExistingServer: !CI`, 180s server
   timeout, retries 1 in CI / 0 local, `forbidOnly: !!CI`, trace
   `on-first-retry`, HTML + list reporters.
3. **`e2e/` tests** (hermetic — `page.route` mocks `/api/v1/scans` POST,
   `/api/v1/stats/scan-count`, and defensively `/api/v1/scans/:id*` GETs;
   never create real scans / hit network):
   - `@critical` landing renders (hero heading, `#hero-url`, submit button,
     nav, footer; no console/page errors — this test does NOT submit).
   - `@critical` critical path: fill `#hero-url`, submit → URL transitions
     to `/en/scan/<mocked-id>` (assert URL only; no destination assertions).
   - `@functional` empty input → request body `{url:"example.com"}` + URL
     transition.
   - `@functional` final-CTA "pricing" link → `/en/pricing`.
   - `@functional` `/` redirects to `/en`.
   - `@non-blocker` weekly counter shows mocked count; FAQ first item open.
   - Shared mock helper `e2e/support/mocks.ts` (DRY).
4. **`package.json` scripts:** `test:e2e` = `playwright test`;
   `test:e2e:ui` = `playwright test --ui`. Leave all others untouched.
5. **`vitest.config.ts`:** add `'e2e/**'` to `exclude` (mandatory — prevents
   Vitest from running Playwright specs).
6. **CI:** add a parallel `e2e` job to `test.yml`: Node 20.19, `npm ci`,
   cache `~/.cache/ms-playwright` keyed on resolved Playwright version,
   `npx playwright install --with-deps chromium`, hermetic env, `npm run
   test:e2e`, upload `playwright-report/` artifact `if: always()`. Existing
   `test`/`build` jobs unchanged.
7. **`.gitignore`:** ignore `/test-results/`, `/playwright-report/`,
   `/blob-report/`, `/playwright/.cache/`, `e2e.db*`.
8. **Selectors:** use existing semantic selectors only (`#hero-url`, roles,
   labels) — NO edits to product code (`landing-hero.tsx`).

## Risks
- R1 feasibility: `@playwright/test` + browser binary download needs network;
  the sandbox network policy may block it. CI has network so CI works. If
  local install is blocked, report at a gate — never fake it.
- R2 hermeticity: real submit triggers a 120s scan + network. Mitigation:
  Playwright route mocking. Core design decision.
- R3 vitest/playwright collision (item 5) — mandatory exclude.
- R4 CI dev-server boot needs SQLite + NEXTAUTH env; `start` uses PROD db
  config (do not use it) — use `npm run dev`.
- R5 CI time: chromium-only, no sharding first pass.
- R6 locale prefix: target `/en` / assert redirect.
- R7 selector brittleness: semantic selectors, no product-code change.

## Decisions for user
- D1: hermetic via request mocking (recommend YES).
- D2: e2e as its own CI job on push/PR to main/develop (recommend YES).
- D3: semantic selectors only, no product-code edits (recommend) vs add
  `data-testid` to landing-hero.tsx.
