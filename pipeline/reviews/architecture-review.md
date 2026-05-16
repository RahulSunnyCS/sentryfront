ARCHITECTURE REVIEW REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: claude/automation-landing-page-infra-8Hfhf
Scope: Playwright E2E bootstrap + CI wiring (MEDIUM, feature-fast)
Lens: frontend + infra
Verdict: CONDITIONAL PASS

Files reviewed (non-pipeline):
- playwright.config.ts
- e2e/landing.spec.ts
- e2e/landing.a11y.spec.ts
- e2e/support/selectors.ts
- .github/workflows/test.yml
- vitest.config.ts
- src/app/[locale]/landing-hero.tsx
- src/app/[locale]/page.tsx
- src/components/nav.tsx
- src/components/footer.tsx
- src/app/[locale]/SkipToContent.tsx
- package.json
- .gitignore

━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDINGS

━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING: Sentry console-error false-positive gate
Severity: High
File or area: e2e/landing.spec.ts:59 / sentry.client.config.ts
What it is: The @critical landing-renders test asserts zero console errors on /en. The Sentry client config only initialises when NEXT_PUBLIC_SENTRY_DSN is set — that env var is absent from both webServer.env and the CI job env. However, other @sentry/nextjs instrumentation hooks (the Next.js webpack plugin injects them at build time via the sentry.client.config.ts import path) can emit console errors even without a DSN if the runtime detects a misconfigured or partially-initialised SDK. The test runner uses `npm run dev`, not a production build, so Next.js does not execute the full Sentry build-time instrumentation — in practice the risk is low in dev mode. The exposure is that any future change enabling SENTRY_DSN without a valid value, or any third-party component that calls console.error on mount (e.g. a hydration mismatch in dev), will flip this critical test to red with a confusing failure message that gives no hint of the real cause (the error text is captured raw, not filtered by category).
Why it matters: A @critical test that is a false-positive alarm breaks CI red for reasons unrelated to the landing page's correctness, and engineers learn to distrust the gate. Conversely, if the filter is too broad (anything that reaches console.error blocks), legitimate regressions could be buried in noise.
Recommendation: Add a known-safe passlist for console error patterns that are not regressions: e.g. `consoleErrors.filter(msg => !msg.includes('Sentry') && !msg.includes('ResizeObserver'))`. Alternatively, escalate only pageerror (uncaught JS exceptions) to @critical and move the console.error assertion to @functional where a false positive has less blast radius. Either change requires a single-line edit in landing.spec.ts.

---

FINDING: getByRole('navigation') without accessible-name filter — risk analysis
Severity: Low
File or area: e2e/landing.spec.ts:53
What it is: The spec calls `page.getByRole('navigation')` without a `{ name: '...' }` filter. Playwright strict mode raises a "strict mode violation" error when a role locator matches more than one element. The landing page at /en renders exactly ONE nav landmark: the `<nav aria-label={t('primary')}>` in src/components/nav.tsx:135. The mobile menu inside that nav has `role="dialog"` (not navigation). No other file in the landing page component tree (page.tsx, landing-hero.tsx, SkipToContent.tsx, footer.tsx) emits a second nav element. The footer uses `<footer role="contentinfo">`. There is NO current strict-mode-violation risk.
Why it matters: The risk is forward-looking: if a future sprint adds a breadcrumb nav, a sidebar nav, or a skip-nav landmark to the landing page, the unqualified locator will start throwing a strict-mode error with a confusing message rather than a clean test failure.
Recommendation: Add the accessible-name filter now while the fix costs one word: `page.getByRole('navigation', { name: /primary/i })`. The nav's aria-label is the translated string for key `nav.primary`; in en locale this is "Primary navigation" or similar — verify the exact en translation and use a regex to stay locale-tolerant. This is a one-line defensive change that eliminates the future breakage class.

---

FINDING: byTestId helper bypasses Playwright testIdAttribute config point
Severity: Low
File or area: e2e/support/selectors.ts:41-53 / playwright.config.ts
What it is: The `byTestId` helper builds the locator as `page.locator('[data-testid="..."]')` rather than using `page.getByTestId()`. Playwright's `getByTestId()` reads the `testIdAttribute` setting from `playwright.config.ts` (defaults to `data-testid`). Both approaches produce the same selector today, but the config entry point is bypassed. If the project ever migrates the attribute name (e.g. to `data-pw-testid` for clarity), the selectors.ts `sel()` function must be updated AND a testIdAttribute config entry added — two places to change instead of one.
Why it matters: Low impact now; a minor maintainability trap if the attribute name ever changes. The `sel()` function at least centralises the string, which is the right instinct, but the abstraction is one layer away from the canonical Playwright API.
Recommendation: Replace `page.locator('[data-testid="${testId}"]')` with `page.getByTestId(testId)` in the `byTestId` function. If custom-attribute migration is a concern, set `use: { testIdAttribute: 'data-testid' }` in playwright.config.ts to make it explicit and single-source. The `sel()` helper can remain for the `page.locator(sel(...))` fallback pattern. Change is 2 lines in selectors.ts.

---

