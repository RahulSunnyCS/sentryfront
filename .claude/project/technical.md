# Technical Context

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js **14.2.29** (App Router), React 18, TypeScript 5 (strict) |
| ORM / DB | Prisma 5.22 — SQLite (dev) / PostgreSQL (prod), provider swapped by `scripts/db-config.js` |
| Auth | NextAuth 4 (GitHub + Google OAuth, email/credentials) + Prisma adapter |
| AI | Anthropic Claude via raw `fetch` to `api.anthropic.com/v1/messages`; default model `claude-sonnet-4-20250514` (env `ANTHROPIC_MODEL`) |
| Styling / i18n | Tailwind CSS 3; next-intl 3 (locales: `en` (default), `hi`, `ml`, `es`, `de`) |
| Scanning | Playwright 1.59 (headless crawl + PDF render), Lighthouse 12 + chrome-launcher, Google PageSpeed API |
| Parsing | cheerio, fast-xml-parser, robots-parser, schema-dts |
| Queue / limits | BullMQ 5 + `redis` (optional), `@upstash/ratelimit` + `@upstash/redis` (optional, short-window) |
| Storage | `@aws-sdk/client-s3` used against **Cloudflare R2** (S3-compatible) for PDF storage (`CLOUDFLARE_R2_*`) |
| Payments / email | Stripe 17; Nodemailer (Gmail SMTP) for verification emails |
| Monitoring | `@sentry/nextjs` 8 (`sentry.{client,server,edge}.config.ts`) |
| Testing | Vitest 4 + Testing Library + happy-dom/jsdom + vitest-mock-extended |

## Package Manager & Runtime

- **Use npm.** `package-lock.json` (lockfileVersion 3) is canonical; CI runs
  `npm ci`. A stray `yarn.lock` also exists at the repo root — **do not run
  yarn**; do not update it.
- **Node:** `test.yml` CI uses Node **18**, `compliance.yml` uses Node **20**,
  Dockerfile is `node:20-alpine`, `@types/node` is `^20`. No `.nvmrc`. Use
  **Node 20** locally.
- `prisma generate` runs automatically on `postinstall`, `dev`, `build`, and
  `start`.

## Essential Commands

Only these scripts exist in `package.json` (see CI caveat below):

```bash
npm run dev          # db-config(dev) → prisma generate → prisma db push → next dev  (http://localhost:3000)
npm run build        # prisma generate → next build
npm run start        # prisma generate → prisma db push → next start
npm run lint         # next lint (ESLint)
npm run test         # vitest run (all tests once)
npm run test:watch   # vitest (watch mode)
npm run db:migrate   # db-config(development) → prisma migrate dev
npm run db:studio    # prisma studio
npm run db:push      # db-config(PRODUCTION) → prisma db push   ← targets prod DB config
npm run db:reset     # delete-db → db-config(dev) → generate → db push
```

Single test: `npx vitest run path/to/file.test.ts` or filter by name with
`npx vitest run -t "test name"`. Coverage: `npx vitest run --coverage`
(threshold 80%, configured in `vitest.config.ts`).

### CI script gotcha (important)

`.github/workflows/test.yml` (push/PR to `main`/`develop`, Node 18) runs
`npm run test`, then `npm run test:corpus`, then `npm run test:coverage`, plus a
build job (`npm run build`). `.github/workflows/compliance.yml` (PR/push `main`,
Node 20) runs `npm run compliance:check-licenses`, `npm run compliance:sbom`,
`npm run typecheck`, `npm run lint`.

**`test:corpus`, `test:coverage`, `compliance:check-licenses`,
`compliance:sbom`, and `typecheck` are NOT defined in `package.json`** — those
CI steps currently fail with "Missing script". Only `test`, `build`, and `lint`
are wired up. Underlying helpers exist as `scripts/corpus.js` and
`scripts/check-licenses.js` but are not exposed as npm scripts, and there is no
`tsc --noEmit` typecheck script at all. Locally, rely on `npm run test`,
`npm run lint`, and `npm run build`. If asked to "make CI pass", wiring these
missing scripts into `package.json` is likely the root fix.

## Repository Structure

