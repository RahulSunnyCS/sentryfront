ARCHITECTURE REVIEW REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature: Realistic performance scoring + CrUX + best-practices + PSI cache + optional desktop
Lens: Frontend + Backend (risk_manifest.tags = backend, frontend, product)
Effort: High

━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING: CrUX field data shape mismatch — field metric cards silently never render
Severity: High
File or area: src/lib/scanner/lighthouse.ts:61-74 (producer) vs src/types/index.ts:21-26 (consumer contract) vs src/components/core-web-vitals.tsx:270-279 (consumer)
What it is:
  The backend produces CrUXFieldData with named properties: { overallCategory, lcp, inp, cls, fcp, ttfb }.
  The public type in src/types/index.ts defines CrUXFieldData as: { overallCategory?, metrics?: Record<string, CrUXMetric> }.
  The CoreWebVitals component accesses field data via `metrics.fieldData?.metrics?.['LARGEST_CONTENTFUL_PAINT_MS']` — the Record-keyed path.
  Since the stored JSON has .lcp / .inp / .cls etc. (not a .metrics sub-object), fieldMetrics is always null at runtime, and all FieldMetricCard elements are unconditionally suppressed.
  The tests in src/__tests__/components/performance-section.test.tsx use the types/index.ts shape (with the metrics: Record<> sub-object), not the lighthouse.ts shape, so the test suite passes without exercising the real data path.
Why it matters:
  The entire "real user (CrUX) p75" section of the report UI — every FieldMetricCard — is dead code in production.
  Real-user per-metric verdicts (LCP p75 FAST/AVERAGE/SLOW, FCP p75, CLS p75, INP p75) never appear on any scan report regardless of whether CrUX data was returned.
  Users and operators cannot diagnose the lab-vs-field gap at the metric level. The banner and overallCategory verdict chip are still correct (they consume fieldDataVerdict/overallCategory from the top-level blob), so the HIGH finding and badge appear, but the supporting evidence never does.
Recommendation:
  Unify behind one shape. The simplest fix: update types/index.ts CrUXFieldData to match the lighthouse.ts definition (named lcp/inp/cls/fcp/ttfb fields), then update CoreWebVitals to read `metrics.fieldData?.lcp?.percentile` etc. directly. Add a CoreWebVitals integration test that mounts the component with a fieldData object shaped exactly as the stored JSON (named fields, not the Record form). The existing performance-section test fixtures should also be updated to use the canonical shape.

---

FINDING: normalizePerformanceMetrics imported into the API route from scan-worker.ts
Severity: Medium
File or area: src/app/api/v1/scans/[id]/route.ts:6 imports from src/lib/scan-worker.ts
What it is:
  The API route imports normalizePerformanceMetrics directly from the scan-worker module. scan-worker.ts is a worker-orchestration module: it owns the scan lifecycle, Prisma writes, event publishing, and timeout logic. normalizePerformanceMetrics is a pure, side-effect-free parse helper with no dependency on any worker concern.
Why it matters:
  Any developer reading the import will reasonably infer that the API route depends on worker execution state — not just a JSON normalisation function. This creates a confusing module boundary. If scan-worker.ts grows (timeout changes, new worker logic), the API route carries an invisible coupling to it. An extraction to a dedicated data-layer module (e.g. lib/scanner/performance-metrics.ts or lib/performance-types.ts) would make the dependency graph reflect what is actually happening: a route-level read needs a parse helper, nothing more. The normalizePerformanceMetrics and PerformanceMetricsBlob should live in a module focused on the data shape, imported by both scan-worker.ts and the route.
Recommendation:
  Move normalizePerformanceMetrics and PerformanceMetricsBlob (plus buildPerformanceMetricsBlob) to a new file such as src/lib/scanner/performance-metrics.ts. Have scan-worker.ts and the API route both import from there. This is a pure refactor with no behavioural change.

---

