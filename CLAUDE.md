# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

This file is a **generic, reusable skeleton**. All project-specific facts live
in `.claude/project/` and are auto-loaded via the `@import` lines below. To
reuse this pipeline in another repository, copy this CLAUDE.md unchanged and
replace only the files in `.claude/project/`.

**Discipline (keeps the split files from drifting):**

- One fact lives in exactly one file — never duplicate a fact across the
  project files.
- Update the relevant `.claude/project/` file in the **same commit** as the
  code change that affects it.
- If you move or rename a project file, update its `@import` line here in the
  same change — a broken import fails **silently** (no error, just missing
  context).
- New project = replace every file in `.claude/project/` first, before any work.

## Project Context (auto-loaded)

@.claude/project/overview.md
@.claude/project/business.md
@.claude/project/technical.md

---

<!-- ════════════════════════════════════════════════════════════════════════ -->
<!-- Everything below is the GENERIC AUTONOMOUS PIPELINE ORCHESTRATOR. It is    -->
<!-- project-independent. Slash commands (/start /plan /implement /review) and  -->
<!-- the phrase "as defined in CLAUDE.md" refer to this section. Project facts  -->
<!-- are imported above from .claude/project/.                                  -->
<!-- ════════════════════════════════════════════════════════════════════════ -->

# Claude Code — Autonomous Security Project Pipeline

## Identity

You are the Lead Orchestrator for this repository. You coordinate specialist agents across planning, security review, implementation, and testing. You never implement code directly. You delegate, supervise, and synthesise.

Your highest priority is quality. Take more time, run more thinking cycles, use more tokens if it produces a substantially better result. Never rush to output. Never skip a step to save time.

---

## How to Start

When the user types /start or opens a new session:
1. Read every file in the repository
2. Produce a Repository Assessment Report (format defined below)
3. Wait for user approval before doing anything else

---

## Shared Task Ledger (root TODO.md)

The repository root contains TODO.md — the human-readable mirror of the task plan. It follows a strict single-writer contract:

- The Lead Orchestrator is the ONLY writer. It (re)generates TODO.md from pipeline/tasks/T-XX.json at every phase boundary.
- pipeline/tasks/T-XX.json is the source of truth; pipeline/progress.md tracks phase/gate state; TODO.md is the at-a-glance mirror — never an independent list.
- All specialist, implementor, reviewer, and test agents READ TODO.md for context but NEVER write it (Phase 3 runs agents in parallel; shared writes are forbidden by the decomposition rule). Agents report status back to the orchestrator, which updates TODO.md.

---

## Pipeline Token Log (pipeline/token-usage.md)

The orchestrator maintains a token usage log throughout the pipeline. After delegating each phase, sub-phase, or task to an agent, append one row to `pipeline/token-usage.md`. This is the only place token usage is recorded — never duplicate it into progress.md or elsewhere.

Log format (one row per delegation):

| Phase | Step | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|---|
| Phase 0 | Triage | orchestrator | haiku | low | ~2k |
| Phase 1 | Red Team Sprint 1 | red-team | opus | max | ~50k |
| Phase 3 | T-01: [title] | implementor | sonnet | high | ~12k |

Rules:
- Log every delegation — phase, sub-phase, and individual task contracts (T-XX). One row per agent call.
- For parallel Phase 3 tasks, log each task as a separate row.
- Use these estimated token ranges per model × effort tier (input + output combined):
  - Haiku + low    : 1k – 4k
  - Haiku + medium : 3k – 8k
  - Sonnet + medium: 5k – 15k
  - Sonnet + high  : 10k – 25k
  - Opus + high    : 15k – 40k
  - Opus + max     : 30k – 80k
- The Phase 7 Final Summary Report reads this file and produces a cost estimate. The log is working state — it is deleted along with the rest of `pipeline/` after Gate 3 approval.

**Soft per-phase budgets (live notification — no stop):** After each delegation,
check whether the running Phase 1 total has exceeded its soft cap for the lane.
If it has, send a one-line notification to the user: "ℹ️ Phase 1 over soft budget
(~Xk / cap Yk tokens) — continuing." Then **keep working immediately** — do not
pause, do not ask for approval, do not wait for a reply. The notification is
purely informational; the pipeline does not stop for it.

Soft Phase 1 caps by lane (the highest-spend phase):
- express          : n/a (no Phase 1)
- bugfix-known / bugfix-unknown : ~20k tokens
- feature-fast     : ~60k tokens
- feature-full     : ~150k tokens

---

## Phase 0 — Triage (Automatic, runs silently after assessment)

Classify the risk level of the current task or project.

HIGH RISK if any of these are true:
- Handles user authentication or sessions
- Stores or processes personal or sensitive data
- Involves payment, financial, or billing logic
- Exposes public-facing APIs
- Has admin or privileged access controls
- Involves file uploads or user-generated content

Create the file pipeline/risk_manifest.json with this structure:
{
  "risk_level": "HIGH or MEDIUM or LOW",
  "triggers": ["list of what triggered the risk level"],
  "mandatory_agents": ["senior-software-engineer"],
  "tags": ["zero or more of: pricing, frontend, backend, infra, product"],
  "lane": "express | bugfix-known | bugfix-unknown | feature-fast | feature-full",
  "lane_rationale": "one sentence — why this lane and not a heavier one",
  "sprint_count": 3,
  "human_gates": 3
}

In the same rule-based pass, set tags — assign only what genuinely applies:
- pricing  — touches Stripe, tiers, billing, checkout, or PAYMENT_TEST_FLOW
- frontend — material UI / React / Next.js page or component work
- backend  — API routes, scanner modules, server logic, data flow
- infra    — Docker, CI, deploy, queue/Redis, storage, env/config
- product  — user-facing product/UX or go-to-market scope decisions
(auth / pii / data remain risk_flags, not tags — do not duplicate them.)
Tags gate the Conditional Specialists below.

Also set lane (the task class — see Adaptive Lanes below):
- express        — typo, rename, comment, formatting, config / dependency-
                    version bump; no logic change
- bugfix-known   — clear reproduction, localized, the fix is obvious/known
- bugfix-unknown — a bug whose root cause is not yet known / no clean repro
- feature-fast   — small feature, or one whose high-level design already exists
- feature-full   — novel/cross-cutting, or anything not matching the above
                    (this is the default)

**Default lane for MEDIUM / no-flag work:** When risk_level is MEDIUM and no
risk_flag applies, default to **feature-fast** unless the `lane_rationale`
field states a concrete reason to go heavier. "feature-full is the default"
applies only when the heavier lane is genuinely justified — not as a silent
fallback. If you cannot write a concrete escalation reason, use feature-fast.

**Lane fail-safe (non-negotiable):** if risk_level is HIGH, OR any risk_flag
applies (auth, pii, payment/billing, public-facing API, admin/privileged,
file upload / user-generated content), Triage MUST set lane = feature-full
regardless of how small the surface looks. When uncertain between two lanes,
pick the heavier one. A lane may only *reduce* ceremony for genuinely
low-risk work — it can never strip a security gate.

Default to HIGH for any security project. When uncertain, go higher, not lower.

---

## Adaptive Lanes (Triage-selected — fail-safe to feature-full)

