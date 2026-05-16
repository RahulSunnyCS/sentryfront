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

**Status:** Awaiting Human Gate 1 — plan v2 approval (recommendation round 1/2).
**Lane:** feature-fast | **Risk:** MEDIUM | **Tags:** frontend, infra
**Gate-1 decisions:** D1 no-fake (non-hermetic) · D2 CI+local-or-CI-ONLY · D3 data-testid · R1 axe · R2 README badge

## High-Level Tasks

From `pipeline/plan.md` v2. Decomposed into `pipeline/tasks/T-XX.json` after Gate 1.

| Task | Title | Assigned | Status | Notes |
|------|-------|----------|--------|-------|
| T-01 | Add `@playwright/test@1.59.1` (exact) + `@axe-core/playwright` devDeps + regen `package-lock.json` | implementor | Pending | Hard CI prereq |
| T-02 | Add `playwright.config.ts` (chromium, webServer `npm run dev`, 180s, workers:1, reuseExistingServer:false) | implementor | Pending | |
| T-03 | Add 4 `data-testid` hooks to `landing-hero.tsx` (product code) | implementor | Pending | Attributes only |
| T-04 | Add `e2e/` non-hermetic tests + a11y spec + `selectors.ts` | implementor | Pending | Real `/api/v1/scans` |
| T-05 | Add `test:e2e` / `test:e2e:ui` npm scripts | implementor | Pending | |
| T-06 | Exclude `e2e/**` from `vitest.config.ts` | implementor | Pending | Prevents unit-run crash |
| T-07 | Add parallel `e2e` job to `.github/workflows/test.yml` (cache + artifact, no continue-on-error) | implementor | Pending | CI enforces |
| T-08 | README CI badge + report-artifact note | implementor | Pending | R2 |
| T-09 | `.gitignore` Playwright outputs + `e2e.db*` | implementor | Pending | |

Status legend: Pending → In progress → In review → Done → Blocked