```
src/
  app/
    [locale]/            # localized pages (landing, scan, dashboard, report,
                         #   active-test, pricing, demo, legal, login, signup,
                         #   verify, verify-email-sent, checkout, docs)
    api/                 # route handlers: v1/* (scans, active-test, checkout),
                         #   auth/*, webhooks/stripe, cron/*, internal/*, health
    internal/            # admin UI (cron, dispositions, features, fp-rates, scans, users)
    auth/popup-*         # OAuth popup callback/start
  components/            # React components; components/scan-report/ for report UI
  lib/
    scanner/             # index.ts (orchestrator), crawler.ts, lighthouse.ts,
                         #   audit-parser.ts, types.ts, tools/, modules/
    auth/                # helpers.ts, nextauth-config.ts, session.ts, password.ts
    llm/                 # enrichment.ts (Anthropic)
    stripe/, hooks/, mock/, fp-rates/
    scan-worker.ts feature(s).ts dashboard-queries.ts rate-limiter.ts
    ratelimit.ts url-validator.ts verify-domain.ts tier-gating.ts
    report-access.ts scan-format.ts events.ts logger.ts prisma.ts ...
  i18n/routing.ts        # next-intl config (locales, defaultLocale)
  types/                 # shared TS types
  middleware.ts          # auth gate + next-intl
  __tests__/             # tests (also colocated *.test.ts(x) and lib/**/__tests__)
prisma/schema.prisma     # 12 models (datasource provider rewritten per env)
scripts/                 # db-config.js, delete-db.js, corpus.js,
                         #   check-licenses.js, configure-features.js, test-features.js
messages/                # i18n catalogs: en/hi/ml/es/de.json
docs/                    # specs + Next.js learning material (see References)
sentry.{client,server,edge}.config.ts, next.config.mjs, Dockerfile, docker-compose.yml
```

## Architecture

### Scan flow

1. Client POSTs a URL to `/api/v1/scans`; URL validated (`lib/url-validator.ts`),
   rate-limited (`lib/rate-limiter.ts`), `Scan` row created.
2. `lib/scan-worker.ts` `runScan(scanId)` wraps execution in a hard
   `SCAN_TIMEOUT_MS` (default 120000) timeout and runs the scanner alongside
   `emitPlaceholderProgress`.
3. `lib/scanner/index.ts` `runScanner(targetUrl)` crawls (Playwright headless,
   static-fetch fallback) then runs modules in two groups: **Group 1**
   async/I/O-heavy modules in parallel via `Promise.all`; **Group 2**
   synchronous modules; plus PWA-surface modules. Returns `ScannerResult`.
4. Optional LLM enrichment (`lib/llm/enrichment.ts`) adds explanation/impact/fix
   prompt to findings.
5. Findings + grades persisted via Prisma; `ScanEvent` rows emit progress; the
   frontend polls a progress endpoint. On timeout the scan is marked `TIMEOUT`
   with partial findings persisted and a `scan_timeout` event published.

### Auth (`src/lib/auth/helpers.ts`)

Unified, provider-agnostic interface. **NextAuth is the real implementation;
the Supabase branch is a stub (`getCurrentUserSupabase` is a TODO).** Set
`AUTH_PROVIDER=nextauth` — note `lib/features.ts` defaults an *unset*
`AUTH_PROVIDER` to `'supabase'` (which returns no user), while `.env.example`
sets `nextauth`.

- `getCurrentUser(): AuthUser | null` (also `Sentry.setUser`)
- `requireAuth()` — throws if unauthenticated
- `hasTier(user, tier)` — hierarchy `['free','one-shot','pro','studio']`
- `getUserTier()`, `isAuthEnabled()`, `getAuthProvider()`
- `isAdminUser()` / `requireAdminOrNotFound()` (pages → 404) /
  `assertAdminApi()` (API → 404). Admins from `ADMIN_EMAILS` (comma-separated);
  non-admins get **404, not 403**, so admin route existence isn't leaked.

### Middleware (`src/middleware.ts`)