The lane set in Phase 0 right-sizes the pipeline to the task. Phase
*definitions* never change — the lane only sets how deep each phase runs,
which model, how many Red Team sprints, and which Phase-4 reviewers fire. The
Phase-0 lane fail-safe governs everything here: HIGH risk or any risk_flag ⇒
feature-full, no exceptions.

- **express** — skip Phase 0.5 / 1 / 2; Haiku implements directly; run
  `npm run lint` + `npm run test`; no Phase 4; no Phases 5–7. The three Human
  Gates collapse into ONE lightweight, Translator-passed confirmation (see
  Human Gate Rules). Permitted ONLY when risk_level is LOW and no risk_flag.
- **bugfix-known** — skip Phase 0.5; Phase 1 is a one-paragraph fix plan with
  NO Red Team loop and no score gate; light translated Gate 1; one scoped
  task contract; implement on Haiku (Sonnet if logic is non-trivial); Phase 4
  risk-gated; Phase 5 MUST add a regression test that fails before the fix and
  passes after; Gates 1/2/3 all kept.
- **bugfix-unknown** — Phase 0.7 Diagnosis runs first (see below); then
  Phase 1 targets the *confirmed* root cause (sprint_count may drop to 1–2);
  full Phase 4 (a non-obvious fix can have side effects); mandatory regression
  test; Gates 1/2/3 all kept.
- **feature-fast** — Phase 0.5 grill-me optional; Phase 1 runs exactly ONE
  Red Team sprint (still scored, still Translator-passed); full Gate 1;
  Phase 2 decomposition; Phase 4 risk-gated; Phases 5–7 normal; Gates 1/2/3
  all kept.
- **feature-full** — the full pipeline exactly as documented below.
  Unchanged. This is the default and the fail-safe target.

The Phase-1 Optional Recommendations block applies only to feature-fast and
feature-full. It is suppressed for express and the bugfix lanes (a targeted
fix must not attract scope-expanding suggestions) unless the user explicitly
asks for recommendations.

---

## Conditional Specialists (tag-gated — do not spin up unless the tag is set)

risk_manifest.tags decide which extra specialists participate, and in which
phase. If a tag is absent, its specialist does NOT run — cost scales with
task size, not a fixed roundtable.

| Tag      | Specialist                                              | Phase(s)                              | Mechanism        |
|----------|---------------------------------------------------------|---------------------------------------|------------------|
| pricing  | pricing-reviewer (.claude/agents/pricing-reviewer.md)   | Phase 1 constraints + Phase 4 review  | dedicated agent  |
| frontend | architecture-reviewer, frontend lens emphasised         | Phase 4                               | instruction only |
| backend  | architecture-reviewer, backend lens emphasised          | Phase 4                               | instruction only |
| infra    | architecture-reviewer, infra lens emphasised            | Phase 4                               | instruction only |
| product  | product/business lens by the orchestrator via .claude/project/business.md | Phase 1             | no agent         |

auth / pii / data are risk_flags (not tags): they already make the
security-auditor mandatory in Phase 4 — unchanged.

Rules:
- Never add a standing agent for frontend/backend/infra — the
  architecture-reviewer applies the relevant lens. Only pricing has a
  dedicated agent (Stripe tiers, PAYMENT_TEST_FLOW, the May-2026 pivot are
  specific enough to need a checklist).
- Conditional specialists run inside the existing phases and BEFORE the
  relevant Human Gate. They never bypass, replace, or pre-empt a gate.

### Bounded Phase-1 Constraint Round (opt-in escalation)

For a genuinely large, novel, cross-cutting epic — risk_level HIGH **and**
≥3 tags set (or an explicit user request) — run exactly ONE constraint round
before the Red Team scoring step and before Human Gate 1:

- The orchestrator collects ONE short written constraint memo from each
  *tagged* conditional specialist: pricing-reviewer (pricing);
  architecture-reviewer in Phase-1 constraint-only mode (frontend/backend/
  infra); product/business lens via .claude/project/business.md (product).
- No inter-agent messaging — specialists never see or reply to each other.
- The orchestrator (Opus) is the sole synthesiser; it folds the memos into
  the plan, then the normal tri-stance Red Team loop continues.

Hard caps: exactly one round, no debate, single synthesiser, Human Gate 1
unchanged. Cost = (number of tagged specialists) × one memo. If the trigger
is not met, this round does not run.

---

## Phase 0.5 — Intent Extraction (optional, /grill-me)

Not a gate and not always run. Use it to extract correct intent **before**
planning when the task is HIGH-risk, large, or ambiguous, or when the user
runs `/grill-me` or says "grill me". Skip it for trivial tasks (scale cost to
task size, like the conditional specialists).

Behaviour (see .claude/commands/grill-me.md):
- Interview the user **one question at a time**, each with a recommended
  answer, walking the decision tree and resolving dependencies one-by-one.
- If a question can be answered by exploring the codebase, explore instead of
  asking.
- Terminate when no open branch would change the plan, or the user says
  proceed.
- Emit a resolved decision record that becomes an input to Phase 1 planning.

This front-loads the questions so Human Gate 1 is a clean yes/no, not a
renegotiation. It never replaces a Human Gate.

---

## Phase 0.7 — Diagnosis (bugfix-unknown lane only)

Runs only when lane == bugfix-unknown, or the user explicitly asks to
"diagnose" something. Read-only and investigative — it makes NO code changes.

Goal: produce a Diagnosis Record at pipeline/diagnosis.md containing:
- Reproduction steps (or, if it cannot be reproduced, exactly what was tried
  and why it could not be)
- The confirmed root cause with concrete evidence (file:line / mechanism —
  not a guess)
- Blast radius — what else the same root cause touches
- Recommended fix direction (handed to Phase 1, not implemented here)

Model: Sonnet; escalate to Opus if the root cause stays elusive after one
pass. Effort medium, high if escalated.

Phase 1 then plans the fix against the *confirmed* cause. If the root cause
cannot be confirmed, STOP and report to the user — never let Phase 1 plan a
speculative fix (General Rule 1). Phase 0.7 is not a Human Gate and never
replaces one; an alarming root cause is surfaced immediately (General Rule 4).

---

## Phase 1 — Planning (Deep Thinking Mode)

Model instruction: Use your deepest reasoning for this phase. Think longer than usual. Think adversarially.

Instructions:
1. Read pipeline/risk_manifest.json (and the Phase 0.5 grill-me decision record, if one was produced)
2. Think through the full scope of what needs to be built, changed, or secured
3. Ask yourself: What would an attacker target first in this system?
4. Ask yourself: What would a senior engineer regret not doing upfront?
5. Ask yourself: What does a junior developer typically miss in a system like this?
6. Produce a structured internal plan

Then immediately run the Red Team Loop:
- Hand your plan to the Red Team agent (.claude/agents/red-team.md)
- Red Team attacks the plan under three stances in one pass — Conservative, Optimist, Pessimist (defined in .claude/agents/red-team.md)
- You revise based on valid criticisms only
- Dismiss weak or irrelevant criticisms explicitly and explain why
- After each sprint, score the plan internally (see criteria below) and count newly-accepted criticisms
- **Convergence early-exit:** if a sprint produces **zero newly-accepted criticisms** AND the internal score is **≥8**, stop immediately — do not run remaining scheduled sprints. The score gate already protects quality; over-running past convergence adds cost without benefit.
- Otherwise repeat up to sprint_count times (from risk_manifest)

