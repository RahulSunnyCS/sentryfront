---
description: Run Regression Triage + Blast-Radius Validation standalone against the current failing tests, without re-running the full pipeline. Classifies each failure DIRECT vs COLLATERAL, routes DIRECT to the Implementor and COLLATERAL to the regression-analyst, and validates that every changed file maps to a declared task.
---

Run the Phase 6 Regression Triage and the Phase 5→6 Change-Scope & Blast-Radius
Validation as defined in CLAUDE.md. Do not re-run earlier phases.

## Step 1 — Change-Scope & Blast-Radius Validation (Haiku, low effort)

1. Diff every changed test and source file against the base branch.
2. Map each changed file to a declared task in `pipeline/tasks/T-XX.json`.
3. Every changed file must link to a task. Flag any file that does not, and any
   shared/common component touched by more than one task.
4. Write `pipeline/reviews/blast-radius-validation.md`: per file → linked task →
   `valid` / `unlinked` / `shared-ripple`.
5. For each `shared-ripple` (a common-component change rippling into many
   places): escalate to the architecture-reviewer (coupling lens) and, if a
   regression is suspected, to the regression-analyst.

## Step 2 — Regression Triage (Haiku, low effort)

1. Read the current `npm run test` output (or run `npm run test` to get it
   fresh). If E2E tests have failed (`npm run test:e2e`), include those too —
   the same triage applies to a failing E2E test for an unrelated flow.
2. For each failing test (unit, integration, or E2E), classify:
   - **DIRECT** — the failing test's subject is inside a current task's
     `files_to_modify` / `files_to_create`.
   - **COLLATERAL** — the failing test is outside every task scope and a
     shared/common component changed this run, breaking it.
   - **EXTERNAL** — the failure is an external factor, not the code: flaky
     test, dev server / port / env / network, missing browser binary, timeout.
     Not a regression — surface the exact error, do not route it as a fix
     target, do not let it block.
3. Write the classification to `pipeline/reviews/regression-triage.md`.

## Step 3 — Route each failure

- **DIRECT** → delegate a targeted fix to the Implementor agent
  (.claude/agents/implementor.md). The fix stays within the failing test's
  subject scope. Maximum 2 automatic retry cycles (the existing Phase 6 rule).
  If a fix needs a file outside the original task scope, stop and ask.
- **COLLATERAL** → delegate to the regression-analyst agent
  (.claude/agents/regression-analyst.md) at Opus, high effort. It evaluates the
  shared-component change and the architecture that let it cascade. Bounded to
  ONE auto-fix attempt, only inside the changed common component. It does NOT
  consume the DIRECT path's 2-retry budget. An architectural-fault regression is
  surfaced to the user immediately — do not wait for a gate.
- **EXTERNAL** → do not route to any fix agent. Record the exact error in
  `pipeline/reviews/regression-triage.md`, surface it to the user, and do not
  let it block. An environmental flake is never a regression.

## Rules

- Never modify a failing test to make it pass — a regression is fixed at its
  cause.
- The "max 2 automatic retries" cap applies to DIRECT failures only. COLLATERAL
  is escalation, not retry — never silently loop it.
- If the regression-analyst surfaces an architectural fault, stop and report it
  to the user immediately with the full blast radius.

## Report

When done, report:
- Blast-radius validation result: how many changed files, how many unlinked or
  shared-ripple, what was escalated.
- Per failing test: DIRECT or COLLATERAL, and the outcome (fixed / surfaced /
  still failing).
- For any SURFACED regression: the root cause, blast radius, and the decision
  needed from the user.

Then stop. Do not proceed to Phase 7 automatically.
