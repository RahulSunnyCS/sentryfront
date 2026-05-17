# Phase 1 — Internal Plan (Compliance Module, P5-01…P5-06)

## Goal
Ship 6 privacy/transparency compliance modules as honest signal-gathering
checks, plus a non-binding, disclaimered framework-coverage indicator in the
report UI. No regulatory verdicts/attestations (CLAIMS_RULES / Phase 2.5.1).

## Hard constraints
- Findings state observable facts only; regulation refs are context, not verdicts.
- UI shows "X/N signals observed" with prominent "not legal advice / not an
  attestation" disclaimer (user-chosen framing).
- License CI must stay green: no new deps outside MIT/Apache-2.0/BSD/ISC/CC0.
  Do NOT wire axe-core (MPL-2.0, WARNING tier, currently unwired).
- 120s scan budget: P5 operates ONLY on already-crawled data. No new outbound
  requests in v1 (no SSRF surface added; content-quality fetch deferred).
- Flag-off output must be byte-identical to pre-feature (sibling pattern).

## Modules (all reuse existing crawl data; cheerio for DOM heuristics)
- P5-01 Cookie Consent: detect CMP (OneTrust/Cookiebot/Osano/Termly/Usercentrics/
  CookieYes/Didomi/Complianz/Klaro/Quantcast) via DOM + script-domain signals;
  flag non-essential cookies present (crawl.cookies + networkRequests) with no
  detected consent mechanism. Signal only.
- P5-02 Privacy Policy: locate privacy-policy link (footer/nav anchors + common
  href patterns) from crawled HTML only. Presence + prominence; content-quality
  check explicitly deferred (no extra fetch). 
- P5-03 Data-Protection Headers: re-interpret existing crawl.headers
  (HSTS/CSP/Referrer-Policy/Permissions-Policy/X-Content-Type-Options) under a
  data-protection lens. No new I/O.
- P5-04 WCAG Attestation: consume the Lighthouse accessibility score already
  computed by the P3 group (thread accessibilityResult into the orchestrator) +
  detect accessibility-statement link. Honest, no new dep.
- P5-05 Third-Party Data Sharing: reuse p1-09 domain classifier + crawl
  networkRequests/cookies to enumerate processors by category. Heuristic
  cross-check vs privacy-policy link presence (not content). Signal.
- P5-06 User Rights: detect auth surface + account/settings + "delete account"/
  "download/export data"/"Do Not Sell" affordances via DOM heuristics. Signal.

## Red-Team-driven revisions (folded in)
- **NO numeric score / no "GDPR 5/8" fraction.** Drop `complianceSignalScore`
  and any framework percentage — a quantified verdict reads as an attestation
  even when disclaimed. UI groups factual signals under framework *headings as
  context only* (e.g. "Cookie-consent signal: not observed"), never a
  pass-count or percentage. Exact indicator wording is the Gate-1 decision
  (reconciles the user's "non-binding indicator" choice with CLAIMS_RULES).
- **Every P5 module fails closed.** Absent/unreliable input ⇒ a neutral INFO
  "not evaluated" finding, NEVER a negative regulatory finding.
- **Consent/policy negatives gated on `crawl.renderMode === 'headless'`.** On
  fetch-only fallback (pre-JS HTML), emit INFO "could not evaluate (no rendered
  DOM)" — never "no consent banner". Use `crawl.networkRequests` for CMP script
  domains in addition to DOM.
- **P5-04 decoupled from execution order.** Consume `ScannerResult`-level
  accessibility score post-hoc; accept `accessibilityScore?: number` +
  `accessibilityScoreSource`. When accessibility did not genuinely run
  (caught error → 0, or scoreSource unavailable), emit "WCAG signal
  unavailable" — never a 0/100 "ADA risk" false positive.
- **P5-03 stripped of regulatory verdict framing** — "security headers relevant
  to data protection", no "GDPR Art. 32 non-compliant" language.
- **PDF path in scope.** Disclaimer must render in the PDF export too; strike
  "suitable for audits / due diligence" marketing from COMPLIANCE_MODULES.md.
- **Per-locale disclaimer reviewed**; if a locale string can't be verified,
  render the English disclaimer rather than an unreviewed MT string.

## Architecture
- New `src/lib/scanner/modules/compliance.ts` orchestrator
  `runComplianceModules(crawl, ctx): ComplianceResult` mirroring
  performance.ts/accessibility.ts/seo.ts wrappers; ctx carries the post-hoc
  accessibility score + source (no execution-order dependency).
- p5-01..p5-06 files each `runXxxModule(crawl, ctx?): RawFinding[]`, all
  fail-closed.
- scanner/index.ts: new feature-flagged group **appended last**, pure no-op
  when flag off; pushes findings + moduleFindingCounts['P5-Compliance'].
- ScannerResult gains ONLY optional `complianceFrameworkSummary` (per-framework
  list of {signal, observed:boolean|'not-evaluated'} — NO numbers/score), all
  optional for back-compat. Threaded through scan-worker + persisted shape +
  report types (decomposition maps exact files).
- features.ts: `complianceScanning` flag (Gate-1 decision: default true vs
  opt-in false).
- report-view.tsx: replace CompliancePlaceholder with a component grouping P5
  findings by category + a non-numeric signal list + an inline per-section
  "not legal advice / not an attestation" disclaimer (also in PDF).
- i18n: add strings to all 5 messages/*.json (reviewed disclaimer; English
  fallback if unverified).
- data.ts: add P5-01..P5-06 to SCAN_MODULES metadata.

## Acceptance criteria (hard)
- Byte-identical flag-off: corpus/snapshot diff test, flag off vs pre-feature.
- No new outbound requests (assert against crawl-only inputs in tests).
- Negative consent/policy findings impossible on `renderMode==='fetch-only'`.
- P5-04 emits no finding (or "unavailable") when accessibility didn't run.
- No numeric score or framework fraction anywhere (findings, UI, PDF).
- Disclaimer present in every locale and in the PDF export.

## Known limitations (surface at Gate 1)
- Presence/heuristic detection only; cannot verify policy *content* or backend
  consent enforcement. False negatives on custom CMPs / non-standard URLs.
- WCAG signal inherits Lighthouse-subset limitation (not full WCAG 2.2 AA).
- Single-page crawl: multi-page-only policy links may be missed.
- Fetch-only fallback yields "not evaluated" for DOM-dependent signals.

## Open Gate-1 decisions
1. Exact non-binding indicator wording (non-numeric signal list grouped by
   framework heading — confirm this satisfies the user's chosen framing).
2. `complianceScanning` default true (sibling-consistent) vs false (opt-in).
3. Confirm content-quality fetch deferral (recommended: defer — SSRF + budget).

## Internal score (post-revision)
Completeness 9 · Security depth 9 · Feasibility 9 · Clarity 8 → 8.5/10. Proceed.