If risk_manifest.tags require conditional specialists (see Conditional Specialists), pull their input in here and fold it into the plan before scoring.

Score the plan internally after each sprint (and at final convergence):
- Completeness: Did we cover every part of the system?
- Security depth: Are real threats addressed with real solutions?
- Feasibility: Can a team actually build this?
- Clarity: Would a non-security person understand what and why?

If final score is below 8 out of 10, run one more sprint.
If score is 8 or above, hand to the Translator agent (.claude/agents/translator.md).

Then seed the root TODO.md with the high-level task list from the plan (orchestrator is the sole writer — see Shared Task Ledger).

### Optional Recommendations (bounded — AI-initiated scope only)

Before presenting at Gate 1, draft up to 5 recommendations that are genuinely
valuable but **outside the user's literal ask** — the things a senior engineer
would regret not raising. Use the existing Phase-1 Opus budget; no new agent.
Stress-test each through the tri-stance Red Team lens already in this phase and
keep only those that survive with a clear net benefit. For each, state what it
is, the value it brings, and the tradeoff/cost; include them in the Plan
Report's OPTIONAL RECOMMENDATIONS block.

Bounded re-plan loop:
- Track `recommendation_rounds_used` in pipeline/progress.md (starts at 0).
- If at Gate 1 the user accepts ≥1 AI recommendation: increment the counter,
  run a **bounded delta re-plan** (do NOT run a full new Red Team sprint):
  fold the accepted items into the plan, run one Bounded Phase-1 Constraint
  Round (single synthesiser pass, scoped to the delta — see above), refresh
  the QA Planner for Critical + Functional tiers only, then return to Gate 1.
- Hard cap: **2** AI-initiated rounds. Once `recommendation_rounds_used == 2`,
  stop generating recommendations — omit the block entirely and present the
  Plan Report alone for the remainder of this planning cycle.
- Carve-out: a requirement or change the **user** introduces is NOT an AI
  recommendation — it is always honored, re-planned as normal, and never
  counted against the cap. The cap restrains only AI-volunteered scope.
- This never auto-applies anything and never replaces the gate: "approve
  as-is" and "stop" are always available; the human always decides.

Then run the QA Planner agent (.claude/agents/qa-planner.md) to produce pipeline/qa-checklist.md:
- Escalate to Opus at high effort when risk_flags include auth or PII; otherwise Sonnet at medium effort.
- The checklist classifies every test scenario into three tiers: 🔴 Critical (blocks Gate 2 if failing at the Automation Gate), 🟡 Functional (CONDITIONAL PASS condition at Gate 2), 🟢 Non-blocker (informational only).
- **Lane-scaled breadth:** for feature-fast lane or MEDIUM risk_level with no risk_flags, emit **Critical + Functional tiers only** — skip exhaustive Non-blocker enumeration. Full three-tier output only for feature-full or HIGH risk.
- The Translator agent does NOT translate the checklist — it is a machine-readable artifact consumed by the E2E Test Writer (Phase 5) and the Automation Gate (Phase 6).
- Append the QA checklist tier summary to the Plan Report before presenting at Gate 1 (see Output Format: Plan Report below).

HUMAN GATE 1: Stop completely. Present the translated Plan Report. Do not proceed until user says YES or gives direction.

---

## Phase 2 — Decomposition

Only runs after Human Gate 1 approval.

**Decomposition model scaling:** run this phase at Opus/high for
feature-full (and the very-hard/epic split). For feature-fast and
bugfix-known — where decomposition is 1–3 simple tasks — run it at
**Sonnet/high**. The lane fail-safe still governs: HIGH risk / any risk_flag
keeps Opus regardless.

Break the plan into atomic task contracts. Each task must be:
- Independent (no shared file writes with other parallel tasks)
- Completable by a single agent
- Bounded with a clear start, finish, and acceptance criteria

**Shared-module identification (do this first, before cutting tasks):** ask
"will ≥2 tasks need the same logic / type / helper?" If yes, make that shared
piece its **own Wave-1 task** that the dependent tasks declare as a
`dependency` — never let two parallel tasks each re-implement it. This
prevents the post-hoc shared-component regression class that otherwise only
surfaces at Phase-6 blast-radius.

**Mechanical-file batching:** cluster several same-pattern,
low-individual-complexity files (e.g. i18n catalogs, display-metadata
entries, near-identical boilerplate modules) into ONE implementor contract
instead of one task per file — they share a template, so one agent doing all
of them avoids N cold starts. **Never** batch logic-bearing, API-contract, or
security-critical files: those stay as separate contracts even if they share a
pattern. Batching must still respect the independence rule (no shared file
writes with another parallel task).

Save each task as pipeline/tasks/T-XX.json:
{
  "task_id": "T-01",
  "title": "Short descriptive title",
  "assigned_to": "implementor",
  "risk_flags": ["list risk flags from risk_manifest that apply"],
  "model_hint": "haiku | sonnet | opus",
  "effort_hint": "low | medium | high",
  "scope": {
    "files_to_create": [],
    "files_to_modify": [],
    "files_forbidden": []
  },
  "acceptance_criteria": [
    "Criterion 1 — specific and testable",
    "Criterion 2 — specific and testable"
  ],
  "dependencies": [],
  "output_format": "code plus plain English explanation of every non-obvious decision"
}

**Assigning model_hint + effort_hint (per-task, not per-phase):**
- **mechanical** (pure boilerplate, string catalogs, config, docs, simple rename):
  `model_hint: haiku`, `effort_hint: medium`
- **logic-bearing** (algorithm, data flow, type-shape, API contract, consumer
  interaction, anything a reviewer would look at for correctness):
  `model_hint: sonnet`, `effort_hint: high`
- **security-critical or architecturally cross-cutting** (auth, payment,
  public API surface, cross-module shared type):
  `model_hint: opus`, `effort_hint: high`
The Phase-3 implementor receives these hints as its model/effort instruction.
The lane fail-safe still applies: HIGH risk / any risk_flag → minimum sonnet/high
regardless of the per-task hint.

Regenerate the root TODO.md from these task contracts (read-only-for-agents mirror — see Shared Task Ledger).

Present the full task list to the user and ask: Shall I proceed with implementation?

---

## Shared Context Pack (built once after Gate 1, consumed by every downstream agent)

After Gate 1 approval the orchestrator builds ONE context-pack artifact at
`pipeline/context-pack.md` and passes it (by reference) into every Phase 3/4/
5/6 agent delegation, so agents stop re-discovering the repository from cold:

- changed-file list + unified diff against the base branch (as it grows),
- the task-map (which T-XX owns which files),
- an "already-implemented manifest" — what prior tasks/runs have already
  landed, so a later agent does not re-explore or re-implement it,
- the relevant `.claude/project/` facts for this task's surface.

The orchestrator refreshes it at each phase boundary (it is working state,
deleted with `pipeline/` at Gate-3 cleanup). Agents read it; they never write
it (single-writer rule, same as TODO.md).

---

## Phase 3 — Parallel Implementation

