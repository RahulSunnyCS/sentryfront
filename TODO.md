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

**Status:** Awaiting Human Gate 1 — plan approval.
**Lane:** feature-fast | **Risk:** MEDIUM | **Tags:** frontend, infra

## High-Level Tasks

From `pipeline/plan.md`. Decomposed into `pipeline/tasks/T-XX.json` after Gate 1.

| Task | Title | Assigned | Status | Notes |
|------|-------|----------|--------|-------|
| T-01 | Add `@playwright/test@1.59.1` (exact pin) devDep + regen `package-lock.json` | implementor | Pending | Hard CI prereq |
| T-02 | Add `playwright.config.ts` (chromium, webServer `npm run dev`, 180s, workers:1) | implementor | Pending | |
| T-03 | Add `e2e/` tests + shared mock helper (landing critical path, hermetic) | implementor | Pending | |
| T-04 | Add `test:e2e` / `test:e2e:ui` npm scripts | implementor | Pending | |
| T-05 | Exclude `e2e/**` from `vitest.config.ts` | implementor | Pending | Prevents unit-run crash |
| T-06 | Add parallel `e2e` job to `.github/workflows/test.yml` (browser cache + artifact) | implementor | Pending | |
| T-07 | `.gitignore` Playwright outputs + `e2e.db*` | implementor | Pending | |

Status legend: Pending → In progress → In review → Done → Blocked
