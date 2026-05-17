# Phase 4 — Synthesis Review

Verdict: **CONDITIONAL PASS**

Reviewer verdicts: Security CONDITIONAL PASS (0C/0H/1M/2L) · Performance
CONDITIONAL PASS (0C/1H/2M/3L) · Architecture CONDITIONAL PASS (0C/0H/3M/4L).

## Convergent themes (raised independently by ≥2 reviewers)
- Triplicated signal-derivation rule + MODULE_FRAMEWORKS across
  compliance.ts / report-view.tsx / print-report.tsx — flagged by ALL THREE.
  Consensus: consolidate into one shared module. (Overrides the original
  decomposition choice to forbid shared files — that tradeoff is now wrong.)
- frameworkSummary computed server-side then discarded; UI re-derives it
  (Architecture) — root cause of the triplication.

## Conditions for full PASS (must-fix, prioritized)
- **C1 — Security Medium**: P5-02 (p5-02:100-101,131-134) and P5-04
  (p5-04:49,141-142) echo raw scanned-site hrefs WITH query/fragment into
  finding.evidence/location → persisted + rendered in report and PDF. Possible
  token/email leak. Fix: strip query+fragment (or reuse maskSensitiveText).
- **C2 — Performance High**: 5 independent cheerio.load() parses (p5-01,02,04,
  05,06) ≈400-1000ms worst case, threatens the Critical <5s P5 budget. Fix:
  parse once in runComplianceModules, pass CheerioAPI to modules.
- **C3 — Architecture Medium (consensus)**: extract deriveComplianceStatus +
  fail-closed keyword list + MODULE_FRAMEWORKS + FRAMEWORK_ORDER into one
  shared module imported by all three consumers (drift risk on a legal surface).

## Recommended (cheap, not blocking)
- P5-03 uncapped raw header values in evidence — apply C-35-style length cap (Sec Low).
- ComplianceSection derives status twice per finding — derive once (Perf/Arch Low).
- Unconditional empty compliance page in PDF for pre-P5 scans — guard it (Perf Low).
- Stale "No runtime wiring yet" comment in data.ts (Arch info).
- Minor DNS_RE backtracking in p5-06 (Perf Low).

## Follow-up (post-merge, not this cycle)
- Export/share p1-09 KNOWN_DOMAINS instead of the p5-05 copy (Arch Low).
- Persist complianceFrameworkSummary through scan-worker→DB→API so UI stops
  re-deriving (Arch Medium, larger — schema change; defer with C3 as the
  interim fix).
- Provide reviewed non-English disclaimer translations (Arch Low; English
  fallback is acceptable by Gate-1 decision, so non-blocking).
- Remove/justify dead ComplianceContext.accessibilityScoreSource (Arch Low).

## No reviewer conflicts
Findings are complementary. Architecture corrected the T-10 agent's inaccurate
"Server Components can't use next-intl" note (getTranslations works) — but
English-fallback disclaimer was an explicit Gate-1 decision, so it stays Low.

Non-numeric / signal-only legal invariant: structurally sound (all 3 confirm).
Flag-off byte-identical no-op: verified. No outbound requests: confirmed.
