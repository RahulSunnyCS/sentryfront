PERFORMANCE REVIEW REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━
Feature: Realistic performance scoring + CrUX + best-practices + PSI cache + optional desktop
Reviewer: Performance Reviewer (Phase 4 · HIGH effort)
Files reviewed: src/lib/scanner/lighthouse.ts, src/lib/scanner/psi-cache.ts,
  src/lib/scanner/modules/performance.ts, src/lib/scanner/modules/p2-07-real-user-field.ts,
  src/lib/scanner/modules/p2-08-best-practices.ts, src/lib/scan-worker.ts,
  src/lib/scanner/index.ts, src/app/api/v1/scans/[id]/route.ts,
  src/app/api/v1/scans/[id]/performance-suggestions/route.ts,
  src/components/performance-section.tsx, src/components/core-web-vitals.tsx,
  src/types/index.ts
━━━━━━━━━━━━━━━━━━━━━━━━━

─────────────────────────────────────────────────
FINDINGS
─────────────────────────────────────────────────

FINDING: Timing-bound test omits crawl time — desktop-on scan will exceed 120 s budget
Severity: High
File and line: src/__tests__/lib/scanner/modules/performance.test.ts:441–455 (test)
              src/lib/scanner/index.ts:106 (crawl → performance sequential order)
              src/lib/scanner/modules/performance.ts:44–48 (PSI_TIMEOUT_MS = 45 000)

What it is:
When features.desktopPerformance is ON, performance.ts makes two sequential PSI calls
(mobile then desktop), each bounded at 45 000 ms. Their combined worst-case is 90 000 ms.
The timing-bound test checks that 2 × PSI_TIMEOUT_MS (90 000 ms) is less than
SCAN_TIMEOUT_MS (120 000 ms). It passes — 90 000 < 120 000.

However, in scanner/index.ts the full execution order is sequential:
  (1) await crawl(targetUrl) — worst case 30 000 ms navigation + 8 000 ms network-idle = 38 000 ms
  (2) await Promise.all([P1 modules]) — crawl ran first, this is after
  (3) await runPerformanceModules() — sequential after P1
  (4) await runAccessibilityModules() — sequential after performance
  (5) await runSEOModules() — sequential after accessibility

The test comment claims "leave at least 24 000 ms for crawl + security modules" but
38 000 ms (crawl worst case) alone exceeds that. With desktop ON:
  38 000 ms (crawl) + 90 000 ms (desktop PSI) = 128 000 ms > 120 000 ms SCAN_TIMEOUT.

The scan WILL be killed by the timeout handler in 8 out of 10 worst-case scenarios.
Note: accessibility (runLighthouse, 45 000 ms, no cache) and SEO (runLighthouse, 45 000 ms,
no cache) run sequentially after performance and compound the problem further, but these
modules are pre-existing and outside the feature scope. The 2-PSI-call desktop addition is
within scope and materially reduces the remaining budget from ~37 s to ~-8 s.

Impact at scale:
With desktop feature enabled, any scan hitting a slow target or a slow PSI API will time
out and show a TIMEOUT status, delivering zero results. The user re-scans; this doubles API
quota consumption and doubles server load. At 10x user count, desktop-on scans
systematically time out rather than degrade gracefully.

How to fix it:
Option A (preferred, minimal change): reduce PSI_TIMEOUT_MS from 45 000 to 35 000 ms when
desktop is enabled. Two sequential 35 000-ms calls = 70 000 ms. Adding 38 000 ms crawl
worst case = 108 000 ms, leaving 12 000 ms headroom under 120 000 ms. This requires
updating the timing-bound test to also subtract the crawl worst-case and verify the
combined headroom:
  expect(crawlWorstCaseMs + 2 * PSI_TIMEOUT_MS).toBeLessThan(SCAN_TIMEOUT_MS);
