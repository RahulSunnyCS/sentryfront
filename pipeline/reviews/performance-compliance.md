PERFORMANCE REVIEW REPORT — Compliance Feature (P5 Modules)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verdict: CONDITIONAL PASS

Scope reviewed: p5-01 through p5-06, compliance.ts orchestrator,
scanner/index.ts integration, report-view.tsx, print-report.tsx.

---

FINDING: Repeated cheerio parse — 5 separate cheerio.load() calls on the same HTML
Severity: High
Files: p5-01-cookie-consent.ts (detectCmp), p5-02-privacy-policy.ts (runPrivacyPolicyModule),
       p5-04-wcag-attestation.ts (detectAccessibilityStatementLink),
       p5-05-third-party-sharing.ts (hasPrivacyPolicyLink), p5-06-user-rights.ts (runUserRightsModule)

What it is: Five of the six P5 modules each call cheerio.load() independently on the
crawled HTML. p5-03 is the only exception (it reads headers only, no HTML parsing). The
compliance orchestrator (compliance.ts) runs all six modules sequentially against the same
crawl.cleanedHtml / crawl.renderedHtml string, so the HTML is parsed by cheerio five separate
times.

Cheerio's load() function builds a full DOM tree from scratch on every call. For a typical
page this takes roughly 10-40 ms. For an adversarially large page (a target site that returns
a 2-4 MB HTML body, which is well within what Playwright will capture) each parse can take
80-200 ms. Five parses of a 2 MB document is 400 ms to 1,000 ms spent only on parsing — on
top of the 60-120 s already consumed by P1-P4. This directly eats into the 120 s hard timeout
and is the dominant performance cost of the P5 group.

A further subtlety: p5-05 calls cheerio.load() inside hasPrivacyPolicyLink(), which receives
crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html — the same string p5-02, p5-04, and
p5-06 also parse. All four of those modules have access to exactly the same HTML and could
share one CheerioAPI instance.

Impact at scale: At the critical QA case (worst-case fixture, must complete under ~5 s), five
independent parses of a large HTML document push the budget. Even at moderate page sizes the
wasted time compounds across concurrent scans running on the same server. At 10x scan
throughput, each wasted parse cycle under peak load increases per-scan latency and server
CPU cost proportionally.