FINDING: Playwright cache key busts on any package-lock change
Severity: Low
File or area: .github/workflows/test.yml:96
What it is: The Playwright browser cache key is `${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}`. Any change to package-lock.json — even adding an unrelated dev dependency — busts the browser cache and triggers a full re-download of the Chromium browser bundle (~300 MB). The restore-keys fallback `${{ runner.os }}-playwright-` mitigates this partially (it restores the last valid cache) but Playwright's install step still runs and may re-download if the restored cache is incompatible with the new @playwright/test version.
Why it matters: Unnecessary cache misses increase CI run time by 2-4 minutes on each miss. In a busy branch workflow this accumulates.
Recommendation: Scope the cache key to the Playwright version specifically: `${{ runner.os }}-playwright-1.59.1-${{ hashFiles('package-lock.json') }}` or use `${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}-${{ steps.setup-node.outputs.node-version }}`. Alternatively, extract the Playwright version dynamically: `npx -y playwright --version`. This is a CI tuning change, not a correctness issue.

---

FINDING: reuseExistingServer:false blocks parallel local development
Severity: Low
File or area: playwright.config.ts:78
What it is: `reuseExistingServer: false` means Playwright will refuse to start if port 3000 is already occupied and will not reuse a running dev server. The plan documents this as a deliberate choice (ensures e2e.db and the high rate-limit cap take effect). The tradeoff is that a developer running `npm run dev` simultaneously with `npm run test:e2e` will get a port-conflict failure with a confusing error.
Why it matters: Developer experience. The error message ("Error: Process from config.webServer was not able to start") does not hint that a running dev server is the cause. A developer unfamiliar with the design decision will spend time investigating.
Recommendation: Add a comment in playwright.config.ts (already partially present on line 9-10) that explicitly warns: "If port 3000 is in use, stop the dev server before running test:e2e — reuseExistingServer is intentionally false." Also consider adding this to the README's E2E section. No code change required.

---

FINDING: Non-hermetic scan tests submit to a real external host in CI
Severity: Info
File or area: e2e/landing.spec.ts:74, :95 (Tests 2 and 3)
What it is: The @critical and @functional scan tests submit 'https://example.com' and 'example.com' to the real /api/v1/scans endpoint. The scan-worker then kicks a real background scan (Playwright headless crawl + Lighthouse to example.com). The tests themselves do not await scan completion — they assert only the 201 response and the URL navigation — so test duration is bounded. However, the background scan process runs inside the dev server for up to 120s after the test completes. In CI this produces network egress to example.com on every push.
Why it matters: This is accepted scope (Gate-1 decision D1). Surfaced here as Info because: (a) example.com is controlled by IANA and is reliable, (b) the background scan does not affect test assertions, (c) the high RATE_LIMIT_PER_HOUR prevents 429, and (d) the plan explicitly acknowledges R-A. The only residual concern is if CI runners have restricted egress in the future — the tests would then start failing at the dns.resolve4 step inside url-validator.ts rather than at a Playwright assertion, producing a confusing error.
Recommendation: No change required now (accepted risk). Future mitigation if egress becomes restricted: add a SKIP_DNS_VALIDATION env var to url-validator.ts that bypasses the dns.resolve4 call. This is a 3-line change that does not affect production behaviour.

---

FINDING: `playwright` in production dependencies (pre-existing, not introduced here)
Severity: Info
File or area: package.json:43
What it is: `playwright@^1.59.1` exists in `dependencies` (production) — it was there before this branch because the scanner uses Playwright for headless crawling. This branch adds `@playwright/test@1.59.1` correctly to `devDependencies`. The two packages are distinct: `playwright` is the browser automation library; `@playwright/test` is the test runner. No duplication — both are needed. This is not a finding introduced by this branch.
Why it matters: Surfaced for completeness: production Docker images will include the Playwright browser binaries (installed via the scanner's dependency). This is intentional — the scanner needs them at runtime. No action required.
Recommendation: None. Document this explicitly in the Dockerfile if not already done, to explain why a headless browser dependency is in a web application image.

---

POSITIVE OBSERVATIONS (no severity — for record)

1. The selector module (e2e/support/selectors.ts) is well-structured. A single rename requires one edit. The data-testid constants are typed, exported, and documented.

2. The `page.waitForRequest` registration before `click` (landing.spec.ts:70-75) is correct — it prevents the race condition where a fast server could return the response before the listener registers.

3. The `reuseExistingServer: false` + `RATE_LIMIT_PER_HOUR=100000` + fresh `e2e.db` combination correctly addresses the three independent correctness requirements for non-hermetic tests. The reasoning in the config comments is sound and matches the plan.

4. The vitest exclude patterns (e2e/** and **/e2e/**) correctly prevent Playwright spec files from being collected by vitest's include glob. Both patterns are needed: `e2e/**` catches the top-level directory, `**/e2e/**` catches any nested e2e directory that might appear later.

5. The axe test correctly scopes to `serious` and `critical` impact only (landing.a11y.spec.ts:40-43) and builds a human-readable violation summary in the failure message. This is the right threshold for a @functional (not @critical) gate: real user-facing accessibility failures are caught without legacy cosmetic noise causing false positives.

6. The CI e2e job uploads `playwright-report/` with `if: always()` — reports are available for both passing and failing runs.

7. The `formatCount` function and all landing-hero.tsx changes are purely additive (four `data-testid` attributes) with zero behaviour change. Correct scope discipline.

━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY
High  : 1 (Sentry console-error false-positive gate)
Medium: 0
Low   : 3 (navigation locator lacks accessible-name; byTestId bypasses testIdAttribute; cache key scope)
Info  : 2 (non-hermetic egress accepted risk; playwright prod dep pre-existing)

VERDICT: CONDITIONAL PASS
Condition: Address the High finding (Sentry/console-error gate robustness) before relying on
the @critical "landing page renders" test as a real regression gate in CI. The three Low
findings are recommended improvements but do not block the pipeline.
