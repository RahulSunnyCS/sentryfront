# Automation Gate

**Result: CI-ONLY** (non-blocking — per Gate-1 decision D2 and CLAUDE.md Phase 6 Automation Gate rule)

## What was verified locally
- `playwright.config.ts` + both spec files are valid: `npx playwright test --list` succeeded, discovering all 7 tests with correct tags:
  - 🔴 `@critical landing page renders` (landing.spec.ts:40)
  - 🔴 `@critical critical path starts a real scan` (landing.spec.ts:92)
  - 🟡 `@functional empty input defaults to example.com` (landing.spec.ts:119)
  - 🟡 `@functional final CTA pricing link navigates to pricing` (landing.spec.ts:142)
  - 🟡 `@functional root redirects to localized landing` (landing.spec.ts:156)
  - 🟡 `@functional landing page has no serious or critical accessibility violations` (landing.a11y.spec.ts:22)
  - 🟢 `@non-blocker weekly counter and FAQ open state` (landing.spec.ts:165)
- Unit suite green: `npm run test` → 1354 passed / 10 skipped, 84 files; Vitest correctly excludes `e2e/**` (no Playwright spec collected).
- `npm run typecheck` → 0 errors. `npm run lint` → 0 errors.

## Why CI-ONLY (exact reason logged)
`npx playwright test --grep @critical` →
`Error: browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell`

The Chromium binary is not installed in this sandbox (we deliberately do not run `npx playwright install` here), and the non-hermetic tests additionally require outbound DNS/egress to example.com which this sandbox lacks. This is the accepted D2 path: enforced in CI (the `e2e` job runs `npx playwright install --with-deps chromium`, has egress, and has NO `continue-on-error`, so a failing `@critical` test turns the workflow red), advisory locally.

## Gate impact
None. Marked CI-ONLY, pipeline proceeds without blocking. The Automation Gate runs exactly once per pipeline execution — no retry loop. Critical-path enforcement is delegated to CI by design and user acknowledgement.