How to fix it: Parse HTML once in runComplianceModules in compliance.ts, then pass the
CheerioAPI ($) instance to each module as a parameter alongside crawl and ctx. Modules that
only traverse the cheerio tree (p5-02, p5-04, p5-05's privacy-link check, p5-06) accept $
directly. p5-01's detectCmp already separates the cheerio call from the entry point — it can
accept a pre-built $ and skip its own load. p5-03 has no HTML dependency and is unaffected.
This converts five O(N) parses into one O(N) parse where N is HTML size. Estimated saving:
300-900 ms on a worst-case 2 MB fixture.

---

FINDING: O(N * M) nested loop in CMP domain detection
Severity: Medium
File: p5-01-cookie-consent.ts, detectCmp(), lines ~236-247

What it is: The scriptDomains check in detectCmp iterates over every script domain in the CMP
catalogue and, for each, iterates over every hostname in the hostnames Set collected from
network requests. At 10 CMP entries with a combined 13 script-domain entries, and a busy page
with 100-200 third-party network hostnames, this is 1,300-2,600 endsWith() comparisons. The
loop exits early on the first match per CMP, but in the worst case (no CMP detected) it runs
to completion: 13 * 200 = 2,600 comparisons per detectCmp call.

This is not a crisis at current catalogue size (the constant is small), but if the CMP
catalogue grows or if a page has 500+ network requests, the comparison count grows linearly
with both. The cost is also incurred on every scan regardless of whether the hostnames Set
has already been checked earlier in the P1 group.

Impact at scale: Marginal at current catalogue size (microseconds, not milliseconds). Becomes
measurable if catalogue grows to 30-50 CMPs or if network request lists exceed 500 entries.

How to fix it: Invert the lookup. Convert the flat list of script domains across all CMP
entries into a Map<scriptDomain, cmpName> once at module load time (as a module-level
constant). Then for each hostname in the network request list, do a single O(1) Map lookup
instead of an O(M) nested loop. This turns O(N * M) into O(N + M) at no readability cost.

---

FINDING: Privacy-link detection is duplicated across three modules
Severity: Medium
Files: p5-02-privacy-policy.ts, p5-05-third-party-sharing.ts (hasPrivacyPolicyLink function),
       and effectively p5-04-wcag-attestation.ts (accessibility statement link search)

What it is: p5-02 and p5-05 both traverse every anchor element on the page looking for a
privacy policy link. They use slightly different heuristics (p5-02 is richer — it checks href
patterns and prominence; p5-05 is a simpler text.includes('privacy') check inside its own
internal hasPrivacyPolicyLink helper). Both call cheerio.load() separately (already counted in
the first finding). Beyond the redundant parse, the anchor traversal itself is repeated: both
modules call $('a').each() over the full anchor list independently. On a page with thousands
of anchor elements this is two O(A) traversals where one would do.

p5-04 also calls $('a').each() to look for an accessibility statement link, adding a third
independent full-anchor walk.

Impact at scale: Three separate $('a').each() calls over a large DOM. On a page with 1,000
anchor elements each traversal takes a few milliseconds; three traversals triple the cost for
no additional information. With the shared-parse fix above in place, at least the parse cost
drops to one; but the traversals remain separate.

How to fix it: After the shared-parse fix, add a single anchor-traversal pass in
runComplianceModules that collects, in one walk: the privacy policy link (href + text +
prominence), the accessibility statement link, and all interactive button/link text for the
rights-affordance check. Pass these pre-collected results into the modules that need them.
This collapses three $('a').each() calls into one.

---

FINDING: Regex patterns in p5-06 are applied to a single joined string, not individually — minor ReDoS risk
Severity: Low
File: p5-06-user-rights.ts, lines ~207-215

What it is: p5-06 collects all anchor and button text into an array, then joins it with
newlines into a single combinedText string, and applies three compiled regexes (DELETE_ACCOUNT_RE,
EXPORT_DATA_RE, DNS_RE) against that combined string. The regexes themselves are not
catastrophically backtracking (they use \s+ not .* between word boundaries, and the patterns
are short). However, the DNS_RE pattern is the most complex:
  /do\s+not\s+sell\s+my\s+(?:personal\s+)?(?:information|data)|your\s+privacy\s+choices|.../i
Applied against a very long combinedText (many anchors, long button labels), this involves
alternation with repeated \s+ quantifiers. On a pathological input — a page with thousands
of buttons all containing text like "do not not not not sell" — this could backtrack
non-trivially.

The risk is mitigated by the fact that the text comes from anchor/button elements (not raw
HTML), so it is shorter than full HTML. But an attacker-controlled page could craft buttons
with long, deliberately adversarial text to slow the regex engine.

Impact at scale: Marginal for typical pages. Under adversarial conditions (a page crafted
specifically to trigger backtracking) could add tens of milliseconds to the scan. Not a
show-stopper at current regex complexity.

How to fix it: Test each regex against the individual text strings before joining, or add
an explicit length cap on combinedText (e.g. skip the check if the combined string exceeds
50,000 characters). Alternatively, simplify the DNS_RE alternation to remove the optional
groups that create backtracking opportunity.

---

FINDING: Duplicated signal-derivation logic between frontend and server
Severity: Low
Files: report-view.tsx (deriveComplianceStatus + buildFrameworkSignals + P5_MODULE_FRAMEWORKS),
       print-report.tsx (derivePrintComplianceStatus + buildPrintFrameworkSignals +
       P5_MODULE_FRAMEWORKS_PRINT), compliance.ts (deriveStatus + MODULE_FRAMEWORKS)

What it is: The logic that maps a finding's severity and title keywords to a compliance signal
status ('observed' / 'not-observed' / 'not-evaluated') is written three times: once in
compliance.ts (server), once in report-view.tsx (interactive client component), and once in
print-report.tsx (print server component). The MODULE_FRAMEWORKS / P5_MODULE_FRAMEWORKS /
P5_MODULE_FRAMEWORKS_PRINT constant is also duplicated three times. The code comments in
report-view.tsx and print-report.tsx acknowledge this duplication explicitly and say these
must be kept in sync manually.

This is not a runtime performance problem by itself — the derivation functions are cheap. The
performance risk is indirect: when the derivation rule changes on the server (compliance.ts),
a developer must remember to update two frontend copies. If one copy drifts, the frontend
displays different signals than what the server computed, and the discrepancy is not caught by
types or tests. The print path runs at render time and re-derives from persisted findings; if
its rule diverges from the server rule, the PDF shows different conclusions than the report UI.

Impact at scale: Not a latency or memory issue. The latent risk is a correctness divergence
that surfaces as a user-facing display bug under regulatory scrutiny — precisely the wrong
place for a subtle inconsistency.

How to fix it: Extract deriveComplianceStatus and MODULE_FRAMEWORKS into a shared file (e.g.
src/lib/compliance-signals.ts) that both server modules and client components import from.
Both report-view.tsx and print-report.tsx already import from src/lib/data and src/types;
a shared lib file is a natural fit. The print component is a Server Component, so the import
works there too.

---

FINDING: useMemo on p5Findings filter runs on every render cycle in report-view.tsx
Severity: Low
File: report-view.tsx, ComplianceSection component, lines ~776-780

What it is: ComplianceSection receives the full findings array as a prop (all findings from
all tabs), then uses useMemo to filter to P5-prefixed findings. It also uses a second useMemo
to call buildFrameworkSignals on those filtered findings. These are correctly memoized and will
not re-run unless the findings prop reference changes. This is the right pattern.

However, deriveComplianceStatus is called twice for each finding in the raw findings list
rendered at the bottom of ComplianceSection: once to pick the STATUS_CHIP_STYLE and once to
look up statusLabel. This is a trivial inline function call (not a parse), but the double
invocation on every render is a code-quality smell that will become measurable if the P5
findings list grows large. More importantly, it indicates the component is not memoizing the
derived status per finding.

Impact at scale: Negligible at typical finding counts (6-12 P5 findings). Not a real-world
bottleneck.

How to fix it: Derive the status once per finding inside the map() that renders the list —
store it in a local const and use it for both style and label. No useMemo needed for something
this cheap; just avoid calling the function twice per item.

---

FINDING: Sequential execution of synchronous P5 modules is correct but comment is misleading
Severity: Low
File: compliance.ts, runComplianceModules, lines ~155-165

What it is: The orchestrator comment says "Sequential execution is used here (not Promise.all)
because all modules are synchronous CPU-bound functions — parallelism via Promise.all would
only add overhead from microtask scheduling with no I/O gain." This reasoning is correct. The
six safeRun calls run sequentially and that is the right choice for synchronous functions on
Node.js's single-threaded event loop.

However, the comment is slightly misleading about microtask overhead: Promise.all on already-
resolved values adds overhead in the hundreds of nanoseconds — negligible. The real reason
to prefer sequential here is that Promise.all does not actually parallelize CPU-bound work on
a single thread; it only helps when tasks can overlap I/O waits. The comment would be more
accurate if it said "CPU-bound synchronous work does not benefit from Promise.all on a single-
threaded event loop." This is a documentation issue, not a performance issue.

No code change required — the implementation choice is correct.

---

FINDING: print-report.tsx always adds a compliance page even for pre-P5 scans (no data)
Severity: Low
File: print-report.tsx, ~line 310, addPage('compliance')

What it is: The compliance page is unconditionally added to the page counter in PrintReport,
even when hasComplianceFindings is false (i.e. for scans run before the P5 feature was
enabled). This means every PDF from a pre-P5 scan gains an extra page that says "Compliance
signal detection will appear here once the scan has run the Phase 5 modules." This is a minor
UX overhead — it increases PDF length by one page for all historical scans — and also burns
Playwright rendering time for an essentially empty page on every PDF generation for old scans.

Impact at scale: Adds one empty page per PDF export for all scans that predate the compliance
feature. On a high-volume scan history with many PDF exports, this is a small but unnecessary
cost per render.

How to fix it: Make the compliance page conditional on hasComplianceFindings, matching the
pattern used for priorityPage, allFindingsPage, and passedPage (all of which use a null guard
before addPage). When hasComplianceFindings is false, skip the page entirely and shift the
page numbers for the sections that follow.

---

SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critical: 0
High    : 1
Medium  : 2
Low     : 5

Verdict: CONDITIONAL PASS

The P5 implementation is functionally sound and the sequential CPU-bound
execution model is correct. The single blocking concern before the 5 s budget
gate is the High finding: five independent cheerio.load() calls against the
same HTML string. This must be fixed to reliably pass the Critical QA case.
The two Medium findings (O(N*M) domain loop, duplicated anchor traversals) are
non-blocking but should be resolved before GA. The Low findings are quality
improvements that can be deferred to a follow-up.
