ARCHITECTURE REVIEW REPORT — P5 Compliance Modules
Branch: claude/compliance-module-eEtca
Lens: backend (scanner) + frontend (report UI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING: Status-derivation rule duplicated across three files
Severity: Medium
File or area: src/lib/scanner/modules/compliance.ts (deriveStatus), src/app/[locale]/report/[id]/report-view.tsx (deriveComplianceStatus), src/app/[locale]/report/[id]/print/print-report.tsx (derivePrintComplianceStatus)
What it is: The three-clause rule that maps finding severity + title keywords to 'observed' / 'not-observed' / 'not-evaluated' is copy-pasted verbatim across all three files. The keyword list ('not evaluated', 'unavailable', 'not applicable') is magic-string checked in each independently, with no shared constant.
Why it matters: This is a regulatory-claim surface. If a P5 module adds a new fail-closed INFO keyword phrase (e.g. 'could not be assessed'), the developer must remember to update all three sites. A single missed update means the print path or the live UI derives a different signal from the same persisted finding — a compliance-display inconsistency that is difficult to detect in review and has real reputational risk.
Recommendation: Extract deriveComplianceStatus and the FAIL_CLOSED_KEYWORDS string array into a shared module at src/lib/scanner/compliance-shared.ts (or src/lib/compliance-utils.ts). Both report-view.tsx and print-report.tsx import from there. compliance.ts imports from the same location. The constraint that prevented shared files during implementation is a task-scope constraint, not a permanent architectural rule; it should be resolved now before the module ships. This is the highest-priority consolidation of the three because the logic is on a high-risk claim surface. Does not need to block the merge alone, but should be a named condition.

---

FINDING: MODULE_FRAMEWORKS mapping duplicated across three files
Severity: Medium
File or area: src/lib/scanner/modules/compliance.ts (MODULE_FRAMEWORKS), src/app/[locale]/report/[id]/report-view.tsx (P5_MODULE_FRAMEWORKS), src/app/[locale]/report/[id]/print/print-report.tsx (P5_MODULE_FRAMEWORKS_PRINT)
What it is: The Record<string, string[]> mapping each P5 module ID to the frameworks it contributes to (GDPR, CCPA, WCAG / Accessibility) exists in three separate copies, each with its own name. FRAMEWORK_ORDER is similarly copied to FRAMEWORK_ORDER_PRINT. The print file explicitly names its copy with a _PRINT suffix, which is a code smell indicating awareness of the duplication rather than a solution.
Why it matters: Adding a new P5 module (e.g. P5-07) requires editing three files. Missing one means the new module's findings appear in the scanner summary but not in the live UI framework panel, or vice versa in the print PDF. Because compliance.ts builds the ComplianceFrameworkSummary and the UI components re-derive the same summary from scratch by re-routing the same findings, they are running the same computation twice with no guarantee of agreement.
Recommendation: Move MODULE_FRAMEWORKS and FRAMEWORK_ORDER to the same shared file as the status-derivation function (src/lib/scanner/compliance-shared.ts). The report-view and print-report components import them from there. This also fixes the deeper architectural issue: the UI is re-deriving data that the scanner already computed and stored. The complianceFrameworkSummary field exists on ScannerResult for exactly this purpose, but it is not flowing to the report UI (see the next finding). If that data path is fixed, both UI components could consume the pre-computed summary directly, eliminating the re-derivation entirely.

---

FINDING: complianceFrameworkSummary computed but never persisted or consumed by the UI
Severity: Medium
File or area: src/lib/scanner/index.ts, src/lib/scan-worker.ts, src/types/index.ts, src/app/[locale]/report/[id]/report-view.tsx
What it is: runComplianceModules returns a ComplianceFrameworkSummary that is placed onto ScannerResult.complianceFrameworkSummary. However, scan-worker.ts does not persist this to the database (the Scan Prisma model has no column for it and the worker does not pass it through), and the scan API route does not return it, so ScanData (src/types/index.ts) does not include it. The report-view and print-report components therefore cannot read the pre-computed summary and must re-derive it by re-running the routing logic against the persisted findings.
Why it matters: The duplicated derivation logic (findings 1 and 2 above) exists precisely because the pre-computed summary is lost between scanner and UI. This is an incomplete data pipeline. The complianceFrameworkSummary field on ScannerResult is computed and then silently discarded. If the duplicated derivation logic ever drifts from compliance.ts, the UI will display different signals from what the server computed and logged.
Recommendation: Either (a) persist the framework summary (a JSON blob column on Scan, populated in scan-worker, returned by the API) so report components can consume it directly and drop all re-derivation code, or (b) accept the re-derivation pattern and consolidate it into a single shared function (satisfies findings 1 and 2). Option (a) is architecturally cleaner and removes the duplication entirely. Option (b) is the minimum viable fix.

---

FINDING: KNOWN_DOMAINS classifier duplicated from p1-09 into p5-05
Severity: Low
File or area: src/lib/scanner/modules/p5-05-third-party-sharing.ts, src/lib/scanner/modules/p1-09-third-party-scripts.ts
What it is: p5-05 contains a local copy of KNOWN_DOMAINS and classifyDomain identical to p1-09, acknowledged with a comment "mirrors p1-09; duplicated because p1-09 does not export its KNOWN_DOMAINS map". The comment also instructs developers to update both files when p1-09 gains entries.
Why it matters: This instruction will be missed. p1-09 will gain new domain entries via the normal security-module update path; the PR author will not think to open p5-05 as well. Over time the two lists diverge: p5-05 classifies domains p1-09 already knows about as 'unknown', generating lower-quality compliance signals.
Recommendation: Export KNOWN_DOMAINS and classifyDomain from p1-09, or move them to a shared scanner tool file (src/lib/scanner/tools/domain-classifier.ts). Both p1-09 and p5-05 import from there. This is a lower-urgency fix than the status-derivation duplication because the impact is signal quality degradation, not correctness inconsistency on the regulatory claim surface. Can be a follow-up task rather than a release blocker.

---

FINDING: report-view.tsx ComplianceSection is doing two roles in one component
Severity: Low
File or area: src/app/[locale]/report/[id]/report-view.tsx — ComplianceSection function
What it is: ComplianceSection contains: (1) a useMemo for filtering P5 findings; (2) a useMemo for calling buildFrameworkSignals; (3) a conditional empty-state render; (4) the per-framework signal panel with disclaimer badges; (5) a separate raw-findings detail list with its own deriveComplianceStatus call inside the JSX. The status label map is declared inline within the component body, and deriveComplianceStatus is called twice (once in buildFrameworkSignals via findingStatus, once again per-finding in the raw list). The component is doing data derivation, signal display, and raw-finding display as a single unit.
Why it matters: This is manageable at current size but will become harder to maintain as P5 modules grow. The dual call to deriveComplianceStatus inside the same render means any status-derivation bug will silently produce inconsistent chip colours between the framework panel and the raw-findings panel for the same finding.
Recommendation: Split into FrameworkSignalsPanel (the per-framework block with signals) and ComplianceRawFindings (the raw-finding list), both consuming the same pre-derived signal status. The status derivation should happen once, in useMemo, not twice. This is a refactor concern, not a correctness blocker.

---

FINDING: Disclaimer string hard-coded in English in print-report.tsx
Severity: Low
File or area: src/app/[locale]/report/[id]/print/print-report.tsx — COMPLIANCE_DISCLAIMER_EN constant
What it is: The disclaimer ("Not legal advice. Not a compliance attestation. Signal detection only.") is hard-coded as an English string in the print path, with a comment explaining that the Server Component cannot use next-intl at render time. The report-view uses t('disclaimer') from the i18n catalog; the print PDF always shows English regardless of locale.
Why it matters: The project supports five locales. A user who scans in German or Hindi will see the German/Hindi report UI but an English disclaimer in their PDF. The comment acknowledges this but treats it as intentional. For a regulatory-claim surface where the disclaimer is the primary legal protection, a locale mismatch is a product gap.
Recommendation: The print route already knows the locale (it is a [locale] route segment). Pass the locale to PrintReport and resolve the disclaimer string from the messages catalog server-side (getTranslations from next-intl works in Server Components). This avoids the claimed limitation. The 'legally safe English version' argument is weaker than it appears: if the rest of the PDF is in German, a single English disclaimer is less likely to be read and understood.

---

FINDING: ComplianceContext.accessibilityScoreSource is never populated by index.ts
Severity: Low
File or area: src/lib/scanner/index.ts, src/lib/scanner/types.ts — ComplianceContext
What it is: ComplianceContext defines accessibilityScoreSource?: 'lab' | 'unavailable', which p5-04 uses to detect fail-closed conditions. The comment in index.ts explicitly states "accessibilityScoreSource is intentionally omitted: AccessibilityResult does not expose a scoreSource". This means p5-04's isUsableScore() check will never see 'unavailable' from the scanner context — if the accessibility pass fails and returns an accessibilityScore of undefined, the P5-04 module will catch that via the undefined check. But if the accessibility pass runs and returns 0 (the fail-closed score Lighthouse produces on a fully broken run), p5-04 treats 0 as 'not usable' (correct), but has no way to distinguish that from a genuine 0/100 score on a real page. The isUsableScore logic comments acknowledge this limitation.
Why it matters: The fail-closed path works correctly, but only because p5-04 conflates "Lighthouse returned 0" with "Lighthouse failed". A page that genuinely scores 0 on accessibility will produce the 'WCAG signal unavailable' INFO finding instead of a LOW/MEDIUM severity signal. The signal is wrong (too conservative) but not dangerous from a regulatory claim perspective (it understates rather than overstates). The ComplianceContext field is defined but can never be set to 'unavailable' by the current index.ts code path.
Recommendation: Add a scoreSource field to AccessibilityResult (in accessibility.ts) that captures whether Lighthouse succeeded. Index.ts can then populate complianceCtx.accessibilityScoreSource. Alternatively, remove the accessibilityScoreSource field from ComplianceContext until AccessibilityResult actually exposes it, to avoid a dead type field that misleads future readers.

---

BACKEND PATTERN CONSISTENCY

The six P5 modules (p5-01 through p5-06) and the compliance.ts orchestrator are compared against the seo.ts and accessibility.ts sibling patterns:

Signatures: P5 modules use the synchronous (crawl: CrawlResult, ctx: ComplianceContext): RawFinding[] signature, distinct from P3/P4 modules that take LighthouseMetrics. This is correct — P5 modules inspect DOM/headers/cookies, not Lighthouse output. The signature divergence is intentional and consistent within the P5 group.

Orchestrator pattern: compliance.ts uses safeRun() for per-module error isolation. The seo.ts and accessibility.ts siblings use bare await + Promise.all inside a single top-level try/catch. The P5 approach is more defensively isolated — a single module failure does not silence other modules — which is the right direction for a fault-tolerant scan. The P3/P4 pattern is weaker and should eventually be brought up to P5's standard.

Async wrapper: compliance.ts is async to match the sibling contract even though all P5 modules are synchronous. This is correct and well-documented.

Logging: All modules and the orchestrator use logger.info/logger.error, consistent with the rest of the scanner.

Error isolation: safeRun catches and logs unexpected errors per module. The logger.error call passes the Error object as a third argument; spot-check against logger.ts is needed to confirm the signature accepts three arguments, but the pattern is consistent with how other scanner modules call logger.error.

Flag-off no-op: index.ts wraps the entire P5 block in if (features.complianceScanning) with a top-level try/catch, and the return uses a conditional spread so the key is absent (not null) when complianceResult is null. This is correct and matches the established pattern for performanceResult and seoResult.

Data.ts registration: P5 module metadata is registered in SCAN_MODULES under a clear comment. The comment notes "No runtime wiring yet" — this is inaccurate now that wiring exists in index.ts and should be updated.

---

TYPE DESIGN

ComplianceSignal.status is typed as 'observed' | 'not-observed' | 'not-evaluated' — a string union. This structurally prevents a numeric score from being added. The type is placed correctly in scanner/types.ts alongside other scanner-internal types.

ComplianceFrameworkSummary is a plain array type, not an object with numeric keys, which satisfies the non-numeric structural guarantee.

ComplianceFrameworkEntry uses 'framework' (string) rather than an enum. This allows future framework names without a schema change, at the cost of no compile-time exhaustiveness check. Acceptable for a signal surface; an enum or const array would be slightly stronger.

The distinction between ComplianceResult (returned by the orchestrator) and the ScannerResult field (ComplianceFrameworkSummary only, findings merged into the shared findings array) is clean. The orchestrator correctly separates concerns.

---

I18N

All five locales have the compliance key block. The disclaimer string is left in English in all non-English locales (es.json, hi.json, ml.json, de.json) — same issue as in print-report.tsx but in the interactive UI as well. The interactive UI does use t('disclaimer'), so any locale that provides a translation will display it. Currently four locales have an English value for the disclaimer key. This is a content gap, not a code defect.

---

SUMMARY
High  : 0
Medium: 3
Low   : 4

VERDICT: CONDITIONAL PASS

The P5 compliance module group is architecturally sound in its core design — the type system correctly prevents numeric scores, the fail-closed pattern is consistent across modules, the flag-off no-op works correctly, and the orchestrator is well-isolated. The three Medium findings are all variants of the same root problem: the implementation task scope forbade shared files, so logic that belongs in one place lives in three. This is a known, documented debt that must be resolved before the feature is considered architecturally stable. The three named conditions for a full PASS are:

1. Extract deriveComplianceStatus and the fail-closed keyword list into a single shared module imported by compliance.ts, report-view.tsx, and print-report.tsx. (Finding 1)
2. Either persist complianceFrameworkSummary through the data pipeline so the UI consumes the server-computed summary (removing all UI-side re-derivation), or consolidate the MODULE_FRAMEWORKS mapping into the same shared module as condition 1. (Findings 2 and 3)
3. The data.ts comment "No runtime wiring yet" for P5 modules should be updated now that index.ts wires them. Minor, but stale comments on a regulatory surface erode confidence.

The KNOWN_DOMAINS duplication (Finding 4) and the remaining Low findings are recommended follow-up tasks, not release blockers.
