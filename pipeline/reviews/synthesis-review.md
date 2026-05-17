SPECIALIST REVIEW SYNTHESIS — Phase 4
Feature: realistic performance scoring + CrUX + best-practices + PSI cache + optional desktop
Surface reviewed: our 16 commits (20bc428..HEAD), 37 files

VERDICT: CONDITIONAL PASS
- Security Auditor : PASS            (0 Critical / 0 Medium / 3 Low)  — 15/15 Red Team security mitigations CONFIRMED
- Performance      : CONDITIONAL PASS (0 Critical / 1 High / 2 Medium / 3 Low)
- Architecture     : CONDITIONAL PASS (1 High / 5 Medium / 5 Low)
- Conflicts between reviewers: NONE — findings corroborate; the CrUX shape mismatch is independently raised by all three.

================================================================
CONSOLIDATED FINDINGS (deduped, by severity)
================================================================

🔴 Critical: NONE

🟠 High (2 — both must be remediated for full PASS):

H1 — CrUX field-data shape mismatch → per-metric real-user cards never render in production
  Raised by: Architecture (High), Performance (Medium), Security (Low/functional). Consensus.
  Mechanism: THREE divergent `CrUXFieldData` definitions —
    - src/lib/scanner/lighthouse.ts parses CrUX into NAMED fields { lcp, inp, cls, fcp, ttfb }
    - src/types/index.ts declares `CrUXFieldData` as { metrics: Record<string, CrUXMetric> }
    - src/components/core-web-vitals.tsx reads fieldData?.metrics['LARGEST_CONTENTFUL_PAINT_MS'] (the Record path)
  The persisted JSON has the named-field shape, so the Record path is always null → every per-metric
  FieldMetricCard is silently suppressed. The overall verdict chip and the "real users slow" banner
  DO work (they read overallCategory/fieldDataVerdict, which is consistent). Tests passed only because
  the fixtures used the types/index.ts shape, not the real lighthouse.ts shape (false confidence).
  Impact: a core part of the "show real-user data" value proposition (the per-metric p75 row) is dead
  in production. Full PSI fetch + CrUX parse + DB write happen; the UI discards it.
  Fix: consolidate to ONE canonical `CrUXFieldData` (named fields) used by lighthouse.ts, types/index.ts,
  the modules and the UI; update core-web-vitals.tsx to read named fields; correct the test fixtures so
  they reflect the real persisted shape (so the tests would have caught this).

H2 — Scan-timeout budget overrun when desktop is ENABLED
  Raised by: Performance (High).
  Mechanism: scanner/index.ts runs sequentially: crawl (worst case ~38s: 30s nav + 8s network-idle)
  → P1 modules → performance. With features.desktopPerformance ON, performance makes 2 SEQUENTIAL PSI
  calls bounded 45s/0-retry = 90s. 38s + 90s = ~128s > the hard SCAN_TIMEOUT_MS (120000) by ~8s →
  scans degrade to TIMEOUT with partial findings. The timing-bound test only asserts 2×PSI < SCAN_TIMEOUT
  and does NOT include crawl time (incomplete assertion: performance.test.ts ~441-455).
  Note: desktop is OFF by default, so this affects only the opt-in desktop path — but it is a real
  correctness gap in the headline timing guarantee.
  Fix: reduce the per-call PSI timeout on the desktop-ON dual-call path (e.g. 35000ms → 70s + 38s = 108s,
  ~12s margin) and change the timing-bound test to assert crawlWorstCase + 2×PSI_TIMEOUT < SCAN_TIMEOUT_MS.

🟡 Medium (must-fix / should-fix):

M1 — `normalizePerformanceMetrics` placed in scan-worker.ts but imported by the API route (Architecture).
  A pure parse/back-compat helper should live in a scanner-level data module, not the worker
  orchestrator. Relocate; have both scan-worker and the API route import it from there.

M2 — PSI cache memory footprint 5–10× the documented estimate (Performance).
  psi-cache caches the FULL LighthouseMetrics incl. accessibilityViolations / seoIssues /
  bestPracticesIssues (those modules don't even use the cache). Real ~50–90 KB/entry → ~14 MB at the
  200-cap, not the documented ~20 KB / ~4 MB. The hard cap prevents unbounded growth (not a leak),
  but the accounting is wrong. Fix: strip non-performance arrays before caching; correct the doc.

M3 — Duplicate `CrUXFieldData` / `DesktopPerformanceData` definitions (Architecture).
  Root cause of H1. Consolidate to a single canonical source to prevent future shape drift.
  (Folded into the H1 fix.)

M4–M5 — Architecture Mediums: add JSDoc clarifying the `scoreSource === undefined` "feature ran"
  contract; minor cohesion notes. See pipeline/reviews/architecture-review.md.

🟢 Low (non-blocking; address opportunistically):
- Security ×3: non-numeric hostile `percentile` degrades to inert "NaN" (cheap type-guard suggested);
  `formatAuditFiles` item.url uncapped into AI-prompt text (pre-existing, React-escaped);
  CrUX shape mismatch (dup of H1, security-side it only REDUCES attack surface).
- Performance ×3: perf-suggestions API loads all findings then filters to P2 in memory (add a
  `where: { moduleId: { startsWith: 'P2-' } }`); `cacheSize()` counts stale entries but labels them
  "live"; `ttlMs()` re-reads process.env each get (negligible; intentional for test override).
- Architecture ×5: see pipeline/reviews/architecture-review.md.

================================================================
KNOWN ITEMS — architecture rulings (carried from the plan)
================================================================
ACCEPTABLE (this delivery): T-06→T-08 decomposition intermediate non-building state (correct
parallel-decomposition consequence; final coupling sound, one-directional); PDF/print path renders
the scalar score only (documented limitation; security-confirmed NOT an XSS sink); hardcoded English
strings in performance-section.tsx (pre-existing pattern — must extract before non-EN perf-section
release); README "What's Included" still lists 15 (must fix before public marketing); `bypassCache`
seam unwired (correctly designed/documented — must close before the re-scan UX is promoted, else a
user re-scanning within the 5-min TTL gets the cached score); `scoreSource===undefined` signal
(consistent — add JSDoc).

================================================================
REGRESSION & BLAST-RADIUS
================================================================
Not yet produced — the Change-Scope & Blast-Radius Validation and Regression Triage run at the
Phase 5→6 boundary. Full unit/integration suite is currently GREEN (npm run test: 1547 passed /
0 failed) at HEAD; the H1 defect is a silent functional gap that the (mis-shaped) fixtures did not
catch — Phase 5 test correction is part of the H1 remediation.

================================================================
VERDICT EXPLANATION
================================================================
No Critical findings anywhere; security is a clean PASS with every Red Team mitigation confirmed.
Two High findings block a full PASS: H1 (the real-user per-metric display is silently dead in
production due to a 3-way type-shape drift — it must work, it is the feature's core value) and H2
(the desktop-ON path can exceed the hard 120s scan timeout). Both are concrete, localized, and
fixable without redesign; M1 and M2 are cheap correctness fixes. Recommendation: CONDITIONAL PASS —
remediate H1, H2, M1, M2 (a bounded fix cycle), then proceed to Phase 5/6 where the corrected
fixtures will prove H1 is fixed and the strengthened timing test proves H2.
