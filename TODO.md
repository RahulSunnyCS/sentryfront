# TODO — Realistic Performance Scoring + Free Passive Data (CrUX + Best-Practices)

> Single-writer mirror maintained by the Lead Orchestrator. Source of truth:
> `pipeline/tasks/T-XX.json` (created at Phase 2). Agents read this, never write it.

**Branch:** claude/enhance-passive-scanning-eBoYx · **Lane:** feature-full · **Risk:** MEDIUM
**Status:** Phase 1 complete (Red Team converged 9/9/9/9) — awaiting HUMAN GATE 1

## High-level task list (from the plan — decomposed into contracts at Phase 2)

- [ ] **PSI/CrUX parser + committed fixture** — extend `lighthouse.ts` to request `best-practices` and parse `loadingExperience` / `originLoadingExperience` (CLS ÷100, INP-not-FID, defensive); commit a real PSI v5 JSON fixture shared by all dependent tasks. Hard timeout bound: `PAGESPEED_TIMEOUT_MS=45000`, `MAX_RETRIES=0`.
- [ ] **Scoring rework** — remove the `performance.ts:33-51` double-penalty; single `×100` in `calculatePerformanceGrade`; remove redundant `×100` at `performance-suggestions.ts:260`; UNAVAILABLE state (grade N/A, score null, `scoreSource:'unavailable'`) instead of F/0.
- [ ] **Persistence threading + back-compat** — thread `scoreSource` + CrUX/field block + best-practices into the existing `performanceMetrics` JSON (no migration); UNAVAILABLE persists a non-empty object carrying `scoreSource:'unavailable'`; reader defaults missing `scoreSource`→'lab'.
- [ ] **Null/0-safety for score consumers** — explicit `=== null/undefined` in `performance-suggestions/route.ts:37`, `performance-section.tsx:104-109`, PDF path, and any other real consumer (no phantom percentile).
- [ ] **P2-07 Real-User Field Experience module** — HIGH + banner only when URL-level `overall_category==='SLOW'` AND labScore≥50; origin-only → INFO; absent field → no finding.
- [ ] **P2-08 Web Best Practices module** — failed best-practices audits → findings (category 'Best Practices'); LH-version tolerant.
- [ ] **P2-01 transparency INFO** — INFO finding when a single LAB CWV is Poor even if blended score decent.
- [ ] **Report UI + i18n** — show lab score + Google real-user verdict + best-practices grade + INP; UNAVAILABLE state; new strings in all 5 message catalogs; back-compat with old/partial persisted blobs.
- [ ] **Tests** — rewrite only penalty-specific assertions in `performance.test.ts` (keep the rest); new tests for parser/bands/INP/CLS÷100/origin fallback/UNAVAILABLE/timeout-bound/XSS; update `scan-worker.test.ts` fixture.
- [ ] **Docs + epic** — README performance section; epic delivery doc.

## Optional recommendations (capped — user decides at Gate 1)
- [ ] R1 short-TTL cache for PSI/CrUX results (cuts quota pressure / UNAVAILABLE frequency)
- [ ] R2 optional desktop strategy alongside mobile (tradeoff: +1 PSI call latency/quota)
- [ ] R3 ops note: set `PAGESPEED_API_KEY` so the shared free quota isn't exhausted