FINDING: CrUXFieldData and CrUXMetric defined twice with divergent schemas
Severity: Medium
File or area: src/lib/scanner/lighthouse.ts:38-74 vs src/types/index.ts:12-26
What it is:
  Two separate CrUXFieldData / CrUXMetric interfaces exist in the codebase with incompatible shapes. lighthouse.ts defines a typed, named-field structure (lcp, inp, cls, fcp, ttfb, each typed as CrUXMetric | null with percentile/category/distributions). types/index.ts defines a looser shape (metrics?: Record<string, CrUXMetric> where CrUXMetric itself is different: category?: string, histogram?, percentile?). The root cause of the field-card rendering bug (see above) is exactly this divergence. The scan-worker.ts deliberately annotates the stored fieldData as `unknown | null` to avoid the mismatch surfacing as a compile error — which means TypeScript silently passes the wrong shape all the way to the UI.
Why it matters:
  When a type is defined twice with different shapes, it is only a matter of time before a developer writes code against one definition that must consume data produced by the other. The `unknown` type in PerformanceMetricsBlob.fieldData hides this at compile time. The correct shape is lighthouse.ts — it faithfully mirrors the PSI v5 response and has the richer model. The types/index.ts version is wrong.
Recommendation:
  Delete CrUXFieldData and CrUXMetric from src/types/index.ts and re-export them from src/lib/scanner/lighthouse.ts (or a shared src/lib/scanner/types.ts if you prefer to keep scanner internals separate from the public client-side type file). Update PerformanceMetricsBlob.fieldData from `unknown | null` to `CrUXFieldData | null`.

---

FINDING: DesktopPerformanceData duplicated with a field type divergence
Severity: Medium
File or area: src/lib/scanner/index.ts:37-49 vs src/types/index.ts:33-45
What it is:
  DesktopPerformanceData is declared in both scanner/index.ts (where metrics.opportunities is typed as ParsedAudit[]) and types/index.ts (where it is opportunities?: unknown[]). The two definitions are otherwise structurally identical.
Why it matters:
  The scanner exports its own DesktopPerformanceData for the internal ScannerResult; the public API consumer uses the types/index.ts version. Because PerformanceMetricsBlob stores desktop typed as an inline struct (also partially different), there are now three definitions describing the same shape. Any change to the desktop sub-object must be replicated manually in all three places. The types/index.ts version erasing ParsedAudit to unknown[] also means type-safe consumption of opportunities in a future UI component is impossible without a cast.
Recommendation:
  Consolidate to a single canonical DesktopPerformanceData. The natural owner is either src/types/index.ts (if the type is purely the public API surface) or src/lib/scanner/types.ts (if it needs ParsedAudit). Remove the duplicate, import from the canonical location everywhere.

---

FINDING: performance.ts has three emptyMetrics literal declarations
Severity: Medium
File or area: src/lib/scanner/modules/performance.ts:243-261 (in fetchPsi), :429-447 (in the catch block), and src/lib/scanner/lighthouse.ts:219-237 (in runLighthouse)
What it is:
  The zero-value LighthouseMetrics constant is spelled out in full three times: once in lighthouse.ts and twice in performance.ts. Each spelling is 18 fields long. The two spellings in performance.ts are identical to each other and identical to the one in lighthouse.ts.
Why it matters:
  When a new optional field is added to LighthouseMetrics (as happened with this feature — bestPracticesScore, fieldData, originFieldData), all three spellings must be updated. Missing one produces a silent partial-metrics object that can reach downstream consumers. The progress.md notes specifically that lighthouse.ts emptyMetrics was required to have ALL new optional fields populated — a comment-only contract that three copy-paste spellings cannot reliably enforce.
Recommendation:
  Export a single EMPTY_LIGHTHOUSE_METRICS constant from lighthouse.ts and import it wherever the zero-value is needed. TypeScript will then enforce completeness: a missing field is a compile error on the constant, not a runtime surprise at each call site.