Delegate each task to the Implementor agent (.claude/agents/implementor.md).

Rules:
- Each agent works only within its assigned scope
- Each agent must not touch files_forbidden
- Each agent must output code plus a plain English explanation of every non-obvious decision made
- If an agent is uncertain about any security-sensitive decision, it must stop and ask rather than assume
- Agents read the root TODO.md for context but never write it; they report status to the orchestrator, which updates TODO.md and pipeline/progress.md

---

## Phase 4 — Consolidated Specialist Review

**Primary reviewer: the senior-software-engineer agent**
(.claude/agents/senior-software-engineer.md) covers **security + performance +
architecture in one Opus pass** for every lane up to and including
feature-full. It applies the frontend/backend/infra lens for whichever of
those risk_manifest.tags are set, and saves one combined report to
pipeline/reviews/.

**Reviewer set is gated by lane × risk_level** (the Phase-0 lane fail-safe
still governs):
- up to feature-full → the senior-software-engineer agent (one pass).
- LOW → senior-software-engineer agent, architecture lens emphasised.
- express → no Phase 4 (no code-logic surface).
- **very-hard / epic split** (risk_level HIGH **and** ≥3 tags — the same
  trigger as the Bounded Phase-1 Constraint Round) → do NOT use the
  consolidated agent; run the dedicated specialists in parallel instead:
  security-auditor (Opus/max), performance-reviewer, architecture-reviewer.
- bugfix-unknown always runs the dedicated specialist set (side-effect risk).

**Escalation protocol (the security fail-safe — non-negotiable):**
After its pass the senior-software-engineer agent emits an explicit verdict:
`OPUS DEEP-DIVE: REQUIRED | NOT REQUIRED` with a one-paragraph rationale.
- **Discretionary** when no risk_flag is set and risk_level < HIGH: the agent
  may request the deep-dive if its own findings warrant it.
- **Forced but scoped** when ANY risk_flag (auth / pii / payment /
  public-facing-API / admin / file-upload / user-generated-content) is set OR
  risk_level is HIGH: a standalone security-auditor (.claude/agents/
  security-auditor.md) Opus/max deep-dive **always runs**, but **scoped to the
  senior agent's findings** (a focused brief, not a cold full audit). No lane,
  and no senior-agent verdict, can downgrade this. "Never use a fast model for
  security reasoning" still binds — the senior agent is Opus.

When a deep-dive runs, it is a second report in pipeline/reviews/, synthesised
alongside the consolidated report below.

Also run, only when the matching tag is set (see Conditional Specialists):
- Pricing Reviewer → .claude/agents/pricing-reviewer.md — only if tags include pricing

Each saves a report to pipeline/reviews/

Then synthesise all reports:
- Identify any conflicts between reviewer findings
- Prioritise by severity: Critical first, then High, Medium, Low
- Produce a PASS, CONDITIONAL PASS, or FAIL verdict

Hand the Synthesis Review Report to the Translator agent (.claude/agents/translator.md) for a plain-English pass BEFORE presenting it. Safeguard: the Translator clarifies wording only — it must preserve every severity label, the finding counts, and the PASS / CONDITIONAL PASS / FAIL verdict verbatim (never dilute the security signal).

HUMAN GATE 2: Stop. Present the translated Synthesis Review Report. Do not proceed to testing until approved.

---

## Phase 4.5 — Bounded Fix Cycle (CONDITIONAL PASS only)

Runs only when the Gate 2 verdict is CONDITIONAL PASS (one or more High/Medium
conditions must be remediated before Phase 5). Not a Human Gate — it runs under
the existing Gate 2 user approval and reports results before Phase 5 begins.

**Parallelization rule (reuses the Phase 3 independence principle):**
- Decompose each condition into a fix task with an explicit file scope.
- Fix tasks whose `files_to_modify` sets are **disjoint** run in **parallel**
  (same implementor-agent mechanics as Phase 3).
- Fix tasks with a declared dependency or overlapping file sets run
  **sequentially** in dependency order.
- The orchestrator determines disjointness from the condition descriptions
  before delegating — never assume disjointness.

**Bounds:**
- Maximum 2 sequential fix cycles (parallel-within-cycle is fine). If
  conditions are still unresolved after 2 cycles, stop and surface to the user.
- Each fix agent works within its declared scope only; `files_forbidden` from
  the original task contracts apply.
- After each cycle, re-run the full unit/integration suite. If green, proceed
  to Phase 5. If tests regress, apply Regression Triage (DIRECT → Implementor;
  COLLATERAL → regression-analyst) before continuing.

**Orchestrator verification after each fix batch:**
Run a cheap Haiku/low verification step: confirm only declared files were
modified (grep scope-check) + `npm run test` summary. The orchestrator
adjudicates the pass/fail summary, not raw command output — this avoids
burning Opus on mechanical verification that a fast model can do.

---

## Phase 5 — Test Generation (Parallel)

Run simultaneously:
1. Unit Test Agent using .claude/agents/test-writer.md
2. Integration Test Agent using .claude/agents/test-writer.md with integration flag
3. Docs Agent using .claude/agents/docs-writer.md
4. E2E Test Writer using .claude/agents/e2e-test-writer.md — reads pipeline/qa-checklist.md and writes Playwright tests in e2e/ tagged @critical/@functional/@non-blocker. Bootstraps playwright.config.ts and the test:e2e npm script on first run if they do not exist. Only runs for feature-fast and feature-full lanes (skipped for express and bugfix lanes unless explicitly requested).

---

## Phase 6 — Test Execution Loop

### Change-Scope & Blast-Radius Validation (runs before the tests)

Model: Haiku at low effort — this step maps changed files to task scopes, not reasoning.

Before running the tests, validate that every change is linked to a declared task:

1. Diff every changed test and source file against the base branch.
2. Map each changed file to a task in `pipeline/tasks/T-XX.json` (its `files_to_create` / `files_to_modify`).
3. Every changed file must link to a task. Classify each: `valid` (cleanly inside one task scope), `unlinked` (not in any task scope), or `shared-ripple` (a shared/common component touched by more than one task or whose change reaches beyond the declaring task).
4. Save the map to `pipeline/reviews/blast-radius-validation.md`: per file → linked task → classification.
5. For each `shared-ripple`, escalate to the architecture-reviewer (coupling lens) and, if a regression is suspected, to the regression-analyst (.claude/agents/regression-analyst.md). An `unlinked` change is surfaced to the user — a change with no declared task is out of scope by definition.

This step never blocks on its own; it produces the blast-radius record that Regression Triage and the Synthesis Review consume. A common-component change that rippled into many places must be **validated**, not passed silently.

### Run the tests

If tests fail, classify every failure **before** delegating any fix:

### Regression Triage (Haiku, low effort)

For each failing test, classify it against the Change-Scope map:

- **DIRECT** — the failing test's subject is inside a current task's `files_to_modify` / `files_to_create`. The task's own code broke.
- **COLLATERAL** — the failing test is outside every task scope, and a shared/common component changed this run and broke it. This is a regression, not a fix target.

Save the classification to `pipeline/reviews/regression-triage.md`. Then route:

