# Epic: Compliance Signal Detection — P5 Modules (P5-01 through P5-06)

| Field      | Value                                         |
|------------|-----------------------------------------------|
| Status     | Completed                                     |
| Date       | 2026-05-17                                    |
| Branch     | claude/compliance-module-eEtca                |
| Tasks      | T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, FIX-01, FIX-02, FIX-03 |
| Risk level | HIGH (regulatory-claim-surface)               |

## 1. What was done

Six passive privacy/transparency signal-detection modules were built and wired
into VibeSafe's existing scanner pipeline, replacing the CompliancePlaceholder
in the report UI with a real, disclaimered compliance section.

**Foundation and infrastructure (T-01, T-09, T-11)**
- `ComplianceContext`, `ComplianceResult`, and `ComplianceFrameworkSummary`
  types added to `src/lib/scanner/types.ts`. The framework summary is a
  non-numeric structure: each entry carries a signal label and one of three
  statuses — `observed`, `not-observed`, or `not-evaluated`. No numeric score
  or fraction field exists anywhere in the type.
- `complianceScanning` feature flag added to `src/lib/features.ts`, defaulting
  to `true`, consistent with the `seoScanning` / `accessibilityScanning`
  sibling flags.
- P5-01 through P5-06 registered in `SCAN_MODULES` in `src/lib/data.ts`.
- `src/lib/scanner/index.ts` wires the compliance group as the last block,
  appended after the accessibility group, inside its own `try/catch`. When the
  flag is off, zero P5 code executes and `ScannerResult` is structurally
  identical to the pre-feature version — the `P5-Compliance` key is absent from
  `moduleFindingCounts` entirely, not present with value `0`.
- `docs/modules/COMPLIANCE_MODULES.md` corrected to remove "suitable for audits
  and due diligence" marketing language that predated the modules (T-11, R1
  recommendation accepted at Gate 1).

**Six detection modules (T-02 through T-07)**
- `p5-01-cookie-consent.ts` — detects consent management platforms (10 vendors:
  OneTrust, Cookiebot, Osano, Termly, Usercentrics, CookieYes, Didomi,
  Complianz, Klaro, Quantcast) via DOM markers and script/network request
  domains. When non-essential cookies are present but no CMP signal is found,
  emits a factual LOW finding. Fails closed to a neutral INFO "not evaluated"
  when the crawler did not produce a rendered DOM (fetch-only fallback).
- `p5-02-privacy-policy.ts` — locates privacy-policy links in crawled HTML via
  anchor text and href patterns. Presence and footer/nav prominence only;
  policy content is not fetched (deferred, SSRF / scan-budget rationale).
- `p5-03-data-protection-headers.ts` — re-reads the already-crawled
  `crawl.headers` for HSTS, CSP, Referrer-Policy, Permissions-Policy, and
  X-Content-Type-Options under a data-protection framing. No regulatory verb
  language ("GDPR Art. 32 non-compliant" was explicitly prohibited; plain
  "data-protection-relevant header not set" used instead, per R2 Gate-1
  decision).
- `p5-04-wcag-attestation.ts` — consumes the Lighthouse accessibility score
  already computed by the P3 group, threaded in via `ComplianceContext`. When
  the score is absent, zero, or from an unavailable source, emits "WCAG signal
  unavailable" — never a 0/100 "ADA risk" finding. Every emitted finding
  includes the Lighthouse-subset caveat (not full WCAG 2.2 AA). Also detects
  accessibility-statement links in the crawled DOM.
- `p5-05-third-party-sharing.ts` — enumerates third-party processor domains
  from `crawl.jsBundleUrls`, `crawl.networkRequests`, and `crawl.cookies`,
  grouped by category (analytics, ads, payment, etc.), using a local copy of
  the p1-09 domain classifier (p1-09 does not export its map; the copy is
  acknowledged as a deliberate debt, see Section 7).
