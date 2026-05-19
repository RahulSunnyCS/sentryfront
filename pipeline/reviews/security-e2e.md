SECURITY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━
Scope: Phase 4 epic-split dedicated security audit (Opus, MAX effort).
Branch: claude/complete-e2e-integration-test-wGDr0 vs main.
Focus: the security-sensitive product-code changes (T-01, T-19, T-20,
E2E auth-seed model, T-06 testid sweep). Pipeline/** working state ignored.

━━━━━━━━━━━━━━━━━━━━━
1. T-01 — PAYMENT_TEST_FLOW production guard (revenue/authz hole closure)
━━━━━━━━━━━━━━━━━━━━━

VERIFIED CLOSED. No findings.

- src/app/api/v1/checkout/route.ts:50-61 — the `NODE_ENV === 'production'`
  check is the FIRST statement inside the `if (PAYMENT_TEST_FLOW === 'true')`
  block (L41). It returns 404 at L54-60 BEFORE `getCurrentUser()` (L63) and
  BEFORE `prisma.user.update` (L72). Verified by code position, not just
  behaviour — there is no path from a production+flag request to the tier
  mutation.
- Existence-hiding confirmed: the error body at L55-58 is byte-identical to
  the ordinary payments-disabled 404 at L92-95
  ("Payments are not enabled. Set STRIPE_ENABLED=true ..."), same HTTP 404.
  An attacker cannot distinguish "bypass present but blocked" from "payments
  simply off". 404 (not 500) is the correct choice — a 500 would advertise a
  server-side misconfiguration worth probing.
- No info leak: response carries no tier / sessionId / url payload.
- Old commented-out guard lines (former 41-47) removed; no dead code left.
- Logging uses src/lib/logger.ts (Sentry-wrapped) at L51-53; the log message
  contains no secrets or user data.
- The vitest tests genuinely prove the contract:
  - payment-test-flow-guard.test.ts:95-119 asserts production+flag → 404 AND
    `getCurrentUser` NOT called AND `prisma.user.update` NOT called AND no
    sessionId/url/tier AND the exact byte-identical error string.
  - :121-143 proves the non-prod dev bypass still works (regression guard).
  - :145-157 proves unauthenticated (non-prod) → 401 unchanged, no DB write.
  - payment-test-flow-outcomes.test.ts:156-269 pins the per-tier mutation
    shapes (one-shot +1, pro +5 one-time/no subscription marker, studio +0),
    sets PAYMENT_TEST_FLOW per-test and restores it in afterEach (no global
    leak; never hits real Stripe; never asserts dollar amounts).
  Both suites mock-then-import and inert-stub @/lib/stripe/client — the
  Pricing constraint memo ("never hit real Stripe") is honoured.

🟢 Low (informational, no action): the production guard depends solely on
`process.env.NODE_ENV === 'production'`. A prod deployment that runs with
NODE_ENV unset/"development" (a deployment-config error) plus
PAYMENT_TEST_FLOW=true would still bypass. This is the pre-existing design
contract documented in business.md ("must be false in production") and
explicitly out of scope for T-01 (which restores the guard that existed).
Recommend the standing pre-GA action (already tracked) to remove the bypass
branch entirely before public launch. Not a regression introduced by this
epic.

━━━━━━━━━━━━━━━━━━━━━
2. T-19 — active-test (DAST) tier gate (authz hole closure)
━━━━━━━━━━━━━━━━━━━━━

VERIFIED CLOSED — both layers enforce. No Critical/Medium findings.

Server (authoritative) — src/app/api/v1/active-test/start/route.ts:28-36:
- Gate is `if (isTierGatingEnabled() && !hasTier(user, 'one-shot'))` → 403
  with `code: 'TIER_REQUIRED'`.
- Positioned AFTER the existing auth gate (L16-19, 401 if no user) and
  BEFORE body parse (L40), domain normalization (L47), the
  domain-verification lookup (L66-74), and `prisma.scan.create` /
  `runActiveTest` (L97-109). A below-tier user cannot trigger any scan or DB
  write — the gate runs before all scan work.
- The existing auth gate and domain-verification gate are unchanged and still
  apply (defense-in-depth: auth → tier → domain-verification, in that order).
- No hard-coded hierarchy: `hasTier` (src/lib/auth/helpers.ts:96-104) owns
  the `['free','one-shot','pro','studio']` ordering; the route only names the
  minimum tier 'one-shot' (the correct minimum per business.md — Verify
  unlocks 1 active DAST scan; free blocked).

UI (defense-in-depth) — src/app/[locale]/active-test/page.tsx:
- Now an async server component. L84-95: when
  `isAuthEnabled() && isTierGatingEnabled()`, it reads the user, and if
  `!hasTier(user, 'one-shot')` renders `ActiveTestUpgradePrompt` INSTEAD of
  `<ActiveTestFlow />` (L184-188). A free user never receives the DAST wizard
  markup. Uses `getUpgradeMessage` from tier-gating.ts (single source of
  truth, no new design invented).

Behaviour-preserving: a one-shot+ user with a verified domain reaches
`ActiveTestFlow` and the route proceeds exactly as before — the gate only
adds a rejection branch for below-tier users.

🟢 Low (informational, no action): the UI gate is wrapped in
`isAuthEnabled() && isTierGatingEnabled()` while the API gate is only
`isTierGatingEnabled()`. If auth is disabled but tier gating enabled, the
page renders the wizard while the API still 401s (no user) before the tier
check — so the authoritative gate is never weaker than the UI gate. This is
the documented "byte-identical when the feature flag is off" pattern used
everywhere else in the app; the authoritative server gate is always present.
No exploitable asymmetry — the UI is advisory, the server is the gate, and
the server is strictly stricter. No action required.

━━━━━━━━━━━━━━━━━━━━━
3. T-20 — auth-button / nav (auth-state leak / session regression check)
━━━━━━━━━━━━━━━━━━━━━

VERIFIED — no auth-state leak, no session/CSRF regression. No findings.

- src/components/auth-button.tsx: the fake `PreferenceRows` reimplementation
  was removed and replaced with the real `<LocaleSwitcher />` / `<ThemeToggle />`
  (L137-148), rendered inside the existing portal user menu. No duplicate
  locale/theme controls remain.
- Sign out unchanged — src/components/auth-button.tsx:152-159 still calls
  next-auth `signOut()` (server-side session destruction; the database
  Session row is invalidated by NextAuth's signout endpoint, not just a
  client state flip). No client-only logout was introduced. No CSRF
  regression: signOut() is the standard NextAuth call and was not modified.
- Dropdown lifecycle preserved: Escape-to-close (L73-78), full-screen
  backdrop click-outside (L87), `stopPropagation` on the panel (L98),
  `createPortal` (L194), and `aria-expanded`/`aria-haspopup` all intact.
- No auth-state leak in the navbar — src/components/nav.tsx:99-121
  `NavPreferences` returns `null` when `authEnabled && status ===
  'authenticated'`, so the signed-in user gets LocaleSwitcher/ThemeToggle
  only inside the user menu, never in the navbar. It mirrors AuthButton's
  exact signal (`useFeature('auth')` + `useSession().status`). The controls
  exposed signed-out (locale + theme) are non-privileged public preferences —
  showing them during the brief `loading` state is not an auth-state leak (no
  session-derived data, no privileged action). Rendered exactly once in the
  DOM (not also in the mobile menu) — no strict-mode locator ambiguity, and
  more importantly no second uncontrolled mount of an auth-aware widget.
- No escape-hatch added to the user menu: the menu still only exposes
  Dashboard link, locale/theme switchers, and Sign out — no new privileged
  action or impersonation surface.

━━━━━━━━━━━━━━━━━━━━━
4. E2E auth-seed model (auth-seed.ts, global-setup.ts, playwright.config.ts)
━━━━━━━━━━━━━━━━━━━━━

VERIFIED test-only and prod-safe. One 🟢 Low.

- Strictly test-only: e2e/support/auth-seed.ts is imported only by the
  Playwright Node process; it instantiates its own PrismaClient pointed at
  `process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db'` (L102-110) — it never
  uses the @/lib/prisma app singleton and is not reachable from the Next.js
  server runtime or any product code path.
- PAYMENT_TEST_FLOW is NOT in playwright.config.ts webServer.env (L105-127) —
  confirmed absent. The constraint memo ("PAYMENT_TEST_FLOW per-spec only,
  never global on the shared server") is honoured; tier-mutation outcomes are
  asserted at the vitest layer instead (see §1).
- ADMIN_EMAILS is the synthetic test value `'e2e-admin@vibesafe.test'`
  (playwright.config.ts:126), in lockstep with `E2E_ADMIN_EMAIL`
  (auth-seed.ts:96). `.test` is a reserved non-routable TLD — not a real
  account, never reaches production auth.
- NEXTAUTH_SECRET is an explicitly-labelled dummy
  ('e2e-dummy-secret-not-for-production', L111) — no real secret committed.
- Cannot touch a prod DB: global-setup.ts forces
  `node scripts/db-config.js development` (sqlite) then HARD-FAILS the run if
  the schema datasource provider is not `sqlite` (L58-71) BEFORE any
  `prisma db push`, and pushes with `DEV_DATABASE_URL=file:./e2e.db`
  explicitly (L84-91). Production uses `DATABASE_URL`/PostgreSQL which the
  seeder never reads. Two independent guards (provider assertion + sqlite
  file URL) make a prod write structurally impossible.
- No secret leakage: the seeder generates a random sessionToken
  (randomUUID + 24 random bytes, L196), writes it to the Session row, sets
  expiry now+30d, and threads the same token into the cookie storageState
  (L289-318). The cookie is `next-auth.session-token` unprefixed (correct for
  the http dev server), httpOnly, secure=false, sameSite=Lax — matches the
  real http dev cookie; no secret is logged or echoed.
- Admin isolation: seedAdminUser hard-codes the email (no override param,
  L260-270) and the JSDoc forbids creating it in global setup; admin user
  lifecycle is owned per-spec. Good — the privileged surface is not widened
  for the whole run.

🟢 Low (informational, no action): the seeder's
`process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db'` fallback means that if a
developer ran a seeding helper locally with DEV_DATABASE_URL pointed at their
working dev SQLite (e.g. vibesafe.db), test User/Session rows would be written
there. This is a dev-SQLite-only inconvenience, never a production exposure
(prod is Postgres via DATABASE_URL, which this code never reads), and in the
actual E2E run global-setup pins the value to e2e.db. No remediation required;
noted for awareness only.

━━━━━━━━━━━━━━━━━━━━━
5. T-06 — testid sweep (security-surface spot-check)
━━━━━━━━━━━━━━━━━━━━━

VERIFIED — all testids are static literals, never data-bound. No findings.

- Spot-checked the security surface: login-card.tsx (login-form,
  login-email-input, login-password-input, login-error, login-submit),
  signup-card.tsx (signup-form, signup-name-input, signup-email-input,
  signup-password-input, signup-error, signup-submit), checkout-button.tsx
  (checkout-button, checkout-modal, checkout-confirm), payment-modal.tsx
  (payment-modal), checkout/success/page.tsx (checkout-success),
  locale-switcher.tsx (locale-switcher), theme-toggle.tsx (theme-toggle),
  active-test-flow.tsx (active-test-domain-input, -step1-continue,
  -check-verification, -start, -results).
- A repo-wide scan of every changed file under src/components/**/*.tsx and
  src/app/[locale]/**/*.tsx for `data-testid={...}` / template-literal
  testids returned ZERO matches — every data-testid is a plain static string
  literal. None is bound to user / session / scanId / email / tier or any
  runtime value.