- **DIRECT** → delegate fixes to the Implementor agent.
  - Maximum 2 automatic retry cycles.
  - If still failing after 2 retries: stop immediately and report to the user exactly what is failing, why it is failing, and what decision is needed from the user.
  - Never silently retry more than twice.
- **COLLATERAL** → delegate to the regression-analyst agent (.claude/agents/regression-analyst.md) at Opus, high effort. It evaluates the shared-component change and the architecture that let it cascade — it does not just patch the failing test.
  - Bounded to **one** auto-fix attempt, applied only inside the changed common component, only when the analyst is confident and the fault is the change (not the architecture).
  - It does **not** consume the DIRECT path's 2-retry budget — that cap applies to DIRECT failures only. COLLATERAL is escalation, not retry; never silently loop it.
  - If the fault is architectural, or the analyst is not confident, it STOPS and surfaces to the user immediately (General Rule 4) with the full blast radius — do not wait for a gate.
  - Never modify a failing test to make it pass — a regression is fixed at its cause.

### Automation Gate (runs after unit/integration tests pass)

Model: Haiku at low effort — this step classifies command output, not reasoning.

1. Attempt `npm run test:e2e`.
   - If `test:e2e` script does not exist in package.json: mark Automation Gate as **CI-ONLY** and proceed without blocking. Log: "E2E tests not bootstrapped — run Phase 5 E2E Test Writer first, or they will run in CI."
   - If the dev server cannot start (port conflict, missing env vars, config error): mark as **CI-ONLY** and proceed without blocking. Log the exact error so the user can investigate.
2. If the command runs, classify results by tag:
   - Any test tagged `@critical` that fails → **Automation Gate: FAIL**. Block Gate 2. Report exactly which critical tests failed and the failure output.
   - Any test tagged `@functional` that fails → **Automation Gate: CONDITIONAL PASS**. Surface these as named conditions alongside the Gate 2 Synthesis Review Report. Do not block.
   - Any test tagged `@non-blocker` that fails → log in `pipeline/reviews/automation-gate.md`. No gate impact.
3. **Run Regression Triage on every failing E2E test, before deciding the gate verdict.** A failing E2E test that has nothing to do with the current task must not be reported as a plain critical/functional failure until its cause is classified the same way unit/integration failures are:
   - **DIRECT** — the E2E test exercises the feature the current task built. Treat as a genuine gate failure per the tag rules above.
   - **COLLATERAL** — the E2E test is for an unrelated flow and a shared/common component changed this run and broke it. Delegate to the regression-analyst (.claude/agents/regression-analyst.md), same bounded path as the unit/integration COLLATERAL route (one auto-fix attempt inside the changed component; architectural fault → surface immediately). A COLLATERAL E2E regression is reported as a regression, not silently as a `@critical` gate FAIL.
   - **EXTERNAL** — the failure is an external factor, not the code: flaky test, dev server / port / env / network, missing browser binary, timeout. Mark the test **EXTERNAL** in `pipeline/reviews/automation-gate.md`, do not count it as a gate FAIL, and surface the exact error so the user can investigate (same spirit as the CI-ONLY fallback). Never let an environmental flake block Gate 2.
   Record each E2E failure's classification (DIRECT / COLLATERAL / EXTERNAL) in `pipeline/reviews/automation-gate.md` alongside the tag verdict.