- `p5-06-user-rights.ts` — detects user-rights affordances via DOM heuristics:
  "delete account", "download/export data", and "Do Not Sell My Personal
  Information / Your Privacy Choices" links and buttons. Emits no finding for
  purely informational sites (no detected account surface → INFO "not
  applicable").

**Orchestrator and shared module (T-08, FIX-01, FIX-02)**
- `src/lib/scanner/modules/compliance.ts` coordinates all six modules with
  per-module `safeRun()` isolation (a thrown exception in any one module does
  not abort the rest). Parses the crawled HTML with cheerio exactly once and
  passes the pre-built `CheerioAPI` instance to each module via
  `ComplianceContext.dom`, eliminating five redundant parse cycles (Phase-4
  performance High finding, resolved in FIX-01/FIX-02).
- `src/lib/scanner/compliance-shared.ts` is the single source of truth for
  `deriveComplianceStatus`, `FAIL_CLOSED_KEYWORDS`, `MODULE_FRAMEWORKS`, and
  `FRAMEWORK_ORDER` — all three consumers (compliance.ts, report-view.tsx,
  print-report.tsx) import from here (Phase-4 architecture C3 condition,
  resolved in FIX-02/FIX-03).

**Report UI, PDF, and i18n (T-10, FIX-03)**
- `report-view.tsx` CompliancePlaceholder replaced with a real
  `ComplianceSection` component that groups P5 findings by module category and
  shows a per-framework signal list (GDPR, CCPA, WCAG / Accessibility) with
  `observed` / `not observed` / `not evaluated` chips. Each framework block
  carries a co-located disclaimer badge: "Not legal advice. Not a compliance
  attestation. Signal detection only."
- `print-report.tsx` renders the same disclaimer in the PDF export. The
  compliance PDF section is skipped entirely for pre-P5 scans (no findings) so
  old scan PDFs do not gain a blank page (Phase-4 performance Low finding,
  resolved in FIX-03).
- All five message catalogs (`en`, `hi`, `ml`, `es`, `de`) carry the compliance
  i18n keys. For the disclaimer, non-English locales currently hold the reviewed
  English string as a fallback — a Gate-1 decision; translated strings are
  deferred (see Section 7).

**href PII/token masking (FIX-01)**
- `p5-02` and `p5-04` previously echoed raw anchor `href` attributes (including
  query strings) into `finding.evidence` and `finding.location`. Phase-4
  security Medium finding C1: both modules now strip the query string and
  fragment before storage, keeping only `origin + pathname`.

## 2. How this helps the project

VibeSafe's compliance tab previously showed a "coming soon" placeholder. Users
scanning a URL had no visibility into whether the site exhibited basic
privacy-hygiene signals — consent banners, a privacy policy, data-protection
headers, or user-rights affordances. This gap was especially notable given the
product's security-first positioning.

The six new modules fill that gap without overclaiming. A user scanning a
competitor or vendor site now sees an honest, heuristic summary: which signals
were observed, which were absent, and where the scanner could not make a
determination. The GDPR/CCPA/WCAG groupings give non-technical users a
framework-oriented view without asserting that the site passes or fails any
regulation.

The explicit design choice — signal coverage, not compliance scores — protects
VibeSafe from the legal-credibility risk of publishing incorrect attestations.
A false "GDPR compliant" verdict is more damaging than an honest "consent
mechanism not detected."

## 3. Limitations and tradeoffs (and why we chose this)

**Heuristic presence-detection only, no policy-content verification.**
The modules check whether a consent banner exists, whether a privacy-policy
link is reachable from the crawled page, and whether user-rights UI affordances
are present in the DOM. They cannot verify that the consent mechanism is
legally adequate, that the privacy policy covers all required disclosures, or
that the "delete account" button actually works.

Why: fetching and parsing the content of a privacy policy would require an
additional outbound request per scan, expanding the SSRF attack surface and
consuming scan-budget time the feature does not have. More importantly, making
legal-quality judgements about policy content would require the kind of
authoritative analysis VibeSafe's CLAIMS_RULES explicitly prohibit. This work
is deferred to a future optional LLM-enrichment layer, where it can be clearly
labelled as AI-assisted interpretation rather than a deterministic verdict.

**Single-page crawl only.**
The scanner crawls one URL. A privacy policy linked only from an interior page
that was not the crawl target will be missed. Sites that load their consent
banner only after user interaction (lazy-loaded CMPs) may appear to lack one
if the headless browser does not trigger the load.

Why: multi-page crawling would multiply scan time and cost. The single-page
constraint is consistent with every other VibeSafe module.

**Fetch-only fallback yields "not evaluated."**
When the headless Playwright crawl fails and the scanner falls back to a plain
HTTP fetch, most DOM-dependent signals (consent banners, user-rights buttons)
cannot be assessed. The modules emit neutral INFO "not evaluated" findings in
this case rather than negative findings.

Why: emitting "no consent banner found" when the banner requires JavaScript to
render would be a false negative that looks like a positive finding to users.
The conservative path is always correct here.

**WCAG signal inherits Lighthouse-subset limitation.**
P5-04 reuses the Lighthouse accessibility score from the P3 group. Lighthouse
checks a subset of WCAG 2.2 AA rules. A score of 100 does not mean the site
is WCAG 2.2 AA conformant. Every finding P5-04 emits includes this caveat
explicitly.

Why: running a separate full WCAG audit tool (e.g. axe-core) would add a new
dependency with an MPL-2.0 licence that is currently at the WARNING tier in the
project's compliance checks. Reusing the already-computed Lighthouse score adds
zero scan-budget cost and zero new dependency surface.

**English-only disclaimer in non-English report PDFs.**
The PDF print path (a Next.js Server Component) uses a hard-coded English
disclaimer string. The interactive report UI uses `t('disclaimer')` from the
i18n catalog, but the non-English catalog entries currently hold the English
string as a fallback value.

Why: this was an explicit Gate-1 decision. Non-English disclaimer translations
need independent legal review before they can be published; shipping an
unreviewed machine translation on a regulatory-claim surface was judged riskier
than an English fallback. The architecture supports per-locale translation once
the strings are reviewed (see Section 7).

**`complianceFrameworkSummary` computed but not persisted.**
The orchestrator builds a per-framework signal summary at scan time, but the
field is not written to the database or returned by the scan API. The report UI
re-derives the same summary from the persisted findings using the shared
`deriveComplianceStatus` function. This means the scan and UI derivations are
logically equivalent, but any future change to the derivation rule must be
deployed before the UI reads it correctly (it applies retroactively to old
findings on next page load, not at scan time).

Why: persisting the summary requires a schema migration (a new JSON column on
the `Scan` model, scan-worker changes, API contract changes). That is a
larger-scope change than this epic warranted. The shared-module approach (C3
fix) makes the two derivations byte-identical and reduces the drift risk. Full
persistence is the recommended follow-up (Section 7).

**p1-09 `KNOWN_DOMAINS` map duplicated in p5-05.**
p5-05 contains a local copy of the domain classifier from p1-09 because p1-09
does not export its map. Both maps must be updated when a new third-party domain
is added.

Why: the task contract forbade modifying p1-09 to avoid any risk of breaking
the existing P1 security module. Exporting the shared map requires modifying
p1-09, which was descoped to a post-merge follow-up (Section 7).

## 4. Tests the AI ran to verify this works

**Unit tests**
File: `src/__tests__/compliance/` (and colocated module test files)
Added 97 unit tests covering each P5 module individually. Test categories per
module: CMP detection from DOM markers, CMP detection from script-domain
signals, fail-closed on fetch-only render mode, non-essential cookies without
CMP, empty cookies/DOM, and factual finding language (no attestation words).
The p5-04 suite validates the Lighthouse-subset caveat in every emitted finding.
The compliance-shared suite validates that `deriveComplianceStatus` produces
the correct three-way status for `INFO`, `LOW/MEDIUM/HIGH`, and fail-closed
INFO titles.

Result: 97 new tests added; all pass. Total suite: 1693 passing / 10 skipped /
0 failing. Verified deterministically twice. Baseline before compliance work was
1596 passing; net +97 unit +25 integration, 0 regressions in the pre-existing
suite.

**Integration tests**
File: `src/__tests__/compliance/compliance-integration.test.ts`
Added 25 integration tests covering the full `runComplianceModules()` path:
orchestrator exception isolation (one throwing module does not abort others),
flag-off byte-identical output (no P5 keys on `ScannerResult`), timing on a
worst-case large fixture (500 KB HTML, 200 network entries — must complete
under 5 s), execution-order validation (compliance group runs after
accessibility result is available), `moduleFindingCounts['P5-Compliance']`
counting, and back-compat with pre-P5 `ScannerResult` shapes.

Result: 25 new tests; all pass (included in the 1693 total above).

**E2E tests (CI-ONLY — not executed in this environment)**
File: `e2e/compliance-report.spec.ts`
14 Playwright specs written and tagged: 7 `@critical`, 5 `@functional`,
2 `@non-blocker`. Critical specs cover: no attestation language in the
compliance section, disclaimer present on every report, factual-signal-only
findings language, non-numeric signal labels, flag-off renders placeholder only,
old pre-P5 scans do not crash, and worst-case UI render does not throw.

The E2E suite was not executed in this pipeline: no dev server is available in
the sandbox and `COMPLIANCE_SCAN_ID` (a seeded P5-populated scan) was not
configured. All 14 specs are classified EXTERNAL-deferred (environmental, not
DIRECT or COLLATERAL) per the Automation Gate record. The Automation Gate
result is CI-ONLY and does not block Gate 3. CI must run these specs with a
dev server and a seeded scan before the feature is confirmed end-to-end.

**Mandatory security-relevant invariants confirmed (unit level)**
- No outbound network request: verified by mocking `fetch` and asserting zero
  calls during every P5 module execution.
- Fail-closed on absent/unreliable input: unit tests confirm INFO "not
  evaluated" findings when render mode is `fetch-only` or DOM is absent.
- C1 PII strip: unit tests confirm `p5-02` and `p5-04` emit `origin+pathname`
  only in `finding.evidence` and `finding.location` (query string and fragment
  stripped).
- Non-numeric: no numeric field exists on `ComplianceFrameworkSummary` type;
  unit tests assert no finding title or explanation contains "compliant",
  "certified", "attested", or a pass-fraction.

## 5. Manual test cases (for human verification)

**MTC-1 — Disclaimer present on a scan with P5 findings**
- Preconditions: Dev server running. A scan exists in the database for a URL
  that has third-party scripts and cookies (e.g. any commercial site). The scan
  was run with `complianceScanning` enabled (the default).
- Steps:
  1. Open the report page for that scan in a browser.
  2. Click the "Compliance" tab.
  3. Look at every framework block (GDPR, CCPA, WCAG / Accessibility).
- Expected result: Each framework block contains a visible disclaimer reading
  "Not legal advice. Not a compliance attestation. Signal detection only." The
  disclaimer is part of the rendered DOM (visible without any interaction). No
  block shows a percentage, score, or verdict like "GDPR compliant".

**MTC-2 — No attestation language anywhere in the compliance section**
- Preconditions: Same as MTC-1.
- Steps:
  1. Open the compliance tab for a scan.
  2. Read every visible string in the compliance section: framework headings,
     signal chips, finding titles, finding explanations, disclaimer text.
  3. Use browser Find (Ctrl+F / Cmd+F) to search for "compliant", "certified",
     "attested", "passed", "violation", "non-compliant".
- Expected result: None of those words appear in the compliance section. Signal
  chips read "observed", "not observed", or "not evaluated". Framework headings
  read "GDPR", "CCPA", "WCAG / Accessibility" — not "GDPR passed" or "GDPR
  score".

**MTC-3 — Flag-off renders placeholder, not the compliance component**
- Preconditions: Dev server running. Set `FEATURES='{"complianceScanning":false}'`
  in the environment and restart the server. Run a fresh scan.
- Steps:
  1. Open the report for the fresh scan.
  2. Click the "Compliance" tab.
- Expected result: The original "coming soon" placeholder is displayed (or the
  tab is absent). The new framework-signal component with disclaimer badges does
  not appear. No console errors.
- Cleanup: Remove the `FEATURES` override and restart.

**MTC-4 — Old scan (pre-P5) does not crash**
- Preconditions: A scan record exists in the database that was created before
  the P5 feature shipped — it has no `complianceFrameworkSummary` field and no
  P5 findings.
- Steps:
  1. Open the report page for that old scan.
  2. Click the "Compliance" tab.
- Expected result: The compliance section either shows the original placeholder
  or a neutral "no compliance data available" state. No JavaScript error appears
  in the console. The other tabs (Security, Performance, Accessibility, SEO)
  are unaffected.

**MTC-5 — Cookie consent signal detected for a site with a known CMP**
- Preconditions: Dev server running. Scan a URL that uses OneTrust or Cookiebot
  (many large commercial sites do — check the script source for `onetrust` or
  `cookiebot` domain names).
- Steps:
  1. Wait for the scan to complete.
  2. Open the report, go to the Compliance tab.
  3. Find the GDPR framework block and look for the "Cookie Consent" signal.
- Expected result: The "Cookie Consent" signal chip reads "observed". The
  finding detail mentions the CMP name. The finding does not say the site is
  "GDPR compliant" — it says a consent mechanism was detected.

**MTC-6 — Consent signal not evaluated on a fetch-only scan**
- Preconditions: Scan a URL that the Playwright headless crawl cannot reach
  (firewall, authentication wall, or deliberately use a URL that returns a 403
  on the crawl). The scanner falls back to a static HTTP fetch.
- Steps:
  1. Wait for the scan to complete.
  2. Open the Compliance tab.
  3. Inspect the "Cookie Consent" signal chip.
- Expected result: The signal chip reads "not evaluated", not "not observed".
  No finding says "no consent banner found" or implies a compliance gap from the
  absence of the rendered DOM.

**MTC-7 — Compliance section in PDF export carries disclaimer**
- Preconditions: A completed scan with P5 findings exists.
- Steps:
  1. Open the report for that scan.
  2. Click "Export PDF" (or navigate to the print route directly).
  3. In the rendered PDF, locate the Compliance section.
- Expected result: The disclaimer "Not legal advice. Not a compliance
  attestation. Signal detection only." appears in the Compliance section of the
  PDF. The compliance section is present because P5 findings exist. The
  framework signal labels are identical to those on the web report.

**MTC-8 — No compliance page in PDF for a pre-P5 scan**
- Preconditions: A scan record with no P5 findings exists (either a pre-P5 scan
  or one run with the flag off).
- Steps:
  1. Export the PDF for that scan.
  2. Check the PDF page count and table of contents.
- Expected result: No "Compliance" page or section appears in the PDF. The page
  count is the same as before the P5 feature. No blank page is added.

**MTC-9 — Third-party sharing signal lists processor categories**
- Preconditions: Scan a URL that loads Google Analytics, Facebook Pixel, or
  Stripe.js (common on e-commerce sites).
- Steps:
  1. Open the Compliance tab.
  2. Find the "Third-Party Data Sharing" finding in the GDPR/CCPA block.
- Expected result: The finding lists detected domains by category (e.g.
  "analytics: google-analytics.com", "ads: facebook.com"). The finding does not
  say the site "violates GDPR" or "fails to disclose data sharing" — it says
  third-party processors were detected and states whether a privacy-policy link
  was observed.

**MTC-10 — Compliance section is keyboard-navigable**
- Preconditions: A completed scan with P5 findings exists. Accessibility tools
  enabled in the browser or manual Tab-key navigation.
- Steps:
  1. Open the Compliance tab.
  2. Navigate the section using Tab and Enter only (no mouse).
  3. Verify the disclaimer text is reachable and the finding detail expand/
     collapse (if any interactive elements exist) is operable by keyboard.
- Expected result: All interactive elements are reachable in a logical order.
  The disclaimer text is in the DOM (not CSS-only) and is read aloud by a screen
  reader.

## 6. Security and risk notes

**Phase-4 specialist verdicts**
All three reviewers returned CONDITIONAL PASS. Three conditions were identified
and all three were resolved in Phase 6 before the tests ran.

- **C1 — Security Medium (resolved — FIX-01)**: `p5-02` and `p5-04` echoed raw
  anchor `href` attributes — including query strings that could carry password
  reset tokens, signed URLs, or email addresses — into `finding.evidence` and
  `finding.location`. The LLM enrichment path already strips these via
  `maskSensitiveText()`, but the persisted-report and PDF paths did not. Fixed
  in FIX-01: both modules now strip query string and fragment before storage,
  keeping `origin + pathname` only.

- **C2 — Performance High (resolved — FIX-01/FIX-02)**: Five of six P5 modules
  called `cheerio.load()` independently on the same HTML string (only p5-03,
  which reads headers, was exempt). On a 2 MB page, five sequential parses add
  400–1000 ms to the scan. Fixed by parsing the HTML once in
  `runComplianceModules` and passing the resulting `CheerioAPI` instance through
  `ComplianceContext.dom`. Each module uses `ctx.dom ?? cheerio.load(...)` as a
  fallback for backwards compatibility.

- **C3 — Architecture Medium / consensus across all three reviewers (resolved —
  FIX-02/FIX-03)**: The signal-derivation rule, `FAIL_CLOSED_KEYWORDS`,
  `MODULE_FRAMEWORKS`, and `FRAMEWORK_ORDER` were copied verbatim into
  `compliance.ts`, `report-view.tsx`, and `print-report.tsx`. A drift between
  these copies on the regulatory-claim surface would cause the UI and PDF to
  display different signals than the scanner computed. Fixed by extracting all
  of these into `src/lib/scanner/compliance-shared.ts` (a pure module with no
  Node-only dependencies, safely importable from both server and client). All
  three consumers now import from the single source of truth.

**Residual accepted items**

- `src/types/index.ts` is listed as "unlinked" in the blast-radius record. A
  pre-existing one-line build fix (correcting a `CrUXFieldData` import) was
  applied under T-01 to make `npm run build` pass; it is not in any task scope,
  has no logic change, and was surfaced to and accepted by the user during
  Phase 3.

**Recommended follow-ups (not this cycle — see Section 7)**
- Persist `complianceFrameworkSummary` through `scan-worker` → database →
  scan API so the UI consumes the pre-computed summary directly instead of
  re-deriving from findings.
- Export `KNOWN_DOMAINS` and `classifyDomain` from `p1-09` and remove the copy
  in `p5-05`, so new domain entries added to the security module are
  automatically reflected in compliance findings.
- Provide reviewed non-English disclaimer translations for `hi`, `ml`, `es`,
  `de` message catalogs. Until those translations are reviewed, the English
  fallback is displayed per the Gate-1 decision.

**Feature flag and rollback**
`features.complianceScanning` (default `true`) can be set to `false` via the
`FEATURES` environment variable (`FEATURES='{"complianceScanning":false}'`).
When false, the flag-off path is byte-identical to the pre-feature scanner
output: no P5 findings, no `P5-Compliance` key in `moduleFindingCounts`, no
`complianceFrameworkSummary` field on `ScannerResult`. The report UI falls back
to the original CompliancePlaceholder. A server restart with this override is
the full rollback path — no migration required.

## 7. Follow-ups and deferred work

- **Persist `complianceFrameworkSummary` through the data pipeline.** The
  orchestrator computes a per-framework signal summary at scan time, but it is
  dropped before the database write. The UI re-derives the same summary from
  persisted findings. This introduces two live copies of the derivation rule.
  Persisting the summary is the architecturally clean fix (new JSON column on
  `Scan`, scan-worker and API changes, `ScanData` type update); deferred because
  it is a schema migration that was out of scope for this epic.

- **Export `KNOWN_DOMAINS` / `classifyDomain` from `p1-09`.** The `p5-05` local
  copy will drift from `p1-09` as new third-party domains are added via normal
  security-module updates. The fix — export the map from `p1-09` or move it to
  `src/lib/scanner/tools/domain-classifier.ts` — requires modifying `p1-09`,
  which was kept untouched in this epic to avoid risk to the existing P1 suite.
  Rationale for deferral: the impact is signal-quality degradation in `p5-05`
  (unknown-classified domains), not a correctness error on the legal-claim
  surface.

- **Reviewed non-English disclaimer translations.** The interactive report UI
  and PDF currently display the English disclaimer string in all five locales.
  The architecture supports per-locale strings once they are reviewed and added
  to the message catalogs. Deferred pending independent legal/translation review.

- **Remove or populate `ComplianceContext.accessibilityScoreSource`.** The field
  is defined in `types.ts` but `scanner/index.ts` does not populate it because
  `AccessibilityResult` does not expose a `scoreSource`. `p5-04` handles this
  gracefully (it treats `undefined` as fail-closed). The field is either dead
  code or a placeholder for a future `AccessibilityResult` enhancement. It
  should be removed or wired before the next P5 iteration to avoid misleading
  future readers.

- **E2E test execution in CI.** The 14 Playwright compliance specs require a
  running dev server and a seeded `COMPLIANCE_SCAN_ID` environment variable
  pointing to a P5-populated scan record. These must be added to the CI
  workflow (`test.yml`) with a server start step and a seed script before the
  `@critical` E2E invariants (no attestation language, disclaimer always present)
  are confirmed end-to-end.

## 8. References

**Task contracts**
- `pipeline/tasks/T-01.json` through `T-11.json` — implementation scope and
  acceptance criteria for each task
- `pipeline/tasks/FIX-01.json`, `FIX-02.json`, `FIX-03.json` — Phase-6
  condition-resolution contracts

**Review reports**
- `pipeline/reviews/security-compliance.md` — security audit (CONDITIONAL PASS,
  0C/0H/1M/2L)
- `pipeline/reviews/performance-compliance.md` — performance review (CONDITIONAL
  PASS, 0C/1H/2M/5L)
- `pipeline/reviews/architecture-compliance.md` — architecture review
  (CONDITIONAL PASS, 0H/3M/4L)
- `pipeline/reviews/synthesis.md` — cross-reviewer synthesis and conditions
- `pipeline/reviews/blast-radius-validation.md` — 17 changed files, 16 valid,
  1 unlinked (accepted)
- `pipeline/reviews/regression-triage.md` — 0 failures, 0 regressions
- `pipeline/reviews/automation-gate.md` — unit/integration: 1693 passing;
  E2E: CI-ONLY

**Key changed files**
- `src/lib/scanner/modules/p5-01-cookie-consent.ts`
- `src/lib/scanner/modules/p5-02-privacy-policy.ts`
- `src/lib/scanner/modules/p5-03-data-protection-headers.ts`
- `src/lib/scanner/modules/p5-04-wcag-attestation.ts`
- `src/lib/scanner/modules/p5-05-third-party-sharing.ts`
- `src/lib/scanner/modules/p5-06-user-rights.ts`
- `src/lib/scanner/modules/compliance.ts`
- `src/lib/scanner/compliance-shared.ts`
- `src/lib/scanner/index.ts`
- `src/app/[locale]/report/[id]/report-view.tsx`
- `src/app/[locale]/report/[id]/print/print-report.tsx`
- `messages/{en,hi,ml,es,de}.json`

**Planning artifacts**
- `pipeline/plan-internal.md` — Phase-1 plan, Red Team revisions, Gate-1
  decisions
- `pipeline/qa-checklist.md` — 11 critical / 21 functional / 10 non-blocker
  test scenarios
- `pipeline/risk_manifest.json` — HIGH risk, regulatory-claim-surface flag,
  feature-full lane
