# ARCHITECTURE REVIEW REPORT — E2E Suite
# Phase 4 Dedicated Specialist (epic-split)
# Lenses: frontend + backend + infra

VERDICT: CONDITIONAL PASS
High   : 0
Medium : 2
Low    : 3

---

## FINDING 1: payment-modal component de facto orphan (coverage matrix inaccuracy)

Severity: Medium
File or area: e2e/support/coverage-matrix.ts (line ~622–628) + e2e/checkout.spec.ts

What it is:
The coverage matrix entry for `component/payment-modal` (path:
`src/components/payment-modal.tsx`) claims `type: 'DIRECT'` from
`checkout.spec.ts`. That claim is false. `checkout.spec.ts` exercises only
`CHECKOUT_MODAL` (the checkout-button confirmation dialog, data-testid
`checkout-modal`) and never navigates to, opens, or asserts the `payment-modal`
upsell dialog (data-testid `payment-modal`). The constant `PAYMENT_MODAL` is
declared in `selectors.ts` but is unused in every spec file across the suite.
The `payment-modal` component is therefore a hard orphan in practice — the
coverage-matrix.spec.ts anti-orphan gate would have caught this if the matrix
entry were correct.

Why it matters:
`payment-modal.tsx` is a revenue-path component: it displays tier plans with
pricing copy and triggers the checkout flow. It contains hardcoded dollar
amounts (`$9`, `$29`, `$15/mo`) that conflict with the May-2026 pricing pivot
rule ("never assert dollar amounts") and which will rot silently with no test
coverage to surface them. An inaccurate DIRECT entry in the matrix defeats the
purpose of the anti-orphan gate — the gate passes green while the component
goes untested.

Recommendation:
1. Correct the coverage-matrix entry: change `type: 'DIRECT'` to `type:
   'PARTIAL'` with an explicit note documenting that the upsell modal is not
   exercised (the checkout flow goes through `checkout-modal`, not
   `payment-modal`). This makes the gap honest and visible.
2. In a follow-up task: add a `@functional` smoke assertion that navigates to
   `/en/pricing`, clicks through the payment-modal trigger path, and confirms
   the modal opens with tier names present — without asserting any dollar
   amounts (use negative guard as `checkout.spec.ts` already does for the
   pricing page CTAs). Tag this in the coverage matrix as DIRECT once done.

---

## FINDING 2: inline cookie construction duplicated in 4+ spec files instead of using authStorageState()

Severity: Medium
File or area:
  e2e/checkout.spec.ts (lines ~179–196)
  e2e/active-test.spec.ts (lines 121–136, local `sessionStorageState` function)
  e2e/active-test.a11y.spec.ts (line 130, local `sessionStorageState` function)
  e2e/auth.a11y.spec.ts (lines 174–188)

What it is:
`e2e/support/auth-seed.ts` exports `authStorageState(sessionToken)` — the
canonical, tested, documented function that produces the Playwright
`StorageState` cookie object for `next-auth.session-token`. Four spec files
bypass it and re-implement the cookie construction inline, citing a real
constraint: `test.use({ storageState })` is evaluated at collection time,
before `beforeAll` runs, so the token is not yet known there. The rationale is
correct, but the fix is `browser.newContext({ storageState:
authStorageState(token) })`, not re-implementing the cookie literal. The
`authStorageState` return value is directly accepted by `browser.newContext()`.
`active-test.spec.ts` and `active-test.a11y.spec.ts` each define a local
`sessionStorageState(token)` function that is byte-for-byte identical to
`authStorageState()`.

Why it matters:
If the session cookie contract ever changes (e.g., the cookie becomes SameSite
strict, the domain moves, or the http→https migration changes the name to
`__Secure-next-auth.session-token`), the change must be made in `auth-seed.ts`
AND in each of these four inline duplicates. The documented guarantee of the
auth-seed contract — "one file owns the cookie shape" — is already broken in
practice. A divergence in one of these copies is a silent security regression
in the auth tests.

Recommendation:
In each affected spec, replace the inline cookie object literal with a call to
`authStorageState(token)` imported from `./support/auth-seed`. The
`browser.newContext({ storageState: authStorageState(seeded.sessionToken) })`
pattern is idiomatic Playwright and eliminates the duplication without changing
any test semantics. Remove the two local `sessionStorageState` functions in
`active-test.spec.ts` and `active-test.a11y.spec.ts` entirely.

---

## FINDING 3: six performance-section testid constants not declared in selectors.ts

Severity: Low
File or area: e2e/performance-report.spec.ts (lines 190, 215, 217, 341, 344, 426, 723, 806, 825, 827, 1139, 1175, 1336, 1360, 1364, 1370, 1377)