where crawlWorstCaseMs = NAV_TIMEOUT_MS + NETWORK_IDLE_TIMEOUT_MS (exported from crawler.ts
or hard-coded from the known constants 30 000 + 8 000).

Option B: run the desktop PSI call in parallel with the P1 security modules by starting
performance.ts as a concurrent promise from scanner/index.ts instead of awaiting it after
P1. This is a larger change but recovers 30–45 s of real wall-clock time.

─────────────────────────────────────────────────

FINDING: PSI cache memory footprint is 5–10x the documented estimate
Severity: Medium
File and line: src/lib/scanner/psi-cache.ts:7–13 (doc comment claims ~20 KB per entry,
              ~4 MB max), src/lib/scanner/lighthouse.ts:361–484 (all four audit arrays stored)

What it is:
The psi-cache.ts documentation states "at ~20 KB per cached LighthouseMetrics value that
is ~4 MB max." However, the cache stores the full LighthouseMetrics object returned by
runLighthouse, which contains four unbounded arrays of ParsedAudit objects:
  - opportunities: up to 10 ParsedAudit objects (each with items arrays of file URLs)
  - accessibilityViolations: up to 16 ParsedAudit objects (each with DOM node entries)
  - seoIssues: up to 12 ParsedAudit objects
  - bestPracticesIssues: up to 12 ParsedAudit objects

Each ParsedAudit item can carry dozens of resource URLs (e.g. unused-javascript returns
all script file paths with byte counts). A real-world site may produce:
  - 10 opportunity audits × 10–20 items × ~200 bytes = 20–40 KB
  - 16 accessibility audits × 5 DOM nodes × ~200 bytes = 16 KB
  - 12 SEO + 12 best-practices audits × 3 items × ~150 bytes = 10 KB
  - fieldData + originFieldData: ~2 KB

Conservative realistic estimate: ~50–90 KB per entry, not 20 KB.
200 entries × 70 KB average = ~14 MB max, not 4 MB.

Note: the MAX_ENTRIES cap of 200 still prevents unbounded growth. This is a medium finding
because the cap prevents catastrophic memory exhaustion; the mismatch between documented
and actual footprint is the concern.

Impact at scale:
Under 10x user load with 200 distinct URLs cached, the process holds ~14 MB in the cache
rather than the documented 4 MB. In a constrained container (e.g. 512 MB), this is
acceptable. In practice the accessibilityViolations and seoIssues arrays are cached even
though only performance data is ever served from the cache — they occupy memory
unnecessarily. At 10x concurrency the cache fills and churns (LRU eviction becomes
frequent), partially defeating the quota-saving purpose of the cache.

How to fix it:
Before storing the value in the cache (in fetchPsi or getOrFetch), strip the non-performance
fields that performance.ts does not read from the cache hit:
  - accessibilityViolations (read by accessibility.ts, which bypasses the cache anyway)
  - seoIssues (read by seo.ts, which also bypasses the cache)
  - originFieldData (only used in P2-07 which runs after the fetch, not from cache)

Keep: lcp, fcp, cls, tbt, tti, si, ttfb, performanceScore, bestPracticesScore,
bestPracticesIssues, opportunities, fieldData.

This reduces the per-entry footprint to ~30 KB and makes the documented 4 MB estimate
closer to reality. Update the psi-cache.ts doc comment after the fix.

─────────────────────────────────────────────────

FINDING: CrUXFieldData type mismatch — CoreWebVitals field metric cards never render
Severity: Medium
File and line: src/types/index.ts:21–26 (frontend CrUXFieldData has metrics: Record<string,CrUXMetric>)
              src/lib/scanner/lighthouse.ts:60–74 (backend CrUXFieldData has lcp, inp, cls, fcp, ttfb)
              src/components/core-web-vitals.tsx:270–279 (reads fieldData?.metrics dict)

What it is:
Two incompatible definitions of CrUXFieldData exist.