---

FINDING: bypassCache parameter is a documented seam with no upstream wiring
Severity: Medium
File or area: src/lib/scanner/modules/performance.ts:301-305 (runPerformanceModules signature), src/lib/scanner/index.ts:178 (call site)
What it is:
  runPerformanceModules accepts a bypassCache parameter (default false) with an explicit JSDoc comment: "Threading the actual user re-scan signal into this param is a downstream concern (T-08/scan-worker)." T-08 is delivered but bypassCache is never passed at either call site in scanner/index.ts or scan-worker.ts. The seam exists but is unused.
Why it matters:
  The cache is live and serving results by default. A user who re-scans a URL expecting fresh data within the 5-minute TTL will receive a cached score, with no way to force a refresh. The UI discloses the cache via the i18n note but provides no user-initiated bypass. This is a gap between the planned capability (documented) and the delivered experience (no bypass path). The seam is correctly designed; only the wiring is missing.
Recommendation:
  Acceptable as a known downstream item IF it is tracked as a follow-up task with a target milestone. The design (bypassCache parameter) is correct and the seam is in the right place. The gap to close: pass bypassCache=true when the scan was explicitly requested by the user (e.g. via a re-scan button or POST /api/v1/scans creating a new scan for an already-cached URL). Consider adding an X-Bypass-Cache or rescan flag to the scan creation API and threading it through runScanner → runPerformanceModules.

---

FINDING: scoreSource === undefined used as the "performance feature ran" signal
Severity: Low
File or area: src/lib/scan-worker.ts:151 (buildPerformanceMetricsBlob), src/lib/scanner/index.ts:261-295 (spread guard)
What it is:
  Whether the performance feature ran is inferred from `scannerResult.scoreSource === undefined` (absent = did not run). This is an implicit negative contract: the absence of a field signals a state, rather than an explicit boolean.
Why it matters:
  The contract is internally consistent and well-commented. However, it is a fragile contract: if scoreSource were ever set to undefined by a bug (rather than left absent), the feature would be silently treated as "not run" and the metrics blob would not be persisted. A future developer adding a third possible scoreSource value (e.g. 'degraded') would need to understand this implicit check. An explicit ScannerResult.performanceRan boolean, or checking for a non-undefined discriminant, would be easier to reason about.
Recommendation:
  Low priority: the current contract holds because the UNAVAILABLE path always writes scoreSource: 'unavailable' (never undefined). Document the invariant explicitly in the ScannerResult interface — "undefined means feature disabled; 'lab' or 'unavailable' means feature ran" — and add a guard comment at buildPerformanceMetricsBlob. If the shape ever gains a third scoreSource value, switch to an explicit ran: boolean field.

---

FINDING: capString duplicated in both performance-section.tsx and core-web-vitals.tsx
Severity: Low
File or area: src/components/performance-section.tsx:34-37, src/components/core-web-vitals.tsx:28-31
What it is:
  The same capString utility function (identical implementation, identical MAX_STRING_LEN=64) is defined independently in two sibling components.
Why it matters:
  If the cap length changes (e.g. different max needed for a specific field) or the function's behaviour evolves, it must be updated in two places. Minor now; grows as a pattern if more components are added.
Recommendation:
  Extract to a shared utility, e.g. src/lib/sanitize.ts or a components/utils.ts, and import from both components.

---

FINDING: README "What's Included" numbered list is stale
Severity: Low
File or area: README.md:122-136
What it is:
  The "What's Included" numbered list still contains 15 items with stale descriptions (references Nuclei, WAF Detection, CDN Detection — none of these are in the actual scanner). The feature header line at line 14 correctly says 18 Security Modules, but the numbered list is inaccurate and no entry mentions CrUX, best practices, or the new P2 modules.
Why it matters:
  New contributors and potential users reading the README will get a materially incorrect picture of the scanner's capabilities. Acceptable as a known documentation gap but should be remediated before any public release announcement.
