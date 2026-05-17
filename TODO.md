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

## Accepted recommendations (Gate 1 round 1 — folded into scope)
- [ ] **R1 — short-TTL PSI/CrUX cache** — cache wrapper around the PSI fetch; key includes URL + form-factor + category set; configurable TTL; optional Redis (reuse existing) with bounded in-memory fallback; fail-soft; cache successes only (never cache UNAVAILABLE/errors).
- [ ] **R2 — optional desktop measurement** — second PSI call (desktop) run in PARALLEL with mobile; mobile = headline grade/score + primary CrUX verdict + P2-07; desktop = own labelled score/verdict shown beside it in the performance card; NO averaging; desktop nested under existing `performanceMetrics` JSON (no migration); desktop independently fail-soft and disable-able (mobile-only path stays byte-identical); new i18n keys (Mobile/Desktop) in all 5 catalogs.
- [x] R3 — `PAGESPEED_API_KEY` already configured in the environment (no work).