Protects path segments `dashboard`, `verify`, `active-test` by checking
`next-auth.session-token` / `__Secure-next-auth.session-token` cookies;
unauthenticated requests redirect to `/{locale}/login?next=<path>`. Delegates
i18n to `next-intl`. Matcher excludes `api`, `_next`, `_vercel`, `internal`,
the OAuth popup routes, and static files.

### Feature flags (`src/lib/features.ts`)

`features` is a frozen object of booleans (all default `true`), overridable
via the `FEATURES` env var (JSON, e.g.
`FEATURES='{"stripe":false,"llmEnrichment":false}'`). Companion config objects:
`llmConfig` (Anthropic), `pdfConfig` (Cloudflare R2), `stripeConfig`,
`authConfig`. Use `isFeatureReady(name)` (enabled **and** configured) before
invoking a feature; `getFeatureStatus()` for health/admin. Flag-off output is
intentionally byte-identical to the pre-feature version (no stubs/placeholders).

### Database (`prisma/schema.prisma`)

12 models: `User`, `Account`, `Session`, `VerificationToken`, `Scan`,
`Finding`, `FindingDisposition`, `ScanEvent`, `DomainVerification`,
`FeatureFlag`, `FeatureFlagAudit`, `FpRateSnapshot`. The `datasource` provider
is hardcoded `sqlite` in the file but **rewritten by `scripts/db-config.js`**
(`development` → SQLite/`DEV_DATABASE_URL`, `production` →
PostgreSQL/`DATABASE_URL`) — do not hand-edit the provider line.

### Scanner modules (`src/lib/scanner/modules/`)

- Security **P1**: `p1-01`…`p1-18` (18 modules) — individually imported and
  orchestrated in `scanner/index.ts`.
- Performance **P2** (`p2-01`…`p2-06`) wrapped by `runPerformanceModules`
  (`modules/performance.ts`).
- Accessibility **P3** (`p3-01`…`p3-05`) wrapped by `runAccessibilityModules`
  (`modules/accessibility.ts`).
- SEO **P4** (`p4-01`…`p4-06`) wrapped by `runSEOModules` (`modules/seo.ts`),
  plus `seo-corroborate.ts`.
- Compliance **P5**: `p5-01`…`p5-06` (6 modules, signal-detection only — not
  legal attestation) — wrapped by `runComplianceModules` (`modules/compliance.ts`),
  feature flag `complianceScanning` (default on).

Note: the README/older docs say "15 security modules" — that is **stale**; the
current count is 18 P1 modules. P5 (compliance) is new as of this run.

## Key Patterns & Conventions

- **Scanner module signature:** `async function runXxxModule(crawl): Promise<RawFinding[]>`
  — never invent findings, upgrade severity, or emit unredacted secrets. File
  naming is strict: `p<phase>-<NN>-<name>.ts`. Register new P1 modules by
  importing and adding them to the correct group in `scanner/index.ts`, and add
  display metadata to `SCAN_MODULES` in `src/lib/data.ts`.
- **Server vs Client Components:** App Router defaults to Server Components;
  add `'use client'` only when hooks/browser APIs are needed.
- **i18n:** all user-facing strings go through next-intl; pages use
  `await getTranslations()`. Add new strings to every file in `messages/`.
- **Errors:** log via `src/lib/logger.ts` (wraps Sentry). Authenticated
  requests attribute the user to Sentry in `getCurrentUser`.
- **Pagination:** dashboard/scan lists use cursor-based pagination
  (`lib/dashboard-queries.ts`), not offset.
- **Secret hygiene:** `lib/llm/enrichment.ts` masks API keys, JWTs, Stripe
  keys, cookies, auth headers, and emails before sending to the LLM; batches
  ≤40 findings/request and degrades gracefully if the API/token budget fails.
- **TypeScript:** strict mode; path alias `@/*` → `src/*` (`tsconfig.json`).
- **Formatting (`.prettierrc`):** `semi: true`, `singleQuote: true`,
  `trailingComma: "all"`, `printWidth: 100`.
- **Lint (`.eslintrc.json`):** extends `next/core-web-vitals` +
  `next/typescript`; test/config files are ignored.
- **Commits:** short imperative subjects; optional conventional prefixes seen in
  history (`fix:`, `docs:`, `feat:`); PR merges reference `#NN`.

