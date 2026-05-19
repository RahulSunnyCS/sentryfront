AUTOMATION GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verdict: **CI-ONLY** (does NOT block Gate 2/3)

Command: `npm run test:e2e` — ran (dev server booted, suite executed once).
Result line: 125 failed · 69 skipped · 17 did not run · 43 passed (1.7m)

ROOT CAUSE (single, environmental):
122/125 failures are byte-identical:
`browserType.launch: Executable doesn't exist at
/opt/pw-browsers/chromium_headless_shell-1217/chrome-headless-shell-linux64/
chrome-headless-shell`
The remaining 3 are direct cascades (`TypeError: Cannot read 'close'` on the
never-created browser; one pre-existing non-epic security-module assertion that
also never got a browser). EVERY failing test failed in 1–2ms — no browser
launched, no test logic executed.

Remediation attempted: `npx playwright install chromium
chromium-headless-shell` → **FAILED**: "Download failure" — the environment
network policy blocks the Playwright browser CDN. A real in-sandbox run is
therefore impossible.

REGRESSION TRIAGE (every E2E failure classified):
- DIRECT      : 0
- COLLATERAL  : 0
- EXTERNAL    : 125 — all "missing browser binary" (env), binary download
                blocked by network policy. Per CLAUDE.md Automation Gate:
                missing browser binary = EXTERNAL, never a gate FAIL, never
                blocks Gate 2/3.
- 43 passed   : the non-browser subset (probe DB checks, coverage-matrix fs
                checks, etc.) — passed, confirming harness/seed wiring is sound
                where a browser isn't needed.

Tag impact: the @critical/@functional E2E failures are ALL EXTERNAL, so per
the rules they are NOT counted as Automation Gate FAILs. Gate = CI-ONLY.

HONEST LIMITATION (surfaced — General Rule 4):
E2E behavioural correctness is NOT verified in this sandbox (no browser, CDN
blocked). What IS verified: all 254 specs compile & list cleanly
(`npx playwright test --list`), `npm run typecheck` clean, the non-browser
subset (43) passes, and the suite was reviewed (Phase 4) and fixed (Phase 4.5).
The suite is built to run in CI (`.github/workflows/test.yml` E2E job) where
the browser is installed. This is the expected CI-ONLY outcome the pipeline
anticipated, not a code regression.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