What it is:
`performance-report.spec.ts` directly calls `page.getByTestId('real-user-verdict')`,
`page.getByTestId('real-users-slow-banner')`, `page.getByTestId('desktop-section')`,
`page.getByTestId('best-practices-grade')`, `page.getByTestId('desktop-score')`, and
`page.getByTestId('desktop-subordinate-note')` — six distinct testid string literals
that are never declared as constants in `e2e/support/selectors.ts`. These testids are
defined in `src/components/performance-section.tsx` (lines 179, 256, 283, 326, 343, 358)
and all relate to the same performance section component. They appear 17 times
across the spec file. The AR-L2 constraint (binding per context-pack) requires ALL new
testid values to be declared as constants in `selectors.ts` with no inline literals.

Why it matters:
If any of these testids are renamed in `performance-section.tsx`, the spec file
will fail silently (the testid no longer matches) and there is no single-home
to update. The searchability problem is compounded: a developer renaming
`real-user-verdict` in product code must grep across spec files rather than
updating one constant in selectors.ts. At 17 occurrences, the maintenance
surface is non-trivial. The `vitest.config.ts`/`performance-section.test.tsx`
unit tests also use these raw strings (expected, since that is Vitest not
Playwright), but the E2E layer should flow through selectors.ts per the
declared constraint.

Recommendation:
Add the six constants to `e2e/support/selectors.ts` in a new section for
performance-section, following the existing documentation style:

    export const REAL_USER_VERDICT = 'real-user-verdict';
    export const REAL_USERS_SLOW_BANNER = 'real-users-slow-banner';
    export const DESKTOP_SECTION = 'desktop-section';
    export const BEST_PRACTICES_GRADE = 'best-practices-grade';
    export const DESKTOP_SCORE = 'desktop-score';
    export const DESKTOP_SUBORDINATE_NOTE = 'desktop-subordinate-note';

Then replace all 17 inline usages in `performance-report.spec.ts` with
`byTestId(page, REAL_USER_VERDICT)` etc. This is a mechanical single-file
change.

---

## FINDING 4: two spec files use inline hero-scan-submit string literal when the constant is available

Severity: Low
File or area:
  e2e/landing.a11y.spec.ts (line 32)
  e2e/internal.spec.ts (line 178)

What it is:
Both files use `page.locator('[data-testid="hero-scan-submit"]')` or
`.count()` on the raw string literal. The constant `HERO_SCAN_SUBMIT` is
already exported from `selectors.ts` (line 19) and the `sel()` helper
(selectors.ts line 194) produces the CSS selector form. The correct usage is
`page.getByTestId(HERO_SCAN_SUBMIT)` (via `byTestId`) or
`page.locator(sel(HERO_SCAN_SUBMIT))` for the CSS-selector use in
`landing.a11y.spec.ts` and `internal.spec.ts`.

Why it matters:
Minor single-constant violation of AR-L2. The heroic invariant in the
constraint memo is that selectors.ts is the single rename point for testids.
These two usages already have the constant available — it is simply not
imported. The risk is low because `hero-scan-submit` is an existing, stable
testid, but consistency matters for the principle.

Recommendation:
In both files: import `HERO_SCAN_SUBMIT` (and `sel` or `byTestId` as needed)
from `./support/selectors` and replace the raw string. Two-line change per
file.

---

## FINDING 5: BENIGN_CONSOLE filter defined inline in 6 spec files instead of a shared support utility

Severity: Low
File or area:
  e2e/landing.spec.ts, e2e/probe.spec.ts, e2e/static-pages.spec.ts,
  e2e/auth.spec.ts, e2e/components.spec.ts, e2e/dashboard.spec.ts

What it is:
Six spec files each define their own `BENIGN_CONSOLE` constant (a string array)
and `isBenignConsoleMessage(text)` function with byte-identical content. The
patterns filtered are `[Fast Refresh]`, `ResizeObserver loop`,
`Download the React DevTools`, and `Warning:`. The duplicate definition is a
maintenance hazard: if Next.js or React adds a new benign noise string (e.g., a
new dev-mode warning prefix), every spec file must be updated independently
instead of a single shared location. Divergence between the six copies is
already foreshadowed by the slight difference in comment style between
`landing.spec.ts` (has an inline comment on `Warning:`) and `auth.spec.ts`
(does not), though the runtime behavior is currently identical.

Why it matters:
This is lower severity than the testid issues because the content is currently
identical. However, the pattern violates the shared-module single-source
principle established by the rest of the suite. A false positive added to one
copy but not another silently masks real console errors in the unfixed specs.
Given that the plan already created `e2e/support/auth-seed.ts`,
`e2e/support/db-seed.ts`, and `e2e/support/selectors.ts` as shared Wave-1
modules, a `e2e/support/console-filter.ts` export is the natural completion.

Recommendation:
Create `e2e/support/console-filter.ts` that exports `BENIGN_CONSOLE` and
`isBenignConsoleMessage`. Replace the six per-file definitions with an import.
This is a pure refactor with no behavioral change.

---

## BINDING CONSTRAINT COMPLIANCE SUMMARY