## Testing

- Vitest + Testing Library; environment jsdom/happy-dom; 10s test timeout;
  coverage thresholds 80% (branches/functions/lines/statements).
- `vitest.setup.ts` mocks Prisma (vitest-mock-extended), Next.js
  router/headers, Playwright, Sentry, NextAuth, `fetch`, and console.
- Tests live in `src/__tests__/`, colocated `*.test.ts(x)`, or
  `src/lib/**/__tests__/`. Stub external services (Anthropic, Lighthouse) with
  mocked responses; never hit the network.

## Environment Variables

Full reference: `.env.example`. Highlights:

- **Core:** `NODE_ENV`; `DEV_DATABASE_URL` (SQLite, e.g. `file:./vibesafe.db`);
  `DATABASE_URL` (PostgreSQL, prod); `NEXTAUTH_URL` (must match the running
  port — dev server is `http://localhost:3000`; the example file uses `:3001`,
  align it); `NEXTAUTH_SECRET` (`openssl rand -base64 32`).
- **Auth:** `AUTH_PROVIDER=nextauth`; `GITHUB_ID/SECRET`,
  `GOOGLE_CLIENT_ID/CLIENT_SECRET`; `ADMIN_EMAILS` (comma-separated).
- **Optional features:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`;
  `PAGESPEED_API_KEY`; `CLOUDFLARE_R2_*` (PDF storage — used by `pdfConfig` but
  absent from `.env.example`, add when enabling PDF); `STRIPE_SECRET_KEY`,
  `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`;
  `PAYMENT_TEST_FLOW` (dev/staging only — must be false in prod);
  `SENTRY_DSN/ORG/PROJECT`; `GMAIL_USER`, `GMAIL_APP_PASSWORD`.
- **Tuning:** `FEATURES` (JSON overrides), `RATE_LIMIT_PER_HOUR`,
  `SCAN_TIMEOUT_MS` (default 120000), `REDIS_URL`,
  `UPSTASH_REDIS_REST_URL/TOKEN` (all optional).

## Common Tasks

- **Add a security module:** create `src/lib/scanner/modules/p1-NN-name.ts`
  exporting `runNameModule(crawl): Promise<RawFinding[]>`; import + add to the
  right group in `src/lib/scanner/index.ts`; add metadata to `SCAN_MODULES` in
  `src/lib/data.ts`. No migration needed.
- **Add a page:** `src/app/[locale]/feature/page.tsx`; use
  `await getTranslations()`; for protected areas use a `PROTECTED_SEGMENTS`
  name (middleware enforces the session) and/or `getCurrentUser()`.
- **Add an API route:** `src/app/api/v1/resource/route.ts` exporting
  `GET/POST/...`; auth via `getCurrentUser()`/`assertAdminApi()`; rate-limit
  public endpoints; return `NextResponse.json`; log via `logger`.
- **Schema change:** edit `prisma/schema.prisma`, then `npm run db:migrate`
  (dev). Remember `db:push` targets the **production** config.
- **Toggle a feature:** set `FEATURES` JSON; gate code with
  `features.flagName` / `isFeatureReady('flagName')`.

## Gotchas

- 120s hard scan timeout; modules parallelize to stay under it; timeout →
  `TIMEOUT` status with partial findings.
- LLM enrichment is optional and fails soft; free tier works without it.
- Headless crawl falls back to static `fetch` when Playwright rendering fails.
- DAST/active-test requires verified domain ownership (`lib/verify-domain.ts`).
- Admin routes return 404 (not 403) to non-admins.
- `npm run db:push` and `npm run start` apply the **production** DB config —
  don't run them expecting to touch the dev SQLite database.
- Several CI scripts are missing from `package.json` (see "CI script gotcha").
- Two lockfiles exist — npm is authoritative; ignore/never use `yarn.lock`.

## References

- `README.md` — product overview, features, deployment.
- `START_HERE.md`, `LEARNING_SUMMARY.md`, `docs/` — Next.js learning material
  and detailed specs (PRD/TDD/DESIGN/PHASES, module docs).
- `prisma/schema.prisma` — full data model.
- `.env.example` — complete environment variable list.