lighthouse.ts (the parser output, stored to DB):
  { overallCategory, lcp: CrUXMetric, inp: CrUXMetric, cls: CrUXMetric, fcp: CrUXMetric, ttfb: CrUXMetric }

types/index.ts (the frontend type, used by core-web-vitals.tsx):
  { overallCategory, metrics: Record<string, CrUXMetric> }

The CoreWebVitals component reads:
  const fieldMetrics = metrics.fieldData?.metrics ?? null;  // line 270
  const fieldLcp = fieldMetrics?.['LARGEST_CONTENTFUL_PAINT_MS'];  // line 273

The stored fieldData object has no 'metrics' key — it has lcp, inp, cls directly. So
fieldMetrics is always undefined, hasFieldData is always false, and the real-user
CrUX metric cards (FieldMetricCard components) never render regardless of whether
CrUX data was fetched successfully.

The performance-section.tsx reads fieldData?.overallCategory directly (line 118), which
does work correctly because the lighthouse.ts shape has overallCategory. So the verdict
chip and slow banner function correctly. Only the per-metric breakdown cards in
CoreWebVitals are silently broken.

Performance implication: the PSI API is called, CrUX data is parsed, stored in the DB, and
sent to the frontend — all of which costs real time and bandwidth — but the rendered output
discards the per-metric CrUX data silently.

Impact at scale:
The CrUX per-metric breakdown (individual LCP/FCP/CLS/INP p75 values with Real-user field
cards) is a headline feature of this delivery. It will not appear in production for any
user, at any scale. The fix is a one-time cost; the impact is every scan that returns CrUX
data (every high-traffic site).

How to fix it:
Align the two type definitions. The stored shape (lighthouse.ts parsed form with named
fields) is the canonical form because it handles the ÷100 CLS normalisation in the parser.
Update types/index.ts CrUXFieldData to match:

  export interface CrUXFieldData {
    overallCategory?: 'FAST' | 'AVERAGE' | 'SLOW';
    lcp?: CrUXMetric | null;
    inp?: CrUXMetric | null;
    cls?: CrUXMetric | null;
    fcp?: CrUXMetric | null;
    ttfb?: CrUXMetric | null;
  }

And update CoreWebVitals to read the named fields directly:
  const fieldLcp = metrics.fieldData?.lcp;
  const fieldFcp = metrics.fieldData?.fcp;
  const fieldCls = metrics.fieldData?.cls;
  const fieldInp = metrics.fieldData?.inp;

Remove the metrics.fieldData?.metrics dict access entirely.

─────────────────────────────────────────────────

FINDING: Performance-suggestions API loads all findings but filters to P2 in memory
Severity: Low
File and line: src/app/api/v1/scans/[id]/performance-suggestions/route.ts:20–22 and 60–62

What it is:
The route fetches the scan with include: { findings: true }, which loads every finding row
from all modules (P1-01 through P4-xx — potentially 100+ rows with string fields). It then
filters to P2-only findings in application memory:
  .filter((f) => f.moduleId.startsWith('P2-'))

This means every call to this endpoint transfers all findings from the database to the
application server, only to discard most of them. Additionally, for each retained finding,
JSON.parse(f.fixManual) is called individually in a .map() loop (line 71), adding one parse
call per P2 finding.

Impact at scale:
For a scan with 100 findings across all modules, the query transfers ~100 rows but uses at
most 8–16 (P2 module count). At 10x user load with a popular URL, this endpoint is called
once per report view. The overhead is proportional to the total finding count, not the P2
count. At 10x load with busy scans producing 200 findings, each call transfers ~200 rows to
discard 185 of them.

How to fix it:
Add a where clause to the include to fetch only P2 findings:
  include: {
    findings: {
      where: { moduleId: { startsWith: 'P2-' } }
    }
  }
This reduces the transferred row count to ~8–16 regardless of total finding volume.

─────────────────────────────────────────────────

FINDING: cacheSize() doc says "live (non-expired)" but counts all entries including stale
Severity: Low
File and line: src/lib/scanner/psi-cache.ts:277–286