AR-L2 selectors.ts single-home:
  STATUS: PARTIAL COMPLIANCE.
  - All auth/checkout/dashboard/active-test/report/scan/components testids:
    correctly declared and used via byTestId().
  - T-10 justified inline literal (`active-test-upgrade-prompt`): correctly
    documented with a cleanup note; the testid is in product code from T-19,
    not newly introduced by T-10. ACCEPTED.
  - landing.a11y.spec.ts (line 32) and internal.spec.ts (line 178): use raw
    `hero-scan-submit` string when `HERO_SCAN_SUBMIT` is already in selectors.ts
    and could be imported. (Finding 4, Low.)
  - performance-report.spec.ts: six undeclared testid constants. (Finding 3, Low.)

E2E structure / coupling:
  STATUS: COMPLIANT.
  Per-spec seed/cleanup: verified across all 14 specs that require state.
  globalSetup owns schema+seed (no seed in server-parallel hooks): verified.
  Admin spec isolated (own file, distinct storageState, no global admin seed):
    verified in internal.spec.ts.
  Auth-seed DB-session model (NOT JWT): verified in auth-seed.ts.
  Hermetic vs non-hermetic domain split: verified.
  No extra browser projects: verified (chromium only).
  Coverage matrix is a documented mapping: verified (coverage-matrix.ts +
    coverage-matrix.spec.ts).

Shared modules (auth-seed.ts / db-seed.ts / selectors.ts):
  STATUS: MOSTLY COMPLIANT. No duplication of the auth-seed or db-seed logic.
  ISSUE: authStorageState() is duplicated as local sessionStorageState()
  in active-test.spec.ts and active-test.a11y.spec.ts, and as inline cookie
  literals in checkout.spec.ts and auth.a11y.spec.ts. (Finding 2, Medium.)

T-19 tier-gate placement:
  STATUS: COMPLIANT.
  UI layer: src/app/[locale]/active-test/page.tsx — uses hasTier() +
  isTierGatingEnabled() + getCurrentUser(). Gate at the server component level.
  API layer: src/app/api/v1/active-test/start/route.ts line 28 — tier gate
  precedes any domain/verification/scan work, returns 403 with code:
  'TIER_REQUIRED'. Uses existing hasTier() helper, not a parallel hierarchy.
  Production PAYMENT_TEST_FLOW guard: src/app/api/v1/checkout/route.ts lines
  50-61 — guard fires before getCurrentUser() and prisma.user.update, returns
  404 matching the payments-disabled branch. COMPLIANT.

T-20 LocaleSwitcher/ThemeToggle:
  STATUS: COMPLIANT.
  auth-button.tsx: PreferenceRows removed; real <LocaleSwitcher /> and
  <ThemeToggle /> mounted in user menu (confirmed by grep output lines 137-147).
  nav.tsx: NavPreferences() function (lines 106-122) renders switchers only
  when NOT signed in, using the same useFeature('auth') + useSession signal as
  AuthButton — no new auth signal invented. Contract matches the T-20 acceptance
  criterion.

Long-term maintainability decisions:
  STATUS: SOUND.
  Layer-split (bypass tier-outcomes to vitest not E2E): checkout.spec.ts
  documents the rationale fully (lines 7-44); the shared-server constraint
  that makes per-test PAYMENT_TEST_FLOW injection impossible on a long-lived
  dev server is correctly identified. This is an honest limitation, not hidden
  debt.
  Coverage matrix hard/soft orphan handling: the two-level orphan policy
  (hard-fail vs CONDITIONAL-only soft-warn) is correctly implemented and gated
  with a @non-blocker test.
  Mock-mode-banner CONDITIONAL gap: correctly documented in both the matrix
  and the spec.
  Bounded partial coverage (OAuth popups, etc.): documented explicitly in
  auth.spec.ts with clear rationale. Not hidden debt.
  EXCEPTION: payment-modal coverage entry is inaccurate (claims DIRECT coverage
  that does not exist). This is a genuinely hidden gap, not a documented
  limitation. (Finding 1, Medium.)

---

SUMMARY
High  : 0
Medium: 2
  - F1 payment-modal: false DIRECT coverage claim masks a hard orphan revenue component
  - F2 authStorageState duplication: cookie contract has 4 out-of-sync copies
Low   : 3
  - F3 performance-section: 6 undeclared testid constants, 17 inline usages
  - F4 hero-scan-submit: 2 spec files bypass available selectors.ts constant
  - F5 BENIGN_CONSOLE: 6 duplicate per-spec definitions of identical filter

VERDICT: CONDITIONAL PASS
Conditions (must resolve before merge):
  1. Correct the coverage-matrix entry for component/payment-modal from DIRECT
     to PARTIAL and add a documented note. (F1 — prevents a silent hard orphan
     on a revenue-path component.)
  2. Replace inline cookie construction in checkout.spec.ts, active-test.spec.ts,
     active-test.a11y.spec.ts, and auth.a11y.spec.ts with authStorageState()
     from support/auth-seed.ts. (F2 — single-home cookie contract.)
Findings 3–5 are LOW severity and may be addressed in a follow-up cleanup task.
