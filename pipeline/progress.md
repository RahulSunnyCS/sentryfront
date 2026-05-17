# Pipeline Progress

**Feature:** Realistic performance scoring + free passive data sources (CrUX field data + PSI best-practices)
**Branch:** claude/enhance-passive-scanning-eBoYx
**Lane:** feature-full · **Risk:** MEDIUM · **Gates:** 3 · **Sprints:** 3
**Effort:** default per CLAUDE.md effort table (Planning = Opus/max)
**recommendation_rounds_used:** 1  (Gate 1 round 1 — user accepted R1 + R2; R3 already done in env, not counted)

## Gate 1 — user responses (round 1)

- Scoring approach → **recommended** approach approved (Lighthouse-accurate headline + Google's verbatim real-user verdict beside it; no blended number).
- R1 (short-TTL PSI/CrUX cache) → **accepted** — fold in.
- R2 (optional desktop measurement) → **accepted** — fold in, with form-factor model: **mobile = headline grade/score; desktop shown beside it in the performance card; NO averaging** (each score independently verifiable vs PageSpeed Insights; mobile-first preserves grade continuity).
- R3 (PAGESPEED_API_KEY) → already configured in the user's environment; no work, not counted against the cap.

Re-plan round 1 of 2: focused Red Team on the R1+R2 delta (base plan already converged 9/9/9/9 and is unchanged). Delta converged post-incorporation (~8.5 all axes; all "revise before proceeding" findings closed with concrete fixes).

### Converged delta design (R1 + R2)

**R2 — desktop measurement (mobile headline + desktop beside):**
- Desktop is **opt-in, default OFF** — a real `features.ts` frozen-flag (`getFeatureStatus()`-observable). When OFF: byte-identical to today's mobile-only path.
- When ON: run mobile first; if mobile is UNAVAILABLE due to 429/403 (rate-limit/quota) → **skip desktop** (quota-aware). Otherwise run desktop. Each call independently fail-soft via `Promise.allSettled` semantics — a cache-wrapper throw maps to emptyMetrics per form factor and can never collapse the other (explicit test).
- Timing: when desktop ON, two sequential PSI calls; per-call timeout tightened for the dual case so total PSI wall ≤ ~80s leaving ≥40s crawl/overhead headroom under SCAN_TIMEOUT=120000 (hard timing-bound test). Desktop OFF = single 45s call (base plan).
- Mobile = headline grade/score + the ONLY CrUX real-user verdict that drives the P2-07 HIGH finding/banner and the grade. Desktop = its own labelled score + Google CrUX verdict rendered **visually subordinate + disclaimed** "informational — headline grade is mobile (matches Google PageSpeed default)"; NO desktop banner / HIGH / grade-drive. NO averaging.
- Persistence: desktop nested under existing `performanceMetrics` JSON (`performanceMetrics.desktop`); mobile stays top-level → back-compat, no migration. Old scans (no desktop block) render mobile-only, no crash.

**R1 — short-TTL PSI cache:**
- **In-memory LRU only** (Redis deferred — near-zero cross-instance hit rate for a distinct-URL scanner). Hard **entry-count cap = 200** with LRU eviction; test inserts 10k distinct keys, asserts size ≤ 200 (memory-DoS guard).
- Key = `normalized(targetUrl) + strategy(mobile|desktop)` only (category set is invariant — code comment, not a key field). Cap key length; skip caching over-long normalized URLs.
- TTL default **300000 (5 min)**, env `PSI_CACHE_TTL_MS`. **Force-refresh**: an explicit user-initiated re-scan bypasses the cache. UI i18n string discloses "performance data may be cached up to ~5 min" (all 5 catalogs).
- Fail-soft: any cache get/set error → proceed to live PSI, never throw. **Cache successful responses only** — never cache UNAVAILABLE / 4xx / 5xx / timeout (so rate-limit recovery is not hidden).
- Security: per-URL key ⇒ an attacker can only affect their own URL's entry (cache poisoning is not a risk — documented & explicitly cleared by Red Team P4); no new SSRF/secret/privacy surface (same PSI call; cache holds already-public parsed metrics, not the API key). security-auditor confirms in Phase 4.

**Phase 2 decomposition note:** R1 (cache) and R2 (desktop) are separate task contracts with dependency edges: base PSI parser task → T-cache (R1) → T-desktop (R2). No shared-file write conflicts.

## User intent (Phase 0.5 — captured via clarifying questions)

1. Score model → "Lighthouse-accurate + fix the double-penalty bug, AND blend in real-user field data when available".
2. Extra passive sources → Google CrUX field data + PSI 'best-practices' category (both free, same API call, no new vendor/egress). Independent synthetic vendor explicitly NOT chosen.
3. Scope → Broader overhaul (feature-full lane).

## Phase status

- [x] Phase 0 — Triage (risk_manifest.json written)
- [x] Phase 0.5 — Intent extraction (3 clarifying questions answered)
- [x] Pre-plan research — performance subsystem + downstream path mapped (2 Explore agents)
- [x] Phase 1 — Planning + Red Team loop (3 sprints, converged) — internal score 9/9/9/9 (Completeness/Security/Feasibility/Clarity)
- [x] Phase 1 — QA Planner (qa-checklist.md: 🔴17 / 🟡21 / 🟢6)
- [x] Phase 1 — Translator pass on Plan Report
- [x] HUMAN GATE 1 — **APPROVED** (round 1; recommended scoring approved, R1+R2 folded in)
- [x] Phase 2 — Decomposition (10 task contracts T-01..T-10; T-09 depends on T-07 for shared performance-section.tsx)
- [ ] Phase 3 — Parallel implementation
  - Wave A ✅ DONE: T-01 (47 tests pass, +amendment: performanceScore `?? null` so 0 survives), T-03 (committed 92d2caa), T-05 (13 keys × 5 catalogs, parity verified)
  - Wave B: T-04 ✅ done (psi-cache.ts, 35 tests pass, lint clean) · T-02 ⏳ running

### Cross-task caveats from T-01 (carry downstream)
- CrUX `distributions` for CLS are also scaled ×100 and forwarded verbatim; any consumer reading `distributions` for CLS must ÷100 (relevant to T-02 P2-07 and T-09 UI — pass into their prompts).
- `accessibilityScore`/`seoScore` still use `|| null` (pre-existing, deliberately out of T-01 scope) — a genuine 0 there still coerces to null. Note for Phase 4 architecture review as a non-blocking known follow-up.
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
