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
  - Wave B ✅ DONE: T-02 (P2-07/P2-08/P2-01-transparency; 606 module tests pass; clamps on untrusted text), T-04 (committed af7db0d)
  - Wave C ✅ DONE: T-06 (scoring rework, UNAVAILABLE, P2-07/08 wired, desktop orchestration, cache; 1132 scanner tests pass; scope clean)
  - Wave D: T-10 ✅ · T-07 ✅ done (route 0-vs-null guard, UNAVAILABLE UI state; 19 tests pass; PDF/print path confirmed already null-safe — no extra consumer) · T-08 ⏳ running
  - T-07 note: shared `src/types/index.ts` PerformanceData widening is T-08's scope (T-07 correctly did not touch it; TS-valid meanwhile). Confirm T-08 widens it.
  - Wave D: T-07 ✅ · T-10 ✅ · T-08 ✅ done (scan-worker UNAVAILABLE persistence fix via `'performanceScore' in scannerResult` + blob-guard; normalizePerformanceMetrics 3-case back-compat w/ 2 fixtures; types/index.ts PerformanceData widened; scope clean; lint clean; its own tests pass)
  - Wave D ✅ DONE (T-07, T-08, T-10 + T-04 flaky-test fix; full suite 1527/0)
  - Wave E ✅ DONE: T-09 (report UI — verbatim CrUX verdict, subordinate desktop, mobile-only slow banner, capString length-cap, NO dangerouslySetInnerHTML, back-compat; +20 tests incl. XSS payloads)
- [x] Phase 3 — COMPLETE. All 10 tasks (T-01..T-10) + T-04 flaky-test fix. Full suite: 92 files, **1547 passed / 10 skipped / 0 failed**, lint clean. Browser visual QA not possible in this env (no dev server) — flagged for human manual test (qa-checklist).
- [x] Phase 4 — Specialist review complete. Security PASS (0/0/3); Performance CONDITIONAL PASS (0/1/2/3); Architecture CONDITIONAL PASS (1/5/5). Synthesis: **CONDITIONAL PASS**. No conflicts. Reports in pipeline/reviews/.
  - Blocking H1: CrUX 3-way shape mismatch → per-metric real-user cards dead in prod (all 3 reviewers).
  - Blocking H2: desktop-ON path can exceed 120s SCAN_TIMEOUT (~38s crawl + 90s 2×PSI).
  - M1: relocate normalizePerformanceMetrics out of scan-worker. M2: strip non-perf arrays before caching.
- [x] HUMAN GATE 2 — **APPROVED** with bounded fix cycle (H1,H2,M1,M2). User capacity Q answered: cache is process-wide 200-cap LRU (constant ~4MB after M2, NOT per-user) → not an infra trigger; real free-tier friction = PSI quota (429/403) + worker concurrency. Levers + triggers to be recorded in epic doc.
- [ ] Phase 4.5 — Bounded fix cycle (sequential, verify between each):
  - FIX-A ✅ H1 DONE & VERIFIED: one canonical CrUXFieldData re-exported from lighthouse.ts (producer); types/index.ts no longer defines a divergent `metrics:Record` shape; core-web-vitals.tsx reads named fields (fd?.lcp/.fcp/.cls/.inp); fixtures corrected to the real persisted shape; new core-web-vitals.test.tsx (12 tests) mounts the real component and proves per-metric cards render. Full suite 1559/0, lint clean. Follow-up note: no real-user TTFB FieldMetricCard though fieldData.ttfb is populated (TTFB shown as lab metric) — minor, epic-doc limitation.
  - FIX-B ✅ H2 DONE & VERIFIED: runLighthouse gained optional `timeoutMs`; desktop-ON passes DESKTOP_PSI_TIMEOUT_MS=25_000 to BOTH calls (default 45_000 when OFF). HONEST bound enforced & pinned: CRAWL_WORST_CASE_MS=53_000 (TLS5k+NAV30k+IDLE8k+PWAman5k+PWAsw5k) + P1_MODULES_ALLOWANCE_MS=10_000 + 2×25_000 + SAFETY 5_000 = 118_000 ≤ 120_000 (2s static slack); single-call 108_000 (12s slack). Regression guards prove 35k & 45k breach; crawler-drift guard pins the 5-component sum. scan-worker hard SCAN_TIMEOUT is the documented runtime backstop for pathological (Playwright→static-fetch) tails. Full suite 1567/0, lint clean.
    - LIMITATION (epic-doc + user awareness): desktop-ON static timing slack is a deliberate ~2s; enabling desktop is viable but margin is slim — if P1 modules grow, revisit DESKTOP_PSI_TIMEOUT_MS. Runtime backstop = graceful TIMEOUT + UNAVAILABLE performance.
  - FIX-C ✅ M2 DONE & VERIFIED: `toPerfOnlyMetrics` applied as the getOrFetch fetcher closure → cached+returned value strips accessibilityViolations/seoIssues/accessibilityScore/seoScore, preserves all perf fields; accessibility.ts/seo.ts call runLighthouse directly (never use this cache → safe); psi-cache doc corrected to ~15 KB/entry → **~3 MB at the 200-cap** (was wrongly ~20KB/~4MB). Full suite 1570/0, lint clean. (User capacity note: cache is now ~3 MB flat, even better than the ~4 MB quoted.)
  - FIX-D ✅ M1 DONE & VERIFIED: new `src/lib/scanner/performance-metrics.ts` owns normalizePerformanceMetrics + buildPerformanceMetricsBlob + PerformanceMetricsBlob; scan-worker.ts & the API route import from it (no re-export shim, no duplicate); import graph acyclic (perf-metrics → scanner/index for ScannerResult only). Full suite 1570/0, lint clean (pure move, count unchanged).
