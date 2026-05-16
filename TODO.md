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

**Status:** Not started — no plan yet. Run `/start`, then `/plan`.

## High-Level Tasks

Populated by the orchestrator after Human Gate 1 (Planning) and refined in
Phase 2 (Decomposition). Each row mirrors a `pipeline/tasks/T-XX.json` contract.

| Task | Title | Assigned | Status | Notes |
|------|-------|----------|--------|-------|
| —    | _(none yet — added after planning)_ | — | Pending | |

Status legend: Pending → In progress → In review → Done → Blocked
