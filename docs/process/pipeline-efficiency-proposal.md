# Pipeline Efficiency + Self-Retrospection Proposal

## Context

The compliance-module feature ran the full autonomous pipeline (CLAUDE.md) and
spent ~620k tokens for work whose lean floor was ~300–360k — roughly 2× its
intrinsic difficulty. Goal: cut token cost (priority 1) and wall-clock
(priority 2) **without weakening the security / legal-rigor of the pipeline**.

This document is the agreed recommendation set. The structural changes have
been applied to `CLAUDE.md` and `.claude/agents/` in the same change; this doc
is the durable rationale and the per-complexity analysis behind them.

## Non-negotiable invariant

The pipeline's own rule stands: *never use a fast model for security
reasoning; HIGH risk or any risk_flag always gets a deep Opus security pass.*
Every change below is designed around this, not through it.

## 1. Consolidated senior-software-engineer reviewer (Phase 4)

**What:** one Opus agent reviews security + performance + architecture in a
single pass for every lane up to and including feature-full, replacing the
three separate reviewers. It ends with an explicit
`OPUS DEEP-DIVE: REQUIRED | NOT REQUIRED` verdict.

**Security reconciliation (the guardrail kept):**
- No risk_flag and risk < HIGH → escalation is *discretionary* (agent decides
  from its findings).
- Any risk_flag (auth / PII / payment / public-API / admin / file-upload /
  user-generated-content) **or** HIGH risk → escalation is *forced*, and a
  standalone `security-auditor` Opus/max deep-dive runs — but **scoped to the
  senior agent's findings** (a focused brief, not today's cold full audit).
  This is cheaper than the current always-on cold audit yet preserves the
  fail-safe.
- Very-hard / epic (HIGH **and** ≥3 tags) → the consolidated agent is not
  used; the dedicated specialists run as before.

## 2. 3-bias pipeline retrospective (Phase 7.4)

**What:** after the PR is created and before `pipeline/` is deleted, three
parallel `retrospective-reviewer` instances (conservative / medium /
aggressive change-bias) critique the run itself; Opus synthesises one
recommendation set (or "no change needed"). Persisted to
`docs/pipeline-retros/<date>-<slug>.md` so the learning survives cleanup.
**Advisory only** — never auto-edits the pipeline.

**Lane-gated** to avoid undermining the efficiency it exists to find: runs for
feature-full and above only; skipped for express / bugfix / feature-fast /
MEDIUM.

## 3. Supporting levers

- **Shared context pack** (`pipeline/context-pack.md`): built once after Gate
  1, consumed by every downstream agent — kills repeated cold repo discovery.
- **Decomposition model scaling:** Opus for feature-full; Sonnet for
  feature-fast / bugfix-known (1–3 simple tasks).
- **Shared-module identification** in Phase 2: shared logic becomes its own
  Wave-1 task — prevents the post-hoc shared-component regression class.
- **Mechanical-file batching:** same-pattern low-complexity files in one
  implementor contract; never logic-bearing / API-contract / security files.
- **Targeted tests per task; full suite once at the phase boundary.**
- **Right-size models:** Haiku for pure text/metadata sub-tasks (fail-safe
  still forces sonnet+/opus for code and anything security-touching).
- **Auto-grill: DEFERRED** — parked for later review, not implemented.

## Effect by change × task-complexity tier

| Change | Quality | Time | Token | Low/express | Medium | High (feature-full) | Very-high/epic |
|---|---|---|---|---|---|---|---|
| Senior-SWE agent + escalation | neutral→+ (scoped Opus when it matters) | faster (1 vs 3 agents) | large saving | no Phase 4 → unchanged | win (2→1 agent) | big win; forced-scoped Opus if risk_flag | specialists kept at split |
| Retrospective team (3-bias) | improves pipeline over time | +1 end phase | recurring cost | skipped | skipped | runs | runs |
| Decomposition model scaling | neutral | faster | ~10–20k | n/a | win | unchanged (Opus) | unchanged |
| Shared context pack | + (more context) | faster | 30–60k | trivial | + | + | + (scales up) |
| Up-front shared-module ID | + (less rework) | + | 60–90k + a serial fix cycle | n/a | minor | high | high |
| Mechanical-file batching | neutral | + | 40–60k | n/a (≈1 file) | + | big win | + (mechanical only) |
| Targeted tests; full suite at boundary | neutral (full suite still runs) | large wall-clock | 10–20k | already light | + | + | + |
| Right-size models (Haiku for pure text) | neutral (fail-safe binds code) | + | 10–15k | already Haiku | + | + | + |
| Auto-grill (DEFERRED) | + (fewer rebuilds) | front-loaded cost | bet | off | opt-in | parked | parked |

**Projected:** ~40–45% reduction (~300–360k for an equivalent hard feature),
zero loss of security/legal rigor. Savings concentrate in the High tier where
this run sat; Easy/Medium are already lean and are intentionally left alone —
the levers refine the existing lanes, they never override the Phase-0
fail-safe.

## Where this is implemented

- `CLAUDE.md` — Phase 4 (consolidated reviewer + escalation), Phase 7.4
  (retrospective), Gate-3 `[1] APPROVE` step reorder (retro before cleanup),
  Phase 2 (decomposition scaling + shared-module ID + batching), Shared
  Context Pack section, Model Assignment + Effort table.
- `.claude/agents/senior-software-engineer.md` — new.
- `.claude/agents/retrospective-reviewer.md` — new (spawned ×3 by bias).
- `docs/pipeline-retros/` — durable retrospective record location.
- Unchanged: `security-auditor.md`, `performance-reviewer.md`,
  `architecture-reviewer.md` (kept for the epic split), the Red Team loop,
  the Translator, the three Human Gates.