- [x] Phase 4.5 — Bounded fix cycle COMPLETE. All Gate-2 conditions remediated & independently verified (H1 canonical CrUX type + render guard; H2 honest timeout bound; M2 perf-only cache ~3MB; M1 helper relocation). Full suite 1570 passed / 0 failed, lint clean. Synthesis CONDITIONAL-PASS conditions satisfied.
- [ ] Phase 5 — Tests + docs + E2E (in progress)
  - Docs-writer: API-ref correctly deferred (no docs/ API-reference convention exists → Phase 7 epic doc captures the changed /api/v1/scans/[id] shape); no new code comments needed (implementation already thoroughly WHY-commented). README "What's Included" 15→18 edit **REVERTED by orchestrator**: the docs-writer fabricated module names (WAF/CDN/CSP-Injection/XSS-Vector etc.) that don't match the real P1 modules (secrets/sourcemaps/headers/tls/cookies/sensitive-paths/cors/mixed-content/third-party/dns-email/subdomain-takeover/error-disclosure/dev-interfaces/robots-sitemap/cache/client-deps/service-worker/web-manifest). That marketing list was already approximate & is a non-feature section the architecture review accepted as a non-blocking pre-public-marketing follow-up — shipping different invented names under this feature's PR is worse than the accepted stale state. Net docs-writer file changes: NONE. Known limitation stands (tracked for a separate non-feature doc task).
  - e2e-test-writer ✅ DONE & VERIFIED: playwright.config.ts + test:e2e script already existed (correctly not recreated); `e2e/performance-report.spec.ts` (78 tagged tests: 38 @critical/31 @functional/9 @non-blocker; 26 runnable, 52 honestly skipped with layer-appropriate reasons — internal parser/cache/timeout logic stays at the unit layer, Playwright can't intercept server-side fetch, etc.) + `e2e/support/perf-db-seed.ts`. `npx playwright test --list` succeeds (specs valid/discoverable). No source/config modified. Committed.
  - qa-gap test-writer ✅ DONE & VERIFIED: 4 new files (qa-gap-performance: grade-boundary thresholds; qa-gap-p4-05-null-guard; qa-gap-i18n-catalog: 13 keys×5 locales; qa-gap-origin-verdict: URL-vs-origin independence). +21 tests, full suite **1591/0**. Coverage map: all 36 Critical / 29 Functional / 9 Non-blocker mapped — 35/36 Critical COVERED. Committed.
- [x] Phase 5 — COMPLETE (docs resolved; E2E 78 tagged specs; +21 gap tests; C-35 fixed). Full suite **1596 passed / 0 failed**.
- [x] Phase 6 — COMPLETE. Blast-radius: 45 changed files, 45 valid / 0 unlinked / 0 shared-ripple (shared files sequential+scope-verified; T-06→T-08 coupling architecture-ruled sound). Regression triage: suite GREEN 1596/0 → no DIRECT/COLLATERAL, regression-analyst not invoked. Automation Gate: **PASS** (test:e2e ran, 8 passed / 52 skipped / 0 failed; DB-seeded perf specs CI-ONLY in this sandbox; no @critical/@functional/@non-blocker failure). Artifacts in pipeline/reviews/.
- [x] Phase 7 — Epic doc written (docs/epics/realistic-performance-scoring.md, 12 manual test cases); Final Pipeline Report assembled + Translator-passed. Recommendation: READY TO MERGE.
- [ ] HUMAN GATE 3 — presented; awaiting user choice (1 APPROVE / 2 REQUEST CHANGES / 3 REJECT)
  - FIX-E ✅ C-35 DONE & VERIFIED: `MAX_CRUX_CATEGORY_LEN=32` + `capCat` closure in `parseCrUXBlock` caps `overallCategory` & per-metric `category` at the single parse chokepoint (before the truthiness guards); non-strings pass through (null/absent behavior preserved); buildPerformanceMetricsBlob confirmed to pass capped fieldData through verbatim → storage protected. 5 C-35 tests. Full suite 1596/0, lint clean.
  - 🔴 **C-35 REAL BUG FOUND (DIRECT, in-feature)** — agent correctly reported instead of asserting wrong behavior. `parseCrUXBlock` (lighthouse.ts) / `buildPerformanceMetricsBlob` (performance-metrics.ts) store CrUX `overallCategory` + per-metric `category` strings VERBATIM with NO length cap (grep-confirmed: only an unrelated `opportunities.slice(0,10)`). Violates the explicit 🔴 Critical QA case "fail if the full oversized string is stored" and the Red Team P3 hardening ("treat all CrUX/best-practices values as untrusted; cap string lengths"). Real-world severity LOW (source = Google PSI over TLS, not the scanned site; React-escaped downstream so NOT XSS — security-auditor confirmed the chain safe) but a genuine defense-in-depth/storage-hygiene gap vs the agreed design. Fix: cap at the parse chokepoint in `parseCrUXBlock`. Delegated as a bounded DIRECT fix (FIX-E) before Phase 6.
- [ ] Phase 5 — Tests + docs + E2E

### Known limitation (Phase 4 / epic-doc): PDF/print export
- `src/app/[locale]/report/[id]/print/page.tsx` + `print-report.tsx` read only the SCALAR performanceScore (already null-safe — `performanceScore !== null` guard; no crash on UNAVAILABLE) and do NOT surface scoreSource/fieldData/bestPractices/desktop. No regression (scalar behaviour preserved). Rich-data in PDF is a deliberate non-goal of this delivery — candidate follow-up. Flag for Phase 4 architecture review + epic doc limitations.

### Full-suite status
- After T-08: 1526 passed / **1 failed** (`psi-cache.test.ts:173` flaky real-time TTL).
- After deterministic TTL fix (fake timers + env restore, scoped to the TTL describe blocks): **`npm run test` → 92 files, 1527 passed / 10 skipped / 0 failed** (independently re-verified by orchestrator). Phase 3 implementation is green end-to-end except T-09 (UI, not yet run).
  - Note: README "What's Included" numbered module list still says 15 (separate section, out of T-10 scope) — follow-up for Phase 5 docs-writer / epic doc.

### Cross-task notes from T-06 (carry to T-08 / Phase 4)
- PerformanceResult (defined in performance.ts) now exposes: `performanceScore` (0-100 int | null), `performanceGrade` ('A'..'F' | 'N/A'), `scoreSource` ('lab'|'unavailable'), `fieldDataVerdict`, `fieldData`, `bestPracticesScore`/`bestPracticesGrade`, optional `desktop: FormFactorResult`, `moduleFindingCounts`. T-08 must thread ALL of these into ScannerResult + the `performanceMetrics` JSON blob + API route + PerformanceData type, and ensure the UNAVAILABLE path persists a non-empty object carrying `scoreSource:'unavailable'`.
- `result.metrics.performanceScore` is intentionally still 0-1 (modules need it). Only `result.performanceScore` is 0-100. T-08/T-09 must read the 0-100 from `performanceScore`, NOT recompute from metrics.
- T-06 skips desktop on ANY mobile UNAVAILABLE (incl. timeout), not only 429/403 — deliberate, safer for SCAN_TIMEOUT budget. Flag for Phase 4 architecture review as an intentional, documented deviation.

### Cross-task notes from T-02 (carry to T-06 / Phase 4)
- P2-07 also emits INFO for URL-level AVERAGE and for "URL SLOW but lab<50" (additive transparency beyond the strict HIGH/origin-INFO/absent-none contract). Acceptable (additive INFO on real URL-level data, not "no data" noise) — flag for Phase 4 architecture review as a minor scope nuance.
- Lab-score threshold: `performanceScore` is 0–1; P2-07 treats `>=0.5` as "lab >= 50". T-06 MUST keep performanceScore as 0–1 out of the scanner and apply `×100` ONLY in calculatePerformanceGrade (per plan), or P2-07's predicate desyncs.

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
