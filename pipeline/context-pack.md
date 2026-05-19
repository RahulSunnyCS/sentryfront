# Shared Context Pack — consumed by every Phase 3/4/5/6 agent (read-only)

Built once after Gate 1. Orchestrator is the sole writer. Refreshed at phase
boundaries. Deleted with pipeline/ at Gate-3.

## Task
Comprehensive Playwright E2E coverage for every page + component of VibeSafe,
risk-tiered (🔴 behavioral / 🟡 interaction / 🟢 smoke). Plan: pipeline/plan.md.
QA contract: pipeline/qa-checklist.md (🔴29 / 🟡34 / 🟢27). Decisions LOCKED:
D1 hybrid data-testid · D3 en + 1 locale smoke · D6 risk-tiered · D7 404.
R3 accepted (axe @functional on 🔴 pages). R1/R2 declined.

## Base branch / state
- Branch: claude/complete-e2e-integration-test-wGDr0 (off main).
- Existing E2E (KEEP, coexist by domain — do NOT modify or break):
  e2e/landing.spec.ts, landing.a11y.spec.ts, performance-report.spec.ts,
  compliance-report.spec.ts, report-calibration.spec.ts,
  security-modules.spec.ts; e2e/support/perf-db-seed.ts, selectors.ts;
  playwright.config.ts (command `npm run dev`, "non-hermetic" by design).
- Playwright browsers NOT installed in-sandbox → spec AUTHORING needs no
  browser; EXECUTION is a CI-only checkpoint (Phase 6 Automation Gate).

## Key product facts (grounded)
- NextAuth 4, session strategy = 'database', PrismaAdapter. Session cookie
  `next-auth.session-token` (http NEXTAUTH_URL → no __Secure prefix). Reference:
  src/lib/auth/session.ts `establishSession` (sessionToken =
  crypto.randomUUID()+randomBytes(16).hex; expires now+30d).
- Protected segments (middleware): dashboard, verify, active-test → redirect to
  /{locale}/login. Internal admin gated at layout via requireAdminOrNotFound()
  (404 to non-admin); middleware EXCLUDES /internal.
- Admins from ADMIN_EMAILS (comma-sep); non-admin → 404 (existence-hiding).
- src/app/api/v1/checkout/route.ts: PAYMENT_TEST_FLOW=true bypass; prod guard
  at lines 41-47 is COMMENTED OUT (live defect — Wave-0 fix). Bypass calls
  getCurrentUser() (~L49) then prisma.user.update (~L58); unauth → 401;
  payments-disabled → 404 (L81). Tiers free<one-shot<pro<studio;
  one-shot +1 credit, pro +5 one-time (NOT subscription), studio subscription
  +0 credits. Never hit real Stripe; never assert dollar amounts (May-2026
  pivot). nextauth session callback re-reads tier from DB every request.
- scripts/db-config.js rewrites prisma/schema.prisma datasource in place;
  `npm run dev` always passes `development` (sqlite). schema.prisma:11-14 is
  byte-identical to db-config.js development output (verified).
- next.config.mjs: output:'standalone'. Vitest mocks Prisma/Next/Sentry/
  NextAuth/fetch (vitest.setup.ts). Path alias @/* → src/*.

## Surface inventory (every item must map to ≥1 spec — coverage matrix)
Pages (~28): [locale]/(landing) page.tsx, scan/[id], dashboard, report/[id],
report/[id]/print, active-test, pricing, checkout/success, demo/{accessibility,
performance,seo}, docs, legal/{contact,privacy,terms}, login, signup, verify,
verify-email-sent; error.tsx, not-found.tsx; internal/{users,cron,features,
fp-rates,dispositions,scans/[id]}; auth/popup-start, auth/popup-callback.
Components (31): accessibility-grade, accessibility-section,
ai-improvement-suggestions, auth-button, chat-widget, checkout-button,
copy-button, core-web-vitals, finding-card, footer, grade-display, icons,
locale-switcher, logo, mock-mode-banner, nav, payment-modal, pdf-export-button,
performance-grade, performance-section, pricing-card, providers,
scan-report/missed-issue-button, seo-grade, seo-section, severity-badge,
severity-summary, theme-toggle, toast, verify-email-nudge, wcag-compliance.

## Constraint memos (Phase-1, binding)
- Pricing: PAYMENT_TEST_FLOW per-spec only (never global); assert tier-gating
  both directions; one payments-disabled test WITHOUT the flag → 404; never
  Stripe, never dollar amounts; studio = +0 credits.
- Architecture: DB-session seeder (NOT JWT); all new testids declared as
  constants in e2e/support/selectors.ts (no inline literals); testid sweep ONE
  task; admin specs own file + distinct storageState + admin user isolated to
  that file's beforeAll/afterAll; per-spec seed/cleanup, truncate-based
  isolation via globalSetup; no extra browser projects; coverage matrix is a
  documented mapping, not 31 mount harnesses.

## Task map (filled at decomposition)
See pipeline/tasks/T-XX.json and TODO.md.
