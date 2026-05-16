# SECURITY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━

Scope: Phase 3 implementation, branch `claude/automation-landing-page-infra-8Hfhf`
Task: Playwright E2E bootstrap + CI wiring (MEDIUM risk, feature-fast lane, no auth/pii/payment risk_flags)
Reviewed: `.github/workflows/test.yml`, `playwright.config.ts`, `package.json`, `package-lock.json`, `vitest.config.ts`, `src/app/[locale]/landing-hero.tsx`, `e2e/**`, `README.md`, `.gitignore`
Non-product pipeline artifacts (pipeline/**, TODO.md, docs) excluded from security scope as instructed.

---

## FINDINGS

### FINDING: GitHub Actions workflow has no `permissions` block
Severity: **Low**
File and line: `.github/workflows/test.yml` (whole file — no top-level or `e2e`-job `permissions:` key; new job at lines 67-111)
What it is: The new `e2e` job, like the pre-existing `test`/`build` jobs, runs with the repository default `GITHUB_TOKEN` permission set. If the repo default is "read/write", every job (including this one, which does not need write) gets a write-scoped token.
Why it matters: A write-scoped token in a CI job widens the blast radius if any executed step is compromised (e.g. a malicious transitive dependency running during `npm ci` or `npx playwright install`). The `e2e` job only needs `contents: read`.
How to fix it: Add a least-privilege block. Cleanest is a top-level `permissions:` (applies to all jobs and also hardens the existing ones):
```yaml
permissions:
  contents: read
```
This is a defence-in-depth hardening, not a regression introduced by this change — the existing jobs already had the same gap. Recommended but non-blocking for this task.

### FINDING: Third-party actions pinned by mutable major-version tag
Severity: **Info**
File and line: `.github/workflows/test.yml:75` (`actions/checkout@v4`), `:78` (`actions/setup-node@v4`), `:88` (`actions/cache@v4`), `:108` (`actions/upload-artifact@v4`)
What it is: The new `e2e` job uses `@v4` floating tags rather than full commit SHAs.
Why it matters: Mutable tags can in principle be repointed; SHA-pinning is the hardened practice. However, this exactly matches the repo's existing convention — the pre-existing `test`/`build` jobs in the same file use the identical `@v4` tags on the same first-party `actions/*` org. The new steps introduce no riskier or non-first-party actions. Consistency with the established repo convention is acceptable here; per the audit brief I am flagging, not demanding a change.
How to fix it (optional, repo-wide): If the team later decides to harden, pin all `actions/*` uses (existing and new) to commit SHAs with a Dependabot policy to bump them. Do not change only the new steps — that would create inconsistency without materially improving security.

### FINDING: Static, clearly-labelled dummy `NEXTAUTH_SECRET` in workflow and Playwright config
Severity: **Info** (acceptable as designed)
File and line: `.github/workflows/test.yml:13` and `playwright.config.ts:89` — `NEXTAUTH_SECRET: 'e2e-dummy-secret-not-for-production'`
What it is: A hardcoded literal NextAuth signing secret used only by the ephemeral E2E environment (fresh `file:./e2e.db` SQLite, `localhost:3000`, CI runner / local Playwright-owned dev server).
Why it matters / assessment: This is **not a real exposure**. The value is (a) self-describing as non-production, (b) only ever applied to a throwaway SQLite DB created per run and git-ignored (`e2e.db*` in `.gitignore`), (c) never reaches any production or staging system, and (d) signs JWTs only for an isolated test session with no real user accounts. No genuine credential, OAuth client secret, Stripe key, API key, or private key appears anywhere in the diff (full-diff secret scan run — clean; the only matches are this labelled dummy and unrelated comment text). NextAuth requires *some* secret to boot; a fixed, clearly-marked test constant is the correct pattern for hermetic CI and is preferable to a random per-run value here because tests need a stable, reproducible environment.
How to fix it: No action required. Optional hardening: prefix the constant with `ci-only-` and/or add an inline comment in `test.yml` mirroring the one already in `playwright.config.ts:87-88` so future readers cannot mistake intent. The risk that someone copy-pastes this into a real env is low given the explicit `-not-for-production` suffix.

### FINDING: `RATE_LIMIT_PER_HOUR: '100000'` raised in CI/test env only
Severity: **Info** (correctly scoped — no production impact)
File and line: `.github/workflows/test.yml:14` and `playwright.config.ts:99`
What it is: The per-IP/hour scan ceiling is raised from the default 10 to 100000 to stop the real `/api/v1/scans` endpoint returning 429 across the non-hermetic test suite and CI retries.
Why it matters / assessment: This is confined to two ephemeral surfaces: (1) the `env:` map of the `e2e` GitHub Actions job, which exists only for that job's runner, and (2) `playwright.config.ts`'s `webServer.env`, which Playwright injects only into the dev server it spawns for the test run (`reuseExistingServer: false` guarantees a fresh, isolated server — it will never attach to or mutate a production/staging process). Production rate limiting reads `RATE_LIMIT_PER_HOUR` from the deployed environment's own config and is entirely unaffected by these files. No code path was changed to weaken the limiter itself. Correctly scoped.
How to fix it: No action required.

### FINDING: Cache key for Playwright browsers is acceptable; minor cache-scope note
Severity: **Info**
File and line: `.github/workflows/test.yml:88-92` (`actions/cache@v4`, `key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}`, `restore-keys: ${{ runner.os }}-playwright-`)
What it is: The browser binary cache is keyed on a hash of `package-lock.json`. The plan specified keying on the Playwright version; `hashFiles('package-lock.json')` is a reasonable proxy (the lockfile pins `playwright@1.59.1`/`@playwright/test@1.59.1`, so the key rotates whenever the Playwright version changes).
Why it matters: No cache-poisoning vector is introduced. The cache is restored before `npx playwright install --with-deps chromium`, and `playwright install` verifies/repopulates the browser directory regardless of cache hit, so a stale or partial cache is self-healing, not exploitable. The `restore-keys` fallback (`${{ runner.os }}-playwright-`) could restore an older browser set on lockfile change, but the subsequent `playwright install` reconciles it — no integrity risk. One observation: keying on the entire lockfile hash means the cache busts on *any* dependency change, not just Playwright, slightly reducing cache hit rate (a performance, not security, concern).
How to fix it: No security action required. Optional: tighten the key to the resolved Playwright version (e.g. derive it in a step) if cache efficiency matters.

### FINDING: Artifact upload does not leak secrets
Severity: **Info** (no issue — verified)
File and line: `.github/workflows/test.yml:106-111` (`actions/upload-artifact@v4`, `path: playwright-report/`, `if: always()`, `retention-days: 7`)
What it is: The HTML Playwright report is uploaded as an artifact on every run.
Why it matters / assessment: The uploaded path is scoped narrowly to `playwright-report/` (not the repo root, not `.env`, not `e2e.db`). The report contains test names, assertion output, and traces only `on-first-retry` (`playwright.config.ts:47`). The tests assert on a hardcoded public URL (`https://example.com`) and observed request bodies for that same public URL — no credentials, tokens, or user data flow through the assertions. The dummy `NEXTAUTH_SECRET` is an env var, not rendered into report content. `retention-days: 7` bounds exposure. No leak.
How to fix it: No action required.

### FINDING: Non-hermetic E2E tests introduce no SSRF/abuse surface
Severity: **Info** (no issue — verified)
File and line: `e2e/landing.spec.ts:74` (`'https://example.com'`), `:108` asserts empty-input default `'example.com'`; `e2e/landing.a11y.spec.ts:25`
What it is: The tests submit the real `/api/v1/scans` flow, which performs DNS resolution and SSRF-style validation in `src/lib/url-validator.ts` (blocks RFC-1918, loopback, link-local, cloud metadata `169.254.169.254`, etc.).
Why it matters / assessment: The only hostnames the test code sends are `https://example.com` and the literal `example.com` (the app's own empty-input default, observed not chosen by the test). No internal hostname, private IP, metadata endpoint, `localhost`, or attacker-controlled value is submitted. The tests *observe* the outgoing POST (`page.waitForRequest`) and do not stub or bypass `url-validator.ts`, so the existing SSRF guard remains fully in force during the test run. The test code introduces no new network target and no new abuse surface beyond a single scan of a well-known public documentation domain.
How to fix it: No action required.

### FINDING: `data-testid` additions are attribute-only
Severity: **Info** (no issue — verified)
File and line: `src/app/[locale]/landing-hero.tsx:159` (`hero-scan-form`), `:173` (`hero-url-input`), `:187` (`hero-scan-submit`), `:823` (`final-cta-pricing`)
What it is: Four static `data-testid` attributes added to existing JSX elements.
Why it matters / assessment: Each is a constant string literal on an element that already exists. No data binding, no user/PII value, no logic, no conditional rendering, no event handler change. The diff shows the surrounding `onSubmit`, `disabled`, `aria-label`, and `href` are untouched. Zero behaviour change and no information exposure — `data-testid` values are generic and reveal nothing sensitive.
How to fix it: No action required.

### FINDING: Supply chain — lockfile integrity consistent, no typosquats
Severity: **Info** (no issue — verified)
File and line: `package.json:52-53`, `package-lock.json:1044-1054` (`@axe-core/playwright@4.11.3`, MPL-2.0, dep `axe-core@~4.11.4`), `package-lock.json:2777-2789` (`@playwright/test@1.59.1`, Apache-2.0, dep `playwright@1.59.1`)
What it is: Two devDependencies added: `@playwright/test` pinned exact `1.59.1`, `@axe-core/playwright` `^4.11.3`.
Why it matters / assessment: Verified consistent and from legitimate scoped packages on the official npm registry with SHA-512 integrity hashes present:
- `@playwright/test@1.59.1` depends on `playwright@1.59.1`, and the repo already had `playwright@^1.59.1` resolving to `playwright-core@1.59.1` (`package-lock.json:12334-12358`) — versions align exactly as the plan required (no split-brain Playwright versions, which is itself a stability/security positive).
- `@axe-core/playwright@4.11.3` pulls `axe-core@~4.11.4` and peers on `playwright-core >= 1.0.0` (satisfied). All packages are the well-known official `@playwright/*` (Microsoft) and `@axe-core/*` (Deque) scopes — no typosquat (`playwrite`, `axe_core`, etc.), no unexpected extra packages in the diff. `package.json` and `package-lock.json` entries match. `yarn.lock` churned in the diff but is non-authoritative per project policy (npm is canonical, CI uses `npm ci`) and is not consumed by CI — not a security concern, though noting it changed.
How to fix it: No action required. Note for housekeeping (out of security scope): `yarn.lock` was modified despite project policy saying not to touch it — cosmetic/process, not a vulnerability.

---

## SUMMARY

Critical: 0
High    : 0
Medium  : 0
Low     : 1   (no least-privilege `permissions:` on the workflow — pre-existing gap, defence-in-depth)
Info    : 8   (all verified non-issues or accepted-by-design)

**Overall verdict: PASS**

This change is a test-infrastructure and CI-wiring task with no production code-path modification. The only product-code change (`landing-hero.tsx`) is four static `data-testid` attributes — attribute-only, zero behaviour change, no data exposure. No real secrets were committed (full-diff secret scan clean; the only "secret" is a clearly-labelled ephemeral test constant scoped to a throwaway SQLite env). The raised `RATE_LIMIT_PER_HOUR` and dummy `NEXTAUTH_SECRET` are correctly confined to ephemeral CI/test surfaces and cannot affect production. The non-hermetic tests only ever target the public `example.com` and do not bypass the existing SSRF validator. Supply-chain additions are legitimate, version-consistent, integrity-hashed official packages with no typosquats.

The single Low finding (no `permissions:` block) is a pre-existing repo-wide hardening gap, not a regression introduced by this work, and does not block. Recommended follow-up: add a top-level `permissions: { contents: read }` to `test.yml` to harden all jobs at once.
