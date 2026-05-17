SECURITY AUDIT REPORT — VibeSafe Compliance Feature (P5 modules)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Branch: claude/compliance-module-eEtca
Scope: P5-01..P5-06, compliance.ts, scanner/index.ts, types.ts,
       features.ts, data.ts, report-view.tsx, print-report.tsx, messages/*

INVARIANT CHECKS (the five focus areas)

1. NO OUTBOUND NETWORK REQUEST — CONFIRMED CLEAN
   Grep across all P5 modules + compliance.ts for fetch/axios/http/https/net/
   dns/child_process/page.goto/playwright/crawl() returned ZERO real calls —
   only comments that mention the word "fetch" while describing crawl-data
   provenance. Every module is a pure synchronous function over the already-
   populated CrawlResult (html/renderedHtml/cleanedHtml, headers, cookies,
   jsBundleUrls, networkRequests) and ComplianceContext. P5-02/P5-05 even
   document SSRF avoidance as an explicit non-goal. URL() is used only for
   parsing (hostname/pathname extraction), never for fetching. The #1
   invariant holds.

2. UNTRUSTED-INPUT HANDLING — ACCEPTABLE
   cheerio.load() is used on attacker-controlled HTML in P5-01/02/04/05/06.
   cheerio (htmlparser2) does not execute scripts or fetch sub-resources, so
   parsing hostile HTML is safe. P5-05's hasPrivacyPolicyLink wraps cheerio in
   try/catch; the orchestrator wraps every module in safeRun() try/catch so a
   parser throw cannot crash the scan. All loops are bounded by crawl data
   ($('a').each, cookies, jsBundleUrls, networkRequests, CHECKS) — no
   unbounded iteration. Regexes reviewed for ReDoS: PRIVACY_TEXT_RE,
   A11Y_*_RE, AUTH_*_RE, DELETE/EXPORT/DNS_RE, the cookie-name patterns, and
   isHstsStrong's /max-age\s*=\s*(\d+)/ are all simple alternations / bounded
   quantifiers with no nested or overlapping repetition — no catastrophic
   backtracking. No ReDoS finding.

3. XSS / UNSANITISED RENDERING — CONFIRMED CLEAN
   No dangerouslySetInnerHTML anywhere in report-view.tsx, print-report.tsx,
   or finding-card.tsx. Every scanned-site-derived string (finding.title,
   .explanation, .evidence, .location, sig.label) is rendered as a JSX text
   child, which React auto-escapes. The compliance section renders only
   title/explanation; finding-card.tsx (lines 59, 81) and print-report.tsx
   (lines 207-226) render location/evidence as escaped text / inside <pre>.
   No href/src/title sink is fed a scanned-site value. No stored or reflected
   XSS.

4. SECRET / PII LEAKAGE IN EVIDENCE — ONE REAL GAP (see FINDING 1)
   P5-01 echoes cookie NAMES only (never values) — safe. P5-05 echoes
   third-party HOSTNAMES only — safe. P5-03 echoes raw HTTP header VALUES for
   HSTS/CSP/Referrer-Policy/Permissions-Policy — these are config headers, not
   credentials, low risk. The real gap: P5-02 and P5-04 capture and echo the
   RAW scanned-site anchor href (and P5-02 the raw link text) into
   finding.evidence / finding.location. hrefMatchesPrivacy() strips the query
   string for *matching* only — the stored value keeps the full URL including
   any ?token=/?email=/?session= query parameters. lib/llm/enrichment.ts
   deliberately runs maskSensitiveText() over evidence before sending to the
   LLM (masks JWTs, sk_/pk_/whsec_ keys, Set-Cookie, Authorization, emails).
   The persisted-finding → report-UI / PDF path applies NO equivalent masking,
   so a privacy/accessibility link of the form
   /privacy?email=user@x.com&reset_token=abc... is stored verbatim and
   rendered into the HTML report and the exported PDF.

5. LEGAL-CLAIM (SIGNAL-ONLY) INVARIANT — CONFIRMED CLEAN
   ComplianceSignal.status is a string union 'observed' | 'not-observed' |
   'not-evaluated' — no numeric field exists, so a score/fraction/percentage
   is structurally impossible to emit. compliance.ts computes no count/ratio.
   P5-04 buckets the Lighthouse score into qualitative tiers and never
   surfaces the raw number as a verdict; it is fail-closed on absent/zero
   scores. All modules use "observation, not a verdict" language and disclaim
   regulatory conclusions. report-view/print-report render neutral status
   chips and an explicit non-attestation disclaimer badge. Invariant holds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINDINGS

FINDING 1: Unmasked scanned-site URL echoed into persisted evidence (PII/token leak)
Severity: Medium
File and line:
  - src/lib/scanner/modules/p5-02-privacy-policy.ts:100-101, 131-134
    (foundHref = href; location: foundHref; evidence includes raw foundHref +
     foundText)
  - src/lib/scanner/modules/p5-04-wcag-attestation.ts:49, 141-142, 174-176
    (found = href; statementNote embeds raw a11yStatementHref into evidence)
What it is: Both modules capture the raw href attribute of an anchor from the
  scanned site and write it verbatim into finding.evidence / finding.location.
  The query string is never stripped before storage (it is stripped only for
  the path-matching comparison). These findings are persisted to the database
  and rendered into the HTML report and the exported PDF with no masking. The
  codebase already recognises this class of risk: lib/llm/enrichment.ts runs
  maskSensitiveText() over the identical evidence field before it leaves the
  system to the LLM, masking JWTs, Stripe keys, cookies, Authorization
  headers, and emails. The report/PDF sink does not.
Why it matters: A scanned site may legitimately link to URLs that carry
  sensitive query parameters (password-reset tokens, signed URLs, session
  IDs, email addresses, e.g. /privacy?email=jane@acme.com&t=eyJ...). For a
  link the scanner *follows by pattern* (privacy/accessibility), that value is
  then frozen into the report artifact and the downloadable PDF, where it can
  be shared, indexed, or exfiltrated — exposing third-party PII/secrets that
  VibeSafe captured during the scan. It is the same threat enrichment.ts
  defends against, applied inconsistently across output sinks.
How to fix it: Before writing href into evidence/location, normalise it the
  same way: parse with URL() and reconstruct origin+pathname only (drop search
  and hash), OR route P5 evidence through the existing maskSensitiveText()
  helper from lib/llm/enrichment.ts (export and reuse it — single source of
  truth). Strip query/fragment from foundHref (P5-02) and a11yStatementHref
  (P5-04). Also truncate foundText to a sane cap (defence-in-depth against a
  pathological multi-KB anchor text bloating every report).

FINDING 2: Raw HTTP header values rendered into report without length cap
Severity: Low
File and line: src/lib/scanner/modules/p5-03-data-protection-headers.ts:298-304
What it is: weakEvidence echoes the full raw value of CSP / Referrer-Policy /
  Permissions-Policy / HSTS headers into evidence. These are not credentials,
  but a hostile or misconfigured origin can return an arbitrarily large header
  value, which is then persisted and rendered verbatim in the report and PDF.
  No length bound is applied (compare: the codebase added C-35 specifically to
  length-cap untrusted parsed strings "at the parse chokepoint").
Why it matters: Not a confidentiality issue (config headers), but an
  unbounded attacker-controlled string in a persisted/rendered field is a
  denial-of-quality / report-bloat vector and is inconsistent with the C-35
  hardening already adopted elsewhere in the scanner.
How to fix it: Cap the rendered header value (e.g. value.slice(0, 300) + '…')
  in weakEvidence before interpolation, mirroring the C-35 pattern.

FINDING 3: Client-side compliance derivation duplicated in three places
Severity: Low
File and line: src/lib/scanner/modules/compliance.ts:49-69 (deriveStatus),
  duplicated in src/app/[locale]/report/[id]/report-view.tsx
  (deriveComplianceStatus) and src/app/[locale]/report/[id]/print/
  print-report.tsx (derivePrintComplianceStatus).
What it is: The string-matching rule that turns a finding into a signal
  status is reimplemented three times with "keep in sync" comments. Not a
  vulnerability today, but the legal-claim invariant (signal-only) depends on
  these three implementations staying byte-identical. A future divergence
  could cause the UI/PDF to display a different signal than the server
  derived — on a regulatory-claim surface this is a correctness/legal-risk
  amplifier, not just a code-smell.
Why it matters: The whole feature's safety rests on consistent, conservative
  status derivation. Three hand-synced copies is a latent integrity risk on a
  high-stakes surface.
How to fix it: Extract the derivation into one shared, pure, unit-tested
  module imported by server, report-view, and print-report. Add a test that
  asserts the three previously-separate paths produce identical output for a
  fixed finding corpus.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
Critical: 0
High    : 0
Medium  : 1
Low     : 2
Overall verdict: CONDITIONAL PASS

The four highest-stakes invariants are clean: zero outbound requests
(the #1 design constraint), no XSS (React-escaped, no dangerouslySetInnerHTML),
no ReDoS, and the signal-only legal-claim invariant is structurally enforced
by the type system. The single Medium (Finding 1) is a real PII/secret-
leakage gap that the codebase already defends against on the LLM path but not
on the persisted-report/PDF path — it must be fixed before this ships
(strip query/fragment from echoed hrefs, or reuse the existing
maskSensitiveText helper). Findings 2 and 3 are Low hardening/integrity items.
Conditional on resolving Finding 1 (Medium), this feature is sound.