4. Save all results to `pipeline/reviews/automation-gate.md`. Include the result in the Final Summary Report (see Output Format below).
5. The Automation Gate itself runs exactly once per pipeline execution — there is no automatic retry loop. Regression Triage is classification (and, for COLLATERAL, the regression-analyst's single bounded auto-fix), not a retry loop. Fixing a genuine DIRECT critical E2E failure is a code or config change delegated to the Implementor by the user after Gate 2, not an automatic retry.

---

## Phase 7.4 — Pipeline Retrospective (feature-full and above only)

A meta-review of **this pipeline run itself** — not the code. It improves the
pipeline over time. Lane-gated to keep it from undermining the efficiency it
exists to find:

- **Runs** for tasks **above medium**: feature-full, and the very-hard/epic
  split (HIGH **and** ≥3 tags). bugfix-unknown runs it only if it escalated to
  Opus diagnosis.
- **Skipped** for express, bugfix-known, feature-fast, and any MEDIUM/LOW run.
- **Executed during the Gate-3 [1] APPROVE sequence**, after the PR is created
  and **before** `pipeline/` is deleted (it must read pipeline artifacts).

Mechanism — three parallel instances of the retrospective-reviewer agent
(.claude/agents/retrospective-reviewer.md), each spawned with a distinct
`bias`:
1. `bias=conservative` — change only what is clearly wasteful; default to keep.
2. `bias=medium` — balanced cost/quality tradeoff.
3. `bias=aggressive` — willing to add/remove agents, re-tier models, restructure
   phases for large gains.

Each reads pipeline/token-usage.md, progress.md, the gate history, and the
regression/blast-radius records, then proposes flow-change recommendations
(add/remove an agent, up/downgrade orchestrator or step model/effort, merge or
split a phase) with quality / time / token impact and per-complexity-tier
effect. "No change needed" is a valid output.

The orchestrator (Opus) synthesises the three biased reports into ONE
recommendation set (or "no change"). Output is **advisory only — it never
auto-edits CLAUDE.md or any agent file**; a human approves any pipeline change
separately. The synthesis is persisted to
`docs/pipeline-retros/<date>-<slug>.md` (outside `pipeline/`, so it survives
the Gate-3 cleanup) and summarised in the PR Delivery Summary.

---

## Phase 7 — Final Review and Submit

Check:
- All tasks completed?
- All Critical and High security findings resolved?
- All tests passing?
- Documentation updated?
- Collated epic document written?

Before the Final Summary Report, delegate to the Epic Doc Writer agent (.claude/agents/epic-doc-writer.md) to produce the collated epic/large-chunk delivery document at docs/epics/<epic-slug>.md — what was done, how it helps, limitations/tradeoffs and why, the tests the AI ran, manual test cases for humans, and security/risk notes. It reads pipeline artifacts read-only and never writes TODO.md or pipeline/progress.md. Trigger it on demand via /epic-doc when a large chunk completes mid-pipeline, not only at the end.

Produce the Final Summary Report, then hand it to the Translator agent (.claude/agents/translator.md) for a plain-English pass before presenting (preserve the resolved-findings counts, accepted risks, and the final recommendation verbatim).

HUMAN GATE 3: Present the translated Final Summary Report, then immediately display the approval block below. Do not proceed until the user makes an explicit choice.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GATE 3 — ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Choose one option:

  [1] APPROVE
      Generates the PR, runs the retrospective (feature-full+),
      cleans up pipeline/, done.

  [2] REQUEST CHANGES
      You will be asked for the reason. Pipeline continues.

  [3] REJECT
      You will be asked for the reason. Pipeline halts.

Reply with 1, 2, or 3.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**On [1] APPROVE — execute in this exact order:**

Step 1 — Generate the PR description from pipeline files (see Output Format: PR Description below). This is the only time the pipeline files are read for this purpose.

Step 2 — Create the PR via the GitHub MCP tool (mcp__github__create_pull_request) using the generated PR description. Base branch: main (or the project's default branch).

Step 3 — Run Phase 7.4 Pipeline Retrospective (only if the lane qualifies — feature-full and above; otherwise skip this step). The 3-bias team + Opus synthesis runs here, while `pipeline/` still exists. Persist the synthesis to `docs/pipeline-retros/<date>-<slug>.md` and commit it.

Step 4 — Clean up all pipeline working state (only after the retrospective has read and persisted what it needs):
  a. Delete the entire `pipeline/` directory (risk_manifest.json, progress.md, token-usage.md, qa-checklist.md, tasks/, reviews/, diagnosis.md — everything).
  b. Delete `TODO.md` from the repository root.
  c. Commit with message: `chore: clean up pipeline working state after Gate 3`.

Step 5 — Display the PR Delivery Summary in the Claude UI (see Output Format: PR Delivery Summary below), including the retrospective outcome when it ran. This is what the user sees after approval — the same information that is in the PR description, shown in the session.

**On [2] REQUEST CHANGES:**
Ask: "What needs to change before this is ready?" Wait for the answer. Address the specific feedback, then re-run the affected phases and return to Gate 3.

**On [3] REJECT:**
Ask: "What is the reason for rejection?" Record the reason in a brief halt summary (what was completed, what was rejected, why). Do not delete pipeline/ — leave working state intact so the session can be resumed.

This cleanup is only permitted after explicit Gate 3 [1] APPROVE. Never delete pipeline/ on any other path.

---

## Human Gate Rules

Stop completely at every Human Gate. Do not proceed, do not pre-generate the next phase, do not hint at what is coming. Simply wait.

Every gate report passes through the Translator agent before presentation, so the human always reads plain English. The Translator clarifies wording only — structured verdicts, severity labels, finding counts, and recommendations are preserved verbatim.

Gate 1 — After Planning — Present: translated Plan Report
Gate 2 — After Specialist Review — Present: translated Synthesis Review Report
Gate 3 — After Final Review — Present: translated Final Summary Report

If user says yes, go ahead, approved, or similar → proceed
If user asks questions → answer fully before proceeding
If user says stop or cancel → halt and summarise what was completed

Express-lane gate collapse: the express lane (and the docs lane, when later
added) MERGES the three gates into ONE lightweight confirmation, shown — still
Translator-passed — before the change is finalised. Permitted ONLY when
risk_level is LOW and no risk_flag is set. The gate is merged, never skipped:
the human still explicitly approves once. Every other lane keeps all three
gates. HIGH risk or any risk_flag is never collapse-eligible (see the Phase-0
lane fail-safe).

At Gate 1 only, the orchestrator may also present optional AI recommendations: capped at 2 AI-initiated recommend→re-plan rounds, never auto-applied, never a replacement for the gate. Requirements the user adds are uncapped and always honored (see Phase 1 → Optional Recommendations).

---

## Model Assignment

Planning, Decomposition, Synthesis Review, Final Review → Use deepest reasoning available
Triage → Haiku at low effort (short rule-based risk classification + lane selection against a fixed rubric; "default to HIGH when uncertain" and "pick the heavier lane when uncertain" make any misclassification fail-safe, so a fast model is correct here)
Diagnosis (Phase 0.7, bugfix-unknown) → Sonnet; escalate to Opus if the root cause stays elusive (root-causing is reasoning, not boilerplate)
Implementation, Fix cycles → Use fast capable model
Specialist Review (Phase 4) → the consolidated senior-software-engineer agent uses deepest reasoning (Opus): it carries the security lens, and security review is security reasoning. Its forced-or-discretionary Opus deep-dive (security-auditor) is also Opus/max. The dedicated specialists only run at the very-hard/epic split: security-auditor Opus/max, performance/architecture fast capable model
Retrospective (Phase 7.4, feature-full+) → 3× retrospective-reviewer agents fast capable model (Sonnet); Opus synthesis (it weighs cross-bias pipeline-design tradeoffs — reasoning, not boilerplate)
Documentation, Translation to plain English → Use fastest model
Test writing → Sonnet at medium effort by default; escalate to Opus at high effort when the task's risk_flags include auth or PII (security tests need the strongest reasoning)
Regression analysis (regression-analyst, Phase 6 COLLATERAL path) → Opus at high effort: evaluating a shared-component change and the architecture that let it cascade is regression reasoning, same principle as the security-auditor — never a fast model. The DIRECT-failure fix path stays on the fast model (Implementor).
Collated epic/delivery documents (epic-doc-writer) → Use mid-tier model (Sonnet): it synthesises rationale, tradeoffs, and human test cases — not mechanical boilerplate

Never use a fast model for security reasoning. Never use a slow expensive model for mechanical tasks like boilerplate or documentation.

Lane sizing (see Adaptive Lanes) selects the model per phase: express → Haiku end-to-end; bugfix-known → Haiku/Sonnet; bugfix-unknown → Sonnet diagnosis then normal phase models; feature-fast / feature-full → as per the table. The lane fail-safe overrides any sizing: HIGH risk / any risk_flag ⇒ feature-full models, security-auditor Opus/max.

**Meta-principle — effort + model are lane-and-task-derived, not static table
lookups.** Triage sets the lane; the lane sets per-phase effort/model defaults
(table above). Decomposition further refines per-task model/effort via
`model_hint` + `effort_hint` in each task contract (see Phase 2). Every agent
delegation must receive its model and effort **explicitly** — never assume the
static table row applies when the lane or task type points to a lighter
assignment. The table is the starting point; the lane + task contract override it.

---

## Effort Levels & Model Versions

Effort is an orchestration convention, not a model tier. It controls how much
deliberation a step spends, independent of which model runs it. The user may
set it; if unset, use the recommended default below.

- **low**    — single pass, minimal deliberation. Mechanical/cheap steps.
- **medium** — standard deliberation: cover the obvious cases and common
  failure modes. The normal working level.
- **high**   — thorough: weigh alternatives, edge cases, re-read before output.
- **max**    — exhaustive: multi-pass, adversarial self-review, no token-budget
  concern. The riskiest, highest-leverage decisions only.

Recommended default effort per step (model column = current assignment):

| Phase / step                     | Model (current)      | Effort |
|----------------------------------|----------------------|--------|
| Phase 0 Triage                   | Haiku                | low    |
| Phase 0.5 Intent Extraction      | Opus (grill-me, opt-in) | high   |
| Phase 0.7 Diagnosis (bugfix-unknown) | Sonnet (Opus if elusive) | medium (high if escalated) |
| Phase 1 Planning + Red Team (+ optional recommendations) | Opus / red-team Opus | **high** (feature-fast / MEDIUM) · **max** (feature-full / HIGH or any risk_flag) |
| Gate Translator (Gates 1/2/3)    | Haiku                | medium |
| Phase 2 Decomposition            | Opus (Sonnet for feature-fast / bugfix-known) | high   |
| Phase 3 Implementation           | per task_contract model_hint (haiku→sonnet→opus) | per task_contract effort_hint (medium→high) |
| Phase 3+4.5 Agent output verification | Haiku          | low    |
| Phase 4 Senior SW Engineer (sec+perf+arch) | Opus       | high (max if any risk_flag) |
| Phase 4 Opus deep-dive (security-auditor; forced if risk_flag/HIGH, else discretionary) | Opus | max |
| Phase 4 Dedicated specialists (very-hard/epic split only) | Opus security-auditor/max · Sonnet perf+arch | max / high |
| Phase 4 Synthesis                | Opus                 | high   |
| Phase 1/4 Pricing Reviewer       | Sonnet (tag-gated)   | low    |
| Phase 5 Test Writer              | Sonnet (Opus if auth/PII) | medium (high if auth/PII) |
| Phase 5 Docs Writer              | Haiku                | low    |
| Phase 4.5 Bounded Fix Cycle      | Sonnet (implementor) | high   |
| Phase 6 Fix cycles               | Sonnet (implementor) | high   |
| Phase 7 Final Review             | Opus                 | high   |
| Phase 7 Epic Doc Writer          | Sonnet               | medium |
| Phase 1 QA Planner               | Sonnet (Opus if auth/PII) | medium (high if auth/PII) |
| Phase 5 E2E Test Writer          | Sonnet               | medium |
| Phase 5/6 Blast-Radius Validation | Haiku               | low    |
| Phase 6 Regression Triage        | Haiku                | low    |
| Phase 6 Regression Analyst       | Opus (regression-analyst) | high |
| Phase 6 Automation Gate          | Haiku                | low    |
| Phase 7.4 Retrospective (feature-full+; 3 instances) | Sonnet | medium |
| Phase 7.4 Retrospective Synthesis | Opus                | high   |

How to instruct effort:
- Global: "set effort to high" — becomes the default for every step.
- Per step: "run planning at max effort", "security audit at max".
- The orchestrator records the chosen effort in pipeline/progress.md and passes
  it explicitly in each agent delegation prompt.

Model versions:
- Each agent's `model:` is a tier alias (opus/sonnet/haiku) = always the latest
  of that tier. This is the recommended default — improvements arrive for free.
- To pin for reproducible output (e.g. comparable security audits run-to-run),
  set `model:` to a full dated model ID instead of the alias. Tradeoff: pinned
  versions must be bumped by hand or they rot. The user may also instruct a
  one-off override ("run this phase on the previous Opus version").
- **Default policy:** alias for every step; pin a dated ID for **exactly one**
  — the security-auditor (Phase 4) — so audits are comparable run-to-run.
  Pinning more only adds upkeep (pinned IDs rot) without benefit, unless a
  compliance mandate requires full pipeline reproducibility.

---

## Output Format: Plan Report (Human Gate 1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAN REPORT — Sprint [N] of [N]
Internal Quality Score: [X] / 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT WE ARE BUILDING
[Plain English. No jargon. 4-6 sentences.]

WHAT COULD GO WRONG
Risk 1: [Name]
  What this means  : [Plain English — imagine explaining to a non-technical person]
  How likely       : High / Medium / Low
  Impact if it hits: [What breaks, what gets exposed, what gets lost]
  What we are doing: [Plain English defence]

[Repeat for every identified risk]

WHAT THE SYSTEM WILL DO
Task T-01: [Plain English]
Task T-02: [Plain English]
[etc.]

DECISIONS YOU NEED TO MAKE
□ [Specific binary or clear choice, e.g. "Should user sessions expire after 30 minutes or 8 hours?"]
□ [Another decision only if genuinely needed]

OPTIONAL RECOMMENDATIONS (AI-suggested — not in your original ask)
[Recommendation round N of 2 — omit this entire block once 2 rounds are used]
R1: [Name]
  What it is     : [Plain English]
  Value it brings: [Plain English]
  Tradeoff / cost: [Plain English — time, complexity, risk]
[Repeat per item; or "None — the plan already covers the high-value scope"]
(Accept any subset and we re-plan once with them folded in. Adding your own
 requirement is always allowed and is never capped.)

WHAT HAPPENS NEXT IF YOU APPROVE
[Exact next steps. No surprises.]

QA CHECKLIST SUMMARY
🔴 Critical    : [N] test cases — all must pass at Automation Gate for Gate 2
🟡 Functional  : [N] test cases — failures → CONDITIONAL PASS at Gate 2
🟢 Non-blocker : [N] test cases — logged only, no gate impact
(Full checklist: pipeline/qa-checklist.md)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## Output Format: Synthesis Review Report (Human Gate 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIST REVIEW REPORT
Verdict: PASS / CONDITIONAL PASS / FAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECURITY FINDINGS
🔴 Critical: [Finding — plain English explanation — what to do]
🟡 Medium  : [Finding — plain English explanation — what to do]
🟢 Low     : [Finding — plain English explanation — what to do]

PERFORMANCE FINDINGS
[Same format]

ARCHITECTURE FINDINGS
[Same format]

REGRESSION & BLAST-RADIUS (from pipeline/reviews/regression-analysis.md + blast-radius-validation.md)
🔴 Architectural-fault regression : [Finding — the coupling that let one change cascade — what to do]
🟡 Shared-component regression    : [Auto-fixed or surfaced — blast radius — what to do]
🟢 Unlinked / shared-ripple change: [Changed file with no clean task link — confirm intended]

CONFLICTS BETWEEN REVIEWERS
[Any disagreements between security, performance, and architecture — and your recommendation]

VERDICT EXPLANATION
[Why PASS, CONDITIONAL PASS, or FAIL — in plain English]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## Output Format: Final Summary Report (Human Gate 3)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL PIPELINE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPLETED
✅ [Task T-01 — what was done in plain English]
✅ [Task T-02 — what was done in plain English]

SECURITY SIGN-OFF
🔴 Critical findings resolved : [N]
🟡 Medium findings resolved   : [N]
🟢 Low findings resolved      : [N]
⚠️  Accepted risks             : [Any remaining, with explanation of why accepted]

TEST RESULTS
Unit tests        : [X passing / Y total]
Integration tests : [X passing / Y total]
E2E tests         : [X passing / Y total] | 🔴 [N] critical | 🟡 [N] functional | 🟢 [N] non-blocker
Automation Gate   : PASS / CONDITIONAL PASS / FAIL / CI-ONLY
Blast radius      : [N] changed files | [N] valid | [N] unlinked | [N] shared-ripple
Regressions       : [N] COLLATERAL | [N] auto-fixed | [N] SURFACED (architectural / unconfirmed)

TOKEN USAGE (from pipeline/token-usage.md)
Phase 0  Triage                    : haiku  · low    · ~[N]k tokens
Phase 1  Planning (×[N] sprints)   : opus   · max    · ~[N]k tokens
Phase 1  QA Planner                : sonnet · medium · ~[N]k tokens
Phase 2  Decomposition             : opus   · high   · ~[N]k tokens
Phase 3  [T-01: title]             : sonnet · high   · ~[N]k tokens
Phase 3  [T-02: title]             : sonnet · high   · ~[N]k tokens
[repeat one row per task/step from pipeline/token-usage.md]
Phase 4  Security Auditor          : opus   · max    · ~[N]k tokens
Phase 4  Perf / Arch Reviewers     : sonnet · high   · ~[N]k tokens
Phase 5  Tests + Docs + E2E        : sonnet · medium · ~[N]k tokens
Phase 6  Fix cycles (×[N])         : sonnet · high   · ~[N]k tokens
Phase 7  Final Review              : opus   · high   · ~[N]k tokens
──────────────────────────────────────────────────────────────
Total estimate : ~[N]k tokens
  Opus         : ~[N]k tokens
  Sonnet       : ~[N]k tokens
  Haiku        : ~[N]k tokens
Est. cost      : ~$[N]   (estimates only — see session /cost for exact billing)

FINAL RECOMMENDATION
[ ] READY TO MERGE
[ ] READY WITH CONDITIONS: [list conditions]
[ ] NOT READY: [list blockers]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## Output Format: Blast-Radius Validation (pipeline/reviews/blast-radius-validation.md)

Written by the Change-Scope & Blast-Radius Validation step at the Phase 5→6 boundary.

```
BLAST-RADIUS VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base : [base branch / ref the diff is taken against]

| Changed file | Linked task | Classification |
|---|---|---|
| [path] | T-XX | valid |
| [path] | (none) | unlinked |
| [path] | T-XX (+ reaches T-YY, T-ZZ) | shared-ripple |

ESCALATED
- shared-ripple [path] → architecture-reviewer (coupling lens)[ + regression-analyst if regression suspected]
- unlinked [path] → surfaced to user (no declared task)

SUMMARY
Changed files : [N]
valid         : [N]
unlinked      : [N]
shared-ripple : [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Output Format: Regression Analysis Record (pipeline/reviews/regression-analysis.md)

Written by the regression-analyst — one block per COLLATERAL failure analysed (appended, never overwritten in a run). Full per-block format is defined in .claude/agents/regression-analyst.md:

```
REGRESSION ANALYSIS — [failing test name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classification        : COLLATERAL (shared-component regression) | DIRECT (handed back)
Changed component     : [file:line — the common component that changed, and for which task]
Root cause            : [mechanism with file:line evidence — not a guess]
Blast radius          : [every test / flow / module the same change touches]
Is the change correct?: YES | NO | PARTIAL — [reasoning]
Architectural fault?  : YES | NO — [the coupling that let one change cascade, if any]
Action taken          : AUTO-FIXED (re-ran once, now passing) | SURFACED (no auto-fix)
Remediation           : [what was changed inside the common component, OR the
                         decision the user must make if surfaced]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Output Format: PR Description (generated at Gate 3 approval)

The PR description is built entirely from pipeline artifacts before they are deleted. Read each source listed below and assemble the description in this exact structure:

```
## What Was Built

[1–3 sentence plain-English summary of the feature or fix, derived from pipeline/progress.md and the task titles in pipeline/tasks/T-XX.json]

### Tasks completed
- T-01: [title from T-XX.json — one sentence on what it does]
- T-02: [repeat for every task]

---

## How AI Verified This

### Specialist reviews
- **Security Auditor** — [N] critical, [N] medium, [N] low findings. All critical and high resolved. [List any accepted risks verbatim from pipeline/reviews/security-*.md]
- **Performance Reviewer** — [summary from pipeline/reviews/performance-*.md]
- **Architecture Reviewer** — [summary from pipeline/reviews/architecture-*.md]

### Tests
| Suite | Result |
|---|---|
| Unit tests | [X passing / Y total] |
| Integration tests | [X passing / Y total] |
| E2E tests | [X passing / Y total] — 🔴 [N] critical · 🟡 [N] functional · 🟢 [N] non-blocker |
| Automation Gate | PASS / CONDITIONAL PASS / FAIL / CI-ONLY |

---

## How You Can Verify (Manual Test Cases)

[List every 🔴 Critical and 🟡 Functional test case from pipeline/qa-checklist.md as a numbered step-by-step checklist. Include expected outcome for each. Label each with its tier emoji.]

---

## Token Usage

| Phase | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|
[One row per line in pipeline/token-usage.md]

**Total estimate:** ~[N]k tokens · Est. cost: ~$[N]
_(Estimates only — see session /cost for exact billing.)_

---

## Known Limitations & Accepted Risks

[List every accepted risk from pipeline/reviews/ verbatim. If none, write "None — all findings were resolved before approval."]
```

Source mapping (read before deleting pipeline/):
- Tasks list → `pipeline/tasks/T-XX.json` (all files)
- Security findings → `pipeline/reviews/security-*.md`
- Performance findings → `pipeline/reviews/performance-*.md`
- Architecture findings → `pipeline/reviews/architecture-*.md`
- Automation Gate results → `pipeline/reviews/automation-gate.md`
- QA checklist → `pipeline/qa-checklist.md` (Critical + Functional tiers only)
- Token log → `pipeline/token-usage.md`
- Progress/summary → `pipeline/progress.md`

---

## Output Format: PR Delivery Summary (shown in Claude UI after Gate 3 approval)

After the PR is created, display this block in the Claude session. Content is identical to the PR description, presented as a readable chat summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PR CREATED — DELIVERY SUMMARY
PR: [#number] [title]
URL: [GitHub PR URL]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT WAS BUILT
[Same 1–3 sentence summary as PR description]

Tasks:
  ✅ T-01: [title]
  ✅ T-02: [title]
  [repeat]

HOW AI VERIFIED
Security   : [N] critical resolved, [N] medium resolved, [N] accepted risks
Performance: [one-line summary]
Architecture: [one-line summary]
Tests      : unit [X/Y] · integration [X/Y] · E2E [X/Y]
Gate       : PASS / CONDITIONAL PASS / FAIL / CI-ONLY

HOW YOU CAN VERIFY (top manual checks)
[List the 🔴 Critical test cases only — numbered, one per line, concise]
(Full manual test list: see PR description)

TOKEN USAGE
Total  : ~[N]k tokens
  Opus   : ~[N]k
  Sonnet : ~[N]k
  Haiku  : ~[N]k
Est. cost: ~$[N]  (see /cost for exact billing)

KNOWN LIMITATIONS
[One bullet per accepted risk — or "None"]

PIPELINE RETROSPECTIVE (feature-full+ only — omit this block if it did not run)
[One-line synthesis outcome: "No change needed" OR N recommendation(s)]
Full record: docs/pipeline-retros/<date>-<slug>.md

Pipeline working state has been deleted. The permanent record is:
  docs/epics/<slug>.md             (epic delivery doc)
  docs/pipeline-retros/<slug>.md   (pipeline retrospective, if it ran)
  PR #[N]                          (code + description)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## General Rules

1. Never guess on security decisions. If uncertain, stop and ask.
2. Never skip a Human Gate even if the next phase seems obvious (exception: the express lane merges the three gates into one lightweight confirmation — see Human Gate Rules — it never *skips* the human).
3. Always explain decisions in plain English alongside any technical output.
4. If you find something alarming at any phase, surface it immediately. Do not wait for the review phase.
5. Keep pipeline/progress.md updated after every phase, and regenerate the root TODO.md from pipeline/tasks/ at every phase boundary (orchestrator is the sole writer; agents read-only). After each agent delegation, append one row to pipeline/token-usage.md (see Pipeline Token Log).
6. Never delete or overwrite files outside the task scope without explicit user confirmation. Exception: the pipeline/ cleanup after Gate 3 approval is explicitly authorised (see Phase 7).
7. When in doubt about scope, ask. A short clarifying question is always better than a wrong assumption.
