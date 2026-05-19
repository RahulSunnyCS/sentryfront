# Pipeline Retrospective — Synthesis

**Run:** VibeSafe comprehensive E2E coverage epic · feature-full / HIGH / 5 tags / epic-split
**Date:** 2026-05-19 · **Est. tokens:** ~1.66M (Opus ~979k 59% · Sonnet ~639k · Haiku ~43k) · **Est. cost:** ~$33
**Method:** 3 biased retrospective reviewers (conservative / medium / aggressive) → Opus synthesis.
**Status: ADVISORY ONLY.** No CLAUDE.md or agent file is edited by this document. A human approves any pipeline change separately.

---

## Tier 1 — Strong consensus, adopt (all 3 biases agree, near-zero cost, no security impact)

### S1. Phase-0 execution-feasibility probe (browser/CDN) → surface CI-ONLY at Gate 1
*(conservative R3 · medium R4 · aggressive R1 — unanimous, HIGH confidence)*
At the end of Phase 0 Triage, run a Haiku/low read-only probe: detect a missing Playwright browser binary and a blocked Playwright CDN. Write `environment_constraints: ["e2e_ci_only"]` into `risk_manifest.json` and add one line to the Gate-1 Plan Report "What Happens Next": *"E2E tests will be authored & reviewed but can only execute in CI (no browser binary in this sandbox)."*
**Why:** the CI-ONLY reality was known by the orchestrator but the user only saw it as 125 red "failures" at Phase 6. This converts an implicit Phase-6 surprise into an explicit Gate-1 consent decision. If the user then rejects CI-ONLY E2E, up to ~40% of run tokens are saved; if they accept, nothing is lost. Read-only, never blocks, security path untouched.

### S2. Phase-0 branch-state hygiene pre-check
*(medium R3 · aggressive R6 · conservative-compatible — unanimous, HIGH confidence)*
At the end of Phase 0, run `git status --porcelain` + `git diff --name-only <base>...HEAD` (Haiku/low). If the branch carries commits/files not on the base, emit a one-paragraph notice so the user can choose the PR base **before** planning, not at Gate 3.
**Why:** ~109 files / 6 prior-run commits surfaced only at Phase-6 blast-radius; the user faced a retroactive PR-scope decision after ~1.6M tokens were already spent on top of a dirty branch. ~1k tokens, read-only, user decides.

### S3. Re-tier the mechanical data-testid sweep (T-06) Opus → Sonnet/high
*(medium R1 · aggressive R2 · conservative no-objection — HIGH confidence)*
T-06 was the single most expensive task (~75k, Opus/high) yet is mechanical: add one static `data-testid` per file + a `selectors.ts` constant, no logic, attribute-only diff. Its one security constraint ("testids are static literals") is a read-once rule, and Phase-4 security-auditor (Opus/max) independently re-reviews every touched security-surface file anyway. Decomposition rule addition: a testid/attribute sweep gets `model_hint: sonnet` **and** the Phase-2 cross-artifact pass produces the per-file insertion-point list so the implementor spends no tokens on discovery.
**Guardrail:** unchanged — Phase-4 Opus security review still covers the same files; if a future sweep includes conditional/auth-gated rendering, revert to Opus.

### S4. Per-sprint Red-Team accept-count logging in progress.md
*(conservative R1 · aggressive R5 · medium O1-compatible — HIGH confidence for the logging only)*
Record one line per sprint: `Sprint N: M accepted criticisms, score X/10 [→ early-exit if 0 & ≥8]`. `sprint_count` was 3 but 5 sprints ran; with no per-sprint record the early-exit rule cannot be audited post-hoc. Zero-cost audit trail. **The sprint-count reduction for test-infra epics is NOT adopted** (medium: 5 sprints proportionate for a HIGH/auth/payment/admin/DAST surface; conservative neutral) — advisory, human review only.

---

## Tier 2 — Adopt for the epic-split lane only (majority, bounded scope)

### S5. Phase-2 (and mid-run) mount-gap / spec↔artifact contradiction audit
*(aggressive R3 adopt-epic-split · medium O2 mid-run re-check · conservative-compatible)*
The T-20 implementor correctly STOPPED **twice** (2 extra Opus launches + 2 user round-trips) because mid-run-added T-20's criteria contradicted already-contracted T-16/T-17 specs (which assert an unauth navbar state) and assumed components the app never mounted. Add to the epic-split Phase-2 pass a Haiku/low structural check: for any task whose criteria assert `data-testid`/component-render, grep the in-scope files to confirm the component is actually mounted; annotate `mount_gaps: [...]` in the task JSON. **And** when the user adds a scope item mid-Phase-3, re-run the cross-artifact check against already-contracted specs *before* delegating. This is the system working as intended (good STOP), but the contradiction is structurally detectable earlier at ~2k tokens vs ~58k + 2 human waits.
**Scope:** epic-split (HIGH + ≥3 tags); optional Sonnet/low variant when `frontend` tag set and test files are in scope. Read-only; the implementor still resolves the gap.

---

## Tier 3 — Advisory / pilot only (single-bias or unresolved tradeoff — human decides, NOT adopted now)

- **S6. Pre-seed Phase-1 constraint-round specialists with a context brief** *(medium R5, MEDIUM confidence)* — pricing-reviewer (~42k) and architecture-reviewer (~54k) ran 2–5× over their effort band, consistent with full cold repo reads (the context-pack is built only *after* Gate 1). Pass a one-directional orchestrator→specialist brief (relevant `.claude/project/` + draft plan) before the constraint round. Est. ~30–48k Sonnet saved on epic-split. **Pilot on the next epic-split run before any rule change**; specialists must still never see each other's memos.
- **S7. Collapse epic-split Phase-4 to consolidated senior-engineer + forced security deep-dive for *test-infrastructure* epics** *(aggressive R4 MEDIUM; conservative explicitly KEEP)* — **NOT adopted.** The dedicated pricing-reviewer caught C3 (hardcoded `$5,000`/`$3.48` in crawlable metadata), a pricing×frontend finding the consolidated pass might miss; conservative shows the ~100k delta bought real signal. Needs a clean "test-infra vs application-logic epic" triage rule before it could ever be safe; the security-auditor Opus/max path is never in scope for removal regardless.
- **S8. QA-Planner bounded delta-refresh Opus→Sonnet/medium** *(conservative R5, advisory)* — ~15k Opus saving, real but small; only when the accepted recommendation adds no new auth/payment/PII surface. Guideline, not a hard rule.

---

## Explicitly keep (reviewers agree these earned their cost)

Bounded Phase-1 Constraint Round (both memos produced traceable downstream constraints incl. C3) · Phase-4.5 bounded fix cycle (3 real conditions fixed, 0 regressions, ~54k) · Wave-1 shared-module decomposition (60/60 valid, 0 shared-ripple — the regression class never materialised) · QA Planner · Phase-5/6 split (independent blast-radius gave Gate-3 its confidence) · the Opus tier for T-01/T-04/T-08/T-09/T-10/T-14/T-19 and the Phase-4 security-auditor Opus/max (auth/payment/admin surfaces — the security fail-safe holds).

## Net
Highest leverage: **S1** (feasibility gate — the single biggest process gap), **S2** (branch hygiene), **S3** (T-06 re-tier), **S5** (mount-gap audit kills the T-20 STOP class). Combined they would have improved user agency at Gate 1 and trimmed an estimated ~110–150k tokens **without weakening any security gate**. The pipeline produced a correct, shippable, security-PASS result; these are efficiency/transparency refinements, not correctness fixes. All items are advisory pending human approval.