Recommendation:
  Rewrite the numbered list to accurately reflect the 18 P1 modules and 8 P2 modules, with brief accurate descriptions. The T-10 README update covered the performance section; the numbered module list was noted as out of T-10 scope in progress.md — this is the correct follow-up item.

---

FINDING: performance.ts line count and integration surface (~466 lines)
Severity: Low
File or area: src/lib/scanner/modules/performance.ts
What it is:
  performance.ts has grown into an integration hub: it owns the PSI fetch wrapper (fetchPsi), URL normalisation (normalizeUrlForCacheKey), desktop orchestration logic, grade/score calculation helpers, best-practices grading, CrUX verdict extraction, module fan-out (8 sub-modules), and the top-level error-catch path. It also has a local emptyMetrics literal in two places (see above). At ~466 lines it is approaching the boundary of comfortable single-file readability.
Why it matters:
  The module is not yet a god-module: its concerns are cohesive (all relate to orchestrating one PSI-based performance run) and the internal functions are well-separated. However, if desktop support is ever extended (e.g. adding a third form factor, or making per-metric orchestration configurable), the file will grow further. The PSI fetch wrapper (fetchPsi + normalizeUrlForCacheKey) is the most natural extraction candidate because it has a clear interface boundary and no dependency on the scoring/grading helpers.
Recommendation:
  No immediate action required. If a future change adds significant new orchestration logic (e.g. a third form factor, per-metric retry, or async fan-out of sub-modules), extract fetchPsi + normalizeUrlForCacheKey to a dedicated psi-fetch.ts or fold normalizeUrlForCacheKey into psi-cache.ts (which already owns key construction). Monitor line count at the next feature boundary.

---

FINDING: ALL_MODULES progress-event list is stale (15 entries, 18 actual modules)
Severity: Low
File or area: src/lib/scan-worker.ts:20-24
What it is:
  ALL_MODULES is hardcoded to P1-01 through P1-15. There are 18 actual P1 modules (P1-16 through P1-18 are service-worker and web-manifest). emitPlaceholderProgress only fires placeholder events for the first 15 modules; P1-16, P1-17, P1-18 have no placeholder event. This is a pre-existing issue not introduced by this feature but not repaired by T-10 either.
Why it matters:
  The UI progress bar during scanning is based on these placeholder events. Missing three events makes the progress bar slightly inaccurate (counts and progress may look asymmetric). Does not break functionality.
Recommendation:
  Update ALL_MODULES to include P1-16, P1-17, P1-18 and add matching entries to PLACEHOLDER_MODULE_DELAYS_MS.

---

FINDING: performance-suggestions.ts accepts LighthouseMetrics but receives PerformanceMetricsBlob at runtime
Severity: Low
File or area: src/app/api/v1/scans/[id]/performance-suggestions/route.ts:57, src/lib/scanner/performance-suggestions.ts:83
What it is:
  The performance-suggestions route passes the result of JSON.parse(scan.performanceMetrics) directly to generateImprovementPlan as type LighthouseMetrics. The actual stored object is a PerformanceMetricsBlob, which does not contain performanceScore, accessibilityScore, seoScore, opportunities (typed as unknown[] not ParsedAudit[]), or the new T-08 fields. The function only reads lcp, fcp, cls, tbt, ttfb, opportunities — all of which happen to exist in both types — so there is no runtime crash. But the type annotation is wrong and TypeScript cannot enforce the contract.
Why it matters:
  A developer maintaining generateImprovementPlan might add logic that reads metrics.performanceScore (0-1 from LighthouseMetrics) for a new condition. That would silently receive undefined because the blob does not carry that field. The `as LighthouseMetrics` cast at the call site would prevent the compiler from catching it.