- e2e/support/selectors.ts holds every value as a named string constant
  (e.g. `export const LOGIN_EMAIL_INPUT = 'login-email-input';`) with no
  `${}` interpolation — no inline literals in specs, single home preserved.
- Diffs on the security-surface files are attribute-only; no conditional
  render logic, props contract, or i18n string was altered.

━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━
Critical: 0
High    : 0
Medium  : 0
Low     : 3   (all informational — pre-existing/by-design, no action required
               for this epic: T-01 NODE_ENV dependence is the documented
               pre-GA cleanup item; T-19 flag-asymmetry is non-exploitable
               because the server gate is strictly stricter; auth-seed
               DEV_DATABASE_URL fallback is dev-SQLite-only, never prod)

Overall verdict: PASS

The two revenue/authz holes this epic set out to close are verifiably
closed with no new holes introduced:
- T-01: the PAYMENT_TEST_FLOW production bypass is short-circuited with a
  404 before any auth lookup or DB write, leak-free, and proven by tests.
- T-19: the active-test DAST surface now enforces the tier gate at the
  authoritative server layer (before all scan work) and the UI layer, using
  hasTier with no hard-coded hierarchy, with the existing auth and
  domain-verification gates intact.
T-20 introduces no auth-state leak or session/CSRF regression. The E2E
auth-seed infrastructure is strictly test-only, prod-DB-safe by two
independent guards, carries no real secrets, and PAYMENT_TEST_FLOW is
correctly absent from webServer.env. T-06 testids are static literals only.

OPUS DEEP-DIVE: NOT REQUIRED — this IS the forced Opus/max security pass for
the epic split; no residual Critical/High warranting a further scoped dive.
