# TODO

> **Single-writer contract — read before editing.**
> This file is the human-readable **mirror** of the task plan, not a source of
> truth. Rules (defined in CLAUDE.md → "Shared Task Ledger"):
> - The **Lead Orchestrator is the only writer.** It regenerates this file from
>   `pipeline/tasks/T-XX.json` at every phase boundary.
> - Specialist / implementor / reviewer / test agents **read this for context
>   but never write it** — Phase 3 runs agents in parallel and shared writes are
>   forbidden by the decomposition rule. Agents report status to the
>   orchestrator, which updates this file.
> - Source of truth: `pipeline/tasks/*.json`. Phase/gate state:
>   `pipeline/progress.md`. This file: the at-a-glance view.

**Status:** Phase 2 done — task contracts ready. Awaiting "proceed with implementation?"
**Lane:** feature-fast | **Risk:** MEDIUM | **Tags:** frontend, infra
**Gate-1:** APPROVED (D1 no-fake · D2 CI+local-or-CI-ONLY acknowledged · D3 data-testid · R1 axe · R2 README badge)

## High-Level Tasks

Mirror of `pipeline/tasks/T-XX.json`. Parallel-safe: no two tasks write the same file.

| Task | Title | Assigned | Status | Deps | Files |
|------|-------|----------|--------|------|-------|
| T-01 | Playwright+axe devDeps + test:e2e scripts + lockfile | implementor | Done | — | package.json, package-lock.json |
| T-02 | playwright.config.ts (chromium, own server, 180s, reuse:false) | implementor | Done | T-01 | playwright.config.ts |
| T-03 | 4 data-testid hooks in landing-hero.tsx (attrs only) | implementor | Done | — | src/app/[locale]/landing-hero.tsx |
| T-04 | e2e non-hermetic landing + a11y specs + selectors.ts | implementor | In progress | T-01,02,03 | e2e/** |
| T-05 | Exclude e2e/** from vitest | implementor | Done | — | vitest.config.ts |
| T-06 | CI e2e job (cache+artifact, no continue-on-error) | implementor | Done | T-01 | .github/workflows/test.yml |
| T-07 | README CI badge + report-artifact note | implementor | Done | T-06 | README.md |
| T-08 | gitignore Playwright outputs + e2e.db* | implementor | Done | — | .gitignore |

Status legend: Pending → In progress → In review → Done → Blocked