What it is:
The cacheSize() function's JSDoc says "Returns the current number of live (non-expired)
entries in the cache." The implementation returns store.size, which counts every stored
entry regardless of TTL expiry. Expired entries are only purged lazily when accessed via
get(). Entries that are never accessed again remain in the store and count towards the
LRU eviction limit even though they are functionally stale.

In the worst case, all 200 stored entries have expired. A new scan submits its URL and
the LRU eviction kicks in, evicting still-valid entries that were recently added. The
result is unexpected cache misses that force redundant PSI API calls.

This is currently only called from tests ("Intended for testing and observability only"),
so the impact is limited to misleading test output. However, if it is ever wired into
a health-check or metrics endpoint, it would report inflated cache sizes.

Impact at scale:
At 10x scale with high URL diversity and low re-scan frequency, most of the 200 slots
may be occupied by expired entries. Fresh entries evict stale ones via LRU, which is
correct behaviour, but the eviction budget is consumed by stale entries that could have
been cheap to remove. This reduces effective cache capacity.

How to fix it:
Either (a) update the doc comment to say "total stored entries including expired" (trivial,
correct), or (b) implement a periodic sweep that removes entries where isExpired() is true,
and update the doc comment. Option (a) is the right choice given the observability-only
designation.

─────────────────────────────────────────────────

FINDING: ttlMs() re-reads process.env on every cache get/set
Severity: Low
File and line: src/lib/scanner/psi-cache.ts:79–81 and 84–85

What it is:
Every call to get() invokes isExpired(), which calls ttlMs(), which calls readTtlMs(),
which reads process.env.PSI_CACHE_TTL_MS. In Node.js, process.env reads are synchronous
property lookups on a frozen object. They are fast (sub-microsecond) and not a correctness
problem. The rationale in the comment is to "allow test overrides via process.env without
module re-import," which is valid.

Impact at scale:
At 10x load, the process.env read adds negligible time per cache operation. Not a real-
world bottleneck. Noted for completeness.

How to fix it:
For production performance, the TTL could be read once at module initialisation and cached
in a module-level constant. The test-override use case could be supported by exporting a
setter function. This is a micro-optimisation that only matters if benchmarks show env
reads as a hot path, which is extremely unlikely given the cache's 200-entry maximum.
No immediate action required.

─────────────────────────────────────────────────

SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critical : 0
High     : 1
Medium   : 2
Low      : 3

VERDICT: CONDITIONAL PASS

The implementation is sound in its core design — the fail-soft contract holds, the LRU
cap prevents memory exhaustion, the UNAVAILABLE path is correctly handled, and the desktop
skip on mobile unavailability works as intended. No critical findings.

The High finding (scan timeout budget) is a real risk when desktop performance is enabled:
worst-case crawl + two sequential PSI calls exceeds the 120 s scan timeout by ~8 s. The
timing-bound test is incomplete because it checks only the PSI budget and not the crawl
time that precedes it. This does not affect the default (desktop OFF) path.

The two Medium findings are: the cache footprint is 5–10x the documented estimate (the cap
still prevents catastrophe, but the documentation and memory accounting are wrong); and the
CrUXFieldData type mismatch means the per-metric field data cards never render despite the
full PSI fetch being made — the feature appears broken for CrUX metric breakdown even
though all the backend work to fetch, parse, and store the data is correct.

Conditions before proceeding to Gate 3:
  1. Fix or document the desktop-on timing budget (High): either reduce PSI_TIMEOUT_MS when
     desktop is on, or update the timing-bound test to include crawl overhead.
  2. Fix the CrUXFieldData type mismatch (Medium): update types/index.ts to match the
     stored lighthouse.ts shape so CrUX per-metric cards render correctly.

The P2-findings query inefficiency (Low) and cache doc issues (Low) are acceptable
for this delivery cycle and can be addressed in follow-up.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
