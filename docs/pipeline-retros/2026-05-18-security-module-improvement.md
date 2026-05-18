# Pipeline Retrospective — Security Module Improvement (2026-05-18)

**Run:** VibeSafe security scanner module improvement · feature-full lane · HIGH risk
**Tasks:** T-01..T-05 (all additive, valid scope, no regressions)
**Total token spend:** ~435k

This is the Opus synthesis of three biased retrospective reports
(conservative / medium / aggressive). Recommendations below survive at least
conservative scrutiny or are explicitly flagged for validation. Advisory only —
no agent file or CLAUDE.md is auto-edited.

---

## Fact reconciliation — the Sprint 3 disagreement

The Phase-1 token-log step title reads "×3 sprints", but `pipeline/progress.md`
records "converged at Sprint 2 (score 9/10)". progress.md is the authoritative
phase/state record; the token-log title is a descriptive label, not evidence of
execution. **Resolution: Sprint 3 did NOT run — the convergence early-exit fired
correctly at Sprint 2.** The medium and aggressive agents assumed Sprint 3 ran
based on the title and built their "enforce early-exit" recommendation on a
false premise. The rule already worked as written; the only real gap is
*observability* (the title was misleading), not *behaviour*.

---

## Recommendation set

### R1 — Cap epic-doc-writer output for small additive feature-full runs
All three agents independently flagged this. The epic doc consumed ~87k tokens
on a 5-task additive run. Conservative proposes a length cap (~50k saving, zero
quality risk). Aggressive additionally proposes Haiku/low for small runs —
rejected: the epic doc synthesises tradeoffs and human test cases (reasoning,
not boilerplate), and CLAUDE.md explicitly assigns it Sonnet for that reason.
Adopt the cap, keep the model. Trigger: feature-full run with ≤5 tasks, all
additive scope. Target ~25–35k.
**VERDICT: ADOPT** (cap only; model stays Sonnet)

### R2 — Add explicit inter-sprint checkpoint logging to Phase 1
The early-exit rule is behaviourally correct (R1 reconciliation proves it). The
real defect is that the token-log title said "×3" while only 2 sprints ran,
which is exactly what misled two of three retro agents. The fix is not
mechanical *enforcement* (the rule already enforces itself) but mechanical
*logging*: emit a one-line checkpoint per sprint recording score and
newly-accepted-criticism count, and have the token-log title reflect sprints
actually run. ~25k future saving is a side effect of accuracy, not the goal —
the primary benefit is auditability of the convergence gate.
**VERDICT: ADOPT WITH SCOPE** (logging/observability, not a new enforcement gate)

### R3 — Downgrade mechanical Phase 3 wiring tasks to sonnet/medium
Medium proposes dropping 3 of 5 tasks from sonnet/high to sonnet/medium
(~12–16k). This aligns with the existing Phase-2 `effort_hint` rubric: pure
wiring/registration is mechanical. But the lane fail-safe binds — HIGH risk /
risk_flag work has a sonnet/high floor, and "wiring a security scanner module"
touches the security surface. The downgrade is defensible only per-task where
the contract is provably pure registration (import + array insert + display
metadata) with no logic. Conservative did not endorse a blanket downgrade.
**VERDICT: PENDING VALIDATION** (per-task only, never blanket; lane floor holds)

### R4 — Scope the forced Opus Security Auditor deep-dive to auth/PII/payment
Aggressive proposes restricting the forced deep-dive to auth/PII/payment rather
than all HIGH risk (~50k conditional). **This run is direct counter-evidence:
the Security Auditor found 1 Critical and 1 Medium on a HIGH-risk run with no
auth/PII/payment flag.** Narrowing the trigger would have skipped the pass that
caught a Critical. This directly contradicts the CLAUDE.md security fail-safe
("never use a fast model for security reasoning"; HIGH risk forces the
deep-dive). The token saving is real but the quality risk is a missed Critical.
**VERDICT: REJECT**

### R5 — Skip/Haiku Phase 0 repo exploration when .claude/project/ is current
Aggressive proposes skipping or Haiku-ing repo exploration when project files
are fresh (~18k). The Shared Context Pack already partially addresses cold
re-discovery. Skipping entirely risks stale-context bugs the project files
don't capture (in-flight diffs, recent regressions). A bounded Haiku
"freshness check" that short-circuits full exploration when project files are
recent is the safe middle path — but it needs one validated run before adoption.
**VERDICT: PENDING VALIDATION** (Haiku freshness-gate, not a skip)

### R6 — Skip E2E writer in CI-ONLY environments
Aggressive proposes skipping the E2E writer when the environment is CI-ONLY
(~10k). The E2E tests still run in CI even when the local Automation Gate is
CI-ONLY; skipping authorship would mean they never get written. This trades a
small token saving for a permanent test-coverage hole on a security product.
**VERDICT: REJECT**

---

## Summary

| Rec | Verdict | Est. saving |
|---|---|---|
| R1 epic-doc cap | ADOPT | ~50k |
| R2 sprint checkpoint logging | ADOPT WITH SCOPE | ~25k (incidental) |
| R3 per-task effort downgrade | PENDING VALIDATION | ~12–16k |
| R4 narrow security deep-dive | REJECT | — |
| R5 Haiku repo-exploration gate | PENDING VALIDATION | ~18k |
| R6 skip E2E in CI-ONLY | REJECT | — |

Confident adoptable saving: **~50–75k** (R1 + R2) with zero quality risk. A
further ~30k is available if R3/R5 validate. R4 and R6 are rejected on
security/coverage grounds — this run's Critical finding is the decisive
evidence against R4. Net direction: the pipeline is close to right-sized;
epic-doc verbosity is the one clear waste, and the convergence gate needs
better logging, not stronger enforcement.
