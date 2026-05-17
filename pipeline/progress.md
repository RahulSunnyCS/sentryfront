# Pipeline Progress

**Feature:** Realistic performance scoring + free passive data sources (CrUX field data + PSI best-practices)
**Branch:** claude/enhance-passive-scanning-eBoYx
**Lane:** feature-full · **Risk:** MEDIUM · **Gates:** 3 · **Sprints:** 3
**Effort:** default per CLAUDE.md effort table (Planning = Opus/max)
**recommendation_rounds_used:** 0

## User intent (Phase 0.5 — captured via clarifying questions)

1. Score model → "Lighthouse-accurate + fix the double-penalty bug, AND blend in real-user field data when available".
2. Extra passive sources → Google CrUX field data + PSI 'best-practices' category (both free, same API call, no new vendor/egress). Independent synthetic vendor explicitly NOT chosen.
3. Scope → Broader overhaul (feature-full lane).

## Phase status

- [x] Phase 0 — Triage (risk_manifest.json written)
- [x] Phase 0.5 — Intent extraction (3 clarifying questions answered)
- [x] Pre-plan research — performance subsystem + downstream path mapped (2 Explore agents)
- [x] Phase 1 — Planning + Red Team loop (3 sprints, converged) — internal score 9/9/9/9 (Completeness/Security/Feasibility/Clarity)
- [ ] Phase 1 — QA Planner + Translator (in progress)
- [ ] HUMAN GATE 1
- [ ] Phase 2 — Decomposition
- [ ] Phase 3 — Parallel implementation
- [ ] Phase 4 — Specialist review (security + performance + architecture) + Translator
- [ ] HUMAN GATE 2
- [ ] Phase 5 — Tests + docs + E2E
- [ ] Phase 6 — Test execution loop + blast-radius + regression triage
- [ ] Phase 7 — Final review + epic doc + Translator
- [ ] HUMAN GATE 3

## Key technical findings (grounding the plan)

- **Double-penalty bug:** `src/lib/scanner/modules/performance.ts:33-51` uses Google's already-weighted `categories.performance.score` as the base, then subtracts ad-hoc LCP/CLS penalties again — double-counting LCP/CLS. Root cause of unrealistically low scores.
- **CrUX field data unused:** `src/lib/scanner/lighthouse.ts` parses only `data.lighthouseResult`; `data.loadingExperience` (URL-level CrUX) and `data.originLoadingExperience` (origin-level CrUX) — real-user p75 data already in the response — are discarded.
- **Best-practices not requested:** lighthouse.ts requests `performance`, `accessibility`, `seo` but not `best-practices` (the file's own header comment references it as "Phase 9.5").
- **No migration needed:** `Scan.performanceMetrics` is a JSON-string column (`prisma/schema.prisma`); new keys flow through `scan-worker.ts` → API route → report UI without a schema change.
- **API failure today returns grade F / score 0** — itself an "unrealistic" value (penalises the user for Google's rate limit). Candidate to change to an explicit "not scored / unavailable" state.
- **Test blast radius:** `performance.test.ts` (asserts the OLD penalty model — must be rewritten to the new model), `scan-worker.test.ts` fixture, `scanner-index.test.ts`, `lighthouse.test.ts`, plus new module/UI tests.

## Final plan (post Red Team, converged)

**Design decision (orchestrator-made, Red Team-backed):** Do NOT invent a blended numeric score. Headline number = Lighthouse-accurate lab score (matches pagespeed.web.dev once the double-penalty is removed). Real-user truth = Google's verbatim CrUX verdict shown alongside, and a HIGH finding/banner when real users are SLOW. A single opaque blended digit is a *rejected alternative* (it cannot match any external tool and reintroduces opaque math) — surfaced honestly at Gate 1, not offered as a symmetric menu.

Key locked specifics:
- Single `×100` only in `calculatePerformanceGrade`; remove redundant `×100` at `performance-suggestions.ts:260`; `performanceScore` persisted as 0-100 integer; `0.0` lab → integer `0`, not null.
- `scoreSource` ('lab' | 'unavailable'), CrUX/field block, `bestPracticesGrade/Score` all stored INSIDE the existing `performanceMetrics` JSON — **no Prisma migration**. UNAVAILABLE path must persist a NON-empty `performanceMetrics` object containing `scoreSource:'unavailable'` (closes the scan-worker.ts:175-vs-176 spread-guard coupling).
- PSI failure → explicit UNAVAILABLE (grade 'N/A', score null), never F/0. All real `performanceScore` consumers made `=== null/undefined`-safe (`performance-suggestions/route.ts:37`, `performance-section.tsx:104-109`). Phantom "better than X% percentile" removed (does not exist).
- PSI multi-category call: `PAGESPEED_TIMEOUT_MS=45000`, `MAX_RETRIES=0` (was 60000/1) — worst case ≤45s ≪ 120s SCAN_TIMEOUT; hard timing-bound test; fail-soft preserved. Tradeoff: UNAVAILABLE frequency may rise (explicit & safe — strictly better than silent F/0).
- One field verdict only: Google's verbatim PSI `loadingExperience.overall_category` + per-metric `category`/p75; no self-computed Good/NI/Poor bucket. CLS percentile ÷100 (test 10→0.10). Absent INP handled; never substitute FID. `originLoadingExperience` = context only, never headline/HIGH.
- P2-07 HIGH+banner ONLY when URL-level `overall_category==='SLOW'` AND labScore≥50; origin-only → INFO max; absent field → no finding.
- P2-08 best-practices module (category 'Best Practices'); tolerant of LH-version-missing audits; no `no-vulnerable-libraries`.
- P2-01 INFO when a single LAB CWV is Poor even if blended score decent.
- Parser+CrUX/best-practices validated against ONE COMMITTED real PSI v5 fixture (shared by parser/P2-07/P2-08/UNAVAILABLE tests; live capture quota-blocked → implementor must obtain & commit).
- Security: new CrUX/best-practices strings length-capped, React auto-escape only, no `dangerouslySetInnerHTML` in report or Playwright PDF path; explicit XSS test; security-auditor verifies Phase 4.
- i18n: new keys in all 5 catalogs (en/hi/ml/es/de). SCAN_MODULES stays P1-only.

**Optional recommendations (AI-suggested, capped — round 1 of 2):** see Plan Report.