Recommendation:
  Change generateImprovementPlan's metrics parameter type to PerformanceMetricsBlob (or a minimal Pick of the fields it actually reads: { lcp, fcp, cls, tbt, ttfb, opportunities }). This is a one-line type change in performance-suggestions.ts and removes the implicit mismatch.

---

KNOWN ITEMS — explicit calls

1. T-06→T-08 cross-file shape change and intermediate broken state:
   ACCEPTABLE. The decomposition forced performance.ts to produce a wider PerformanceResult before scan-worker.ts was updated to consume it. This intermediate state (803e447) was acknowledged in the plan and is the expected consequence of correct task ordering when shared-file writes are prohibited within a parallel wave. The final coupling is sound: PerformanceResult → ScannerResult spread → buildPerformanceMetricsBlob → Prisma → API normalisation forms a clean, one-directional data flow. There is no circular coupling. The known items above (type duplication, mis-typed LighthouseMetrics parameter) are cosmetic; the data itself flows correctly.

2. normalizePerformanceMetrics in scan-worker.ts imported by the API route:
   MUST-FIX (Medium). The function belongs in a scanner-level data module, not in the worker orchestrator. See the finding above.

3. bypassCache param not yet wired to a user re-scan signal:
   ACCEPTABLE with tracking. The seam is correct and documented. The cache is live and will serve stale results within the TTL if a user triggers a new scan of a recently-scanned URL. This is an incomplete capability, not a correctness bug. It must be tracked as a follow-up before declaring the feature complete for users who expect re-scan to be fresh.

4. scoreSource === undefined as "feature ran" signal:
   ACCEPTABLE. The contract is internally consistent, well-commented, and upheld by all write paths. A future enhancement to add explicit documentation to the interface type would be welcome but is not urgent.

5. PDF/print path renders only the scalar score:
   ACCEPTABLE as a known limitation for this delivery. The print path is null-safe (no crash on UNAVAILABLE), and the limitation is explicitly called out in progress.md. The rich CrUX/best-practices/desktop data in PDF is a documented follow-up.

6. Hardcoded English strings in performance-section.tsx:
   ACCEPTABLE with tracking. This is a pre-existing pattern across the codebase (not introduced by this feature). The strings are in the non-dynamic performance description copy ("Excellent performance! Your site loads fast..."). They are not user-facing data strings; they are editorial copy. They should be extracted to the i18n catalogs before any non-English locale release of the performance report section, which is a documented follow-up (T-09 progress note).

7. README "What's Included" still lists 15 modules:
   ACCEPTABLE for internal builds; MUST-FIX before external marketing or public documentation. See finding above.

━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY
High  : 1
Medium: 5
Low   : 5

VERDICT: CONDITIONAL PASS

The feature is architecturally sound in its core data flow and module decomposition. The PSI cache module has a clean, swappable API. The desktop-as-subordinate invariant is correctly enforced at every layer. The scoring contract (single ×100 in calculatePerformanceGrade) is sound and well-documented. The UNAVAILABLE path is handled consistently.

The one High finding — CrUX per-metric field cards silently never rendering due to the CrUXFieldData shape mismatch — is a user-visible gap that must be resolved before this feature can be considered delivered. The field metric cards (LCP p75, FCP p75, CLS p75, INP p75) are a stated deliverable and they do not work in production. All other findings are medium or low and can be addressed in follow-up tasks.

Conditions for PASS:
  1. Resolve the CrUX field data shape mismatch (High finding) — unify CrUXFieldData to the lighthouse.ts definition, update CoreWebVitals to use named fields, update test fixtures to use the canonical shape, and add an integration test that exercises the real data path.
  2. Move normalizePerformanceMetrics out of scan-worker.ts (Medium) — this is a refactor, not a behavioural fix, but it should accompany the CrUXFieldData fix since both touch the same data layer.
  3. Eliminate the duplicate CrUXFieldData / CrUXMetric / DesktopPerformanceData definitions (Medium) — consolidate to a single canonical source to prevent future shape drift of the kind that produced finding 1.
