# VibeSafe Compliance Feature Analysis

## Executive Summary

Adding a **Compliance & Legal Risk** detection module to VibeSafe is **highly valuable** and directly aligned with the product vision. AI-assisted "vibe coding" tools frequently introduce compliance violations that non-technical builders are completely unaware of—from GPL license violations to GDPR data processing issues to accessibility law non-compliance.

This document analyzes the compliance risks introduced by vibe-coded websites and proposes **Phase 9: Compliance & Legal Risk Detection** as a natural extension of the passive scanning tier.

---

## Compliance Issues in Vibe-Coded Applications

### 1. **Open Source License Violations** (CRITICAL)

**Risk**: LLMs copy-paste GPL/AGPL-licensed code when asked to "build a payment form" or "add a chart library," embedding it into proprietary commercial products without attribution or source disclosure.

**Common violations**:
- GPL/AGPL libraries bundled in closed-source commercial apps
- Missing license attribution (required by MIT, BSD, Apache 2.0)
- Copyleft contamination (GPL code forces entire codebase to be GPL)
- Using trial/non-commercial libraries (e.g., Highcharts, AG Grid) without paid license

**Detection method**:
- Parse `package.json` / `yarn.lock` / `package-lock.json` dependencies
- Cross-reference against SPDX license database
- Flag: GPL-2.0, GPL-3.0, AGPL-3.0 in commercial context
- Scan for missing LICENSE files or attribution comments
- Check for "non-commercial" or "trial" licenses via npm package metadata

**Severity**: CRITICAL (legal liability, forced open-sourcing, copyright infringement lawsuits)

### 2. **GDPR & Privacy Compliance** (HIGH)

**Risk**: AI-built sites collect emails, analytics, cookies without proper consent mechanisms or privacy policies.

**Common violations**:
- Google Analytics / Meta Pixel without cookie consent banner (illegal in EU)
- Email collection without explicit consent checkbox
- Missing or auto-generated privacy policy (LLM hallucinations)
- No cookie policy or "Do Not Track" support
- Data transferred to US servers without SCCs (Standard Contractual Clauses)
- localStorage storing PII without encryption or consent

**Detection method**:
- Scan for third-party tracking scripts (Google Analytics, Facebook Pixel, Hotjar, Mixpanel)
- Check for cookie consent banner implementation (CookieBot, OneTrust patterns)
- Verify `<a href="/privacy">` exists and returns 200
- Flag localStorage/cookies containing email addresses, IP, usernames without consent UI
- Check for GDPR-required text: "right to erasure," "data controller," "lawful basis"

**Severity**: HIGH (€20M or 4% annual revenue fines under GDPR)

### 3. **Accessibility Violations (ADA, WCAG 2.1)** (MEDIUM-HIGH)

**Risk**: LLM-generated HTML frequently fails WCAG AA standards, exposing site owners to ADA lawsuits (especially in e-commerce).

**Common violations**:
- Missing `alt` attributes on images
- Insufficient color contrast (text on backgrounds)
- Forms without `<label>` or `aria-label`
- Keyboard navigation broken (modals, dropdowns)
- Missing ARIA landmarks, roles
- Auto-playing video/audio without controls

**Detection method**:
- Run axe-core accessibility engine against rendered DOM
- Check contrast ratios via WCAG formula
- Verify `<img>` tags have non-empty `alt` attributes
- Test keyboard navigation paths (tab order, focus traps)
- Flag missing semantic HTML (`<button>` vs `<div onclick>`)

**Severity**: MEDIUM-HIGH (ADA Title III lawsuits average $10K–$75K settlements in US)

### 4. **PCI-DSS Violations** (CRITICAL for e-commerce)

**Risk**: LLMs build payment forms that handle raw credit card numbers client-side, violating PCI-DSS.

**Common violations**:
- `<input type="text" name="credit_card">` capturing raw card numbers
- Storing CVV in localStorage or cookies
- Sending card data to non-PCI-compliant backend
- Not using Stripe Elements / PayPal SDK (embedded iframe isolation)

**Detection method**:
- Scan HTML for `<input>` fields with names/IDs: `card_number`, `cvv`, `expiry`, `credit_card`
- Flag if NOT inside Stripe Elements iframe or PayPal SDK
- Check for `type="password"` on CVV fields (insecure)
- Verify Stripe.js / PayPal SDK presence when payment form detected

**Severity**: CRITICAL (PCI-DSS violations = loss of payment processing, $5K–$100K/month fines)

### 5. **Age Verification & COPPA** (MEDIUM)

**Risk**: Sites targeting children (<13 in US, <16 in EU) collect data without parental consent.

**Common violations**:
- Sign-up forms without age gate
- Analytics/advertising on kids' content without COPPA certification
- Social login (Google/Facebook) for minors

**Detection method**:
- Detect "kids," "children," "school," "education" in meta tags, content
- Check for age gate (`<input type="number" name="age">` or "Are you 13+?")
- Flag Google Analytics on educational/kids sites without age verification

**Severity**: MEDIUM (COPPA fines up to $50,120 per violation)

### 6. **Trademark & Copyright Infringement** (MEDIUM)

**Risk**: LLMs use copyrighted images, logos, brand names when asked to "make it look professional."

**Common violations**:
- Stock photos used without license (Shutterstock watermark removal)
- Competitor logos in "as seen on" sections
- Font files (Google Fonts OK, commercial fonts not)
- Brand name misuse ("Powered by Apple" when not authorized)

**Detection method**:
- Reverse image search via Google Vision API or TinEye
- OCR text in images to detect watermarks
- Cross-reference logo URLs against known trademark databases
- Flag commercial font file URLs (MyFonts, Adobe Fonts) vs free (Google Fonts)

**Severity**: MEDIUM (DMCA takedowns, trademark lawsuits $10K–$100K+)

### 7. **Terms of Service Violations (Third-Party APIs)** (LOW-MEDIUM)

**Risk**: Using free-tier APIs beyond quota or for prohibited use cases.

**Common violations**:
- Google Maps API used commercially on free tier
- OpenAI API for content generation violating usage policies
- Scraping APIs (Twitter, Instagram) without authorization

**Detection method**:
- Detect Google Maps, Stripe, Twilio, OpenAI API keys
- Check for `api.openai.com` calls without API key visibility controls
- Flag known free-tier-only APIs on commercial sites

**Severity**: LOW-MEDIUM (account termination, service disruption)

---

## Value Proposition for VibeSafe

Adding compliance checks provides **immediate differentiation**:

1. **No competitor offers this**: Snyk scans CVEs, not licenses. No tool scans deployed sites for GDPR/PCI violations.
2. **High willingness-to-pay**: Legal liability >> security bugs. A $20K ADA lawsuit >> a XSS vulnerability.
3. **Natural fit for target audience**: Solo founders and agencies **don't know** they're violating GPL or COPPA.
4. **Viral loop**: "Your site violates GDPR" is extremely shareable.
5. **Upsell path**: Compliance reports justify Pro tier ($49/month) for ongoing monitoring.

---

## Proposed: Phase 9 — Compliance & Legal Risk Detection

**Goal**: Detect license, privacy, accessibility, and regulatory violations in deployed websites.

**Duration**: 3–4 weeks

**Prerequisite**: Phase 4 complete (all passive detection modules working)

---

## Detection Modules (P9-01 through P9-07)

### P9-01: Open Source License Audit
- **Input**: `package.json`, `package-lock.json` (if exposed via sourcemaps or dev endpoints)
- **Detection**: Parse dependencies → query SPDX license database → flag GPL/AGPL/restrictive licenses
- **Fallback**: Scan JS bundles for license comments (`/*! Licensed under GPL */`)
- **Severity**: CRITICAL (GPL/AGPL), HIGH (missing attribution), MEDIUM (outdated/vulnerable)

### P9-02: GDPR & Privacy Compliance
- **Input**: DOM, third-party scripts, cookies, localStorage
- **Detection**:
  - Tracking scripts without consent banner
  - Missing `/privacy` or `/cookie-policy` links (404 check)
  - localStorage with PII (email regex) without consent UI
  - Missing required GDPR language in privacy policy (via LLM extraction)
- **Severity**: HIGH

### P9-03: Accessibility (WCAG 2.1 AA)
- **Input**: DOM
- **Detection**: Run axe-core, flag violations:
  - Missing `alt` attributes
  - Color contrast < 4.5:1
  - Forms without labels
  - Missing ARIA landmarks
- **Severity**: MEDIUM-HIGH

### P9-04: PCI-DSS Payment Form Compliance
- **Input**: DOM, form fields
- **Detection**:
  - `<input>` with name/id containing "card", "cvv", "credit" outside Stripe Elements iframe
  - Raw card number handling without PCI-compliant tokenization
  - Missing Stripe.js / PayPal SDK when payment form detected
- **Severity**: CRITICAL

### P9-05: Age Verification & COPPA
- **Input**: DOM, meta tags, content analysis
- **Detection**:
  - Content targeting children (keywords: "kids", "school", "education")
  - Missing age gate on sign-up forms
  - Third-party analytics/ads on children's content
- **Severity**: MEDIUM

### P9-06: Copyright & Trademark Infringement
- **Input**: Images, logos, fonts
- **Detection**:
  - Reverse image search for stock photos with watermarks
  - Commercial font files (non-Google Fonts)
  - Unauthorized brand name usage in meta tags
- **Severity**: MEDIUM

### P9-07: Third-Party API ToS Violations
- **Input**: Detected API keys, network calls
- **Detection**:
  - Google Maps API on free tier for commercial use
  - OpenAI API usage patterns violating policy
  - Excessive API calls indicating free-tier abuse
- **Severity**: LOW-MEDIUM

---

## Implementation Approach

### Data Sources

1. **Package manifest exposure**:
   - Check for `/package.json` at root (exposed in misconfigured builds)
   - Parse sourcemap `sources` field for `node_modules/*/package.json` paths
   - Detect libraries from JS bundle signatures (React version comments, etc.)

2. **Third-party script detection** (already built in P1-09):
   - Reuse existing module, extend with compliance context
   - Match against compliance databases (GDPR-required consent for GA, Meta Pixel)

3. **DOM analysis** (already captured in crawler):
   - Extend with axe-core accessibility engine
   - Pattern matching for payment forms, age gates, privacy links

4. **License databases**:
   - SPDX License List (JSON API): https://spdx.org/licenses/
   - npm registry API for package metadata: `https://registry.npmjs.org/<package>/latest`
   - Licensee gem (GitHub): https://github.com/licensee/licensee

5. **GDPR text corpus**:
   - Pre-built regex patterns for required GDPR language
   - LLM-assisted privacy policy analysis (Phase 5 integration)

### Technical Architecture

**Phase 9 fits cleanly into existing pipeline**:

```
Crawl Phase (unchanged)
    ↓
Detection Modules (add P9-01 to P9-07)
    ↓
LLM Enrichment (compliance findings get specialized prompts)
    ↓
Report (new "Compliance" tab alongside "Security")
```

### New Dependencies

```json
{
  "axe-core": "^4.10.2",              // WCAG accessibility checks
  "spdx-license-list": "^6.9.0",      // License validation
  "validator": "^13.12.0"              // Email/URL pattern matching
}
```

### Report UX Changes

**New "Compliance" tab** in report dashboard:

```
┌─────────────────────────────────────────────┐
│  Security (12) │ Compliance (5) │ Summary  │  ← New tab
├─────────────────────────────────────────────┤
│ CRITICAL: GPL-3.0 library in commercial app │
│ HIGH: Google Analytics without consent      │
│ MEDIUM: 8 WCAG AA violations                │
│ MEDIUM: Missing privacy policy              │
│ INFO: Non-commercial font detected          │
└─────────────────────────────────────────────┘
```

### Grading Impact

**Option A**: Separate compliance grade (C-SEC: A, C-LEGAL: D)
**Option B**: Unified grade with compliance weighted at 75% of security weight
**Recommendation**: Option B — "Grade: D (Security: B, Compliance: D)" to maintain single headline score

---

## Cost-Benefit Analysis

### Development Cost
- **3–4 weeks** for 7 modules (similar complexity to P1 modules)
- **1 week** for LLM prompt specialization (compliance fix prompts)
- **1 week** for report UX updates (new tab, grading changes)
- **Total: 5–6 weeks**

### Incremental Operational Cost
- **axe-core**: client-side library, zero runtime cost
- **SPDX license checks**: local JSON file lookup, zero API cost
- **npm registry API**: rate-limited but free for <600 req/min
- **LLM cost increase**: +500 tokens per scan = +$0.005/scan (negligible)
- **Total incremental cost per scan: ~$0.01**

### Revenue Impact
- **Pro tier value prop strengthened**: "Security + Compliance monitoring" justifies $49/month vs $29 one-shot
- **Agency tier differentiation**: White-label compliance reports for client deliverables
- **New customer segment**: Legal/compliance-conscious founders (higher WTP)
- **Estimated ARR lift: +30–50%** from improved conversion and reduced churn

---

## Competitive Landscape

| Tool | Security | Licenses | GDPR | Accessibility | Our Advantage |
|------|----------|----------|------|---------------|---------------|
| Snyk | ✅ CVEs | ✅ License scan (repo) | ❌ | ❌ | We scan deployed site + GDPR |
| FOSSA | ❌ | ✅ License compliance | ❌ | ❌ | We add security + live site scan |
| OneTrust | ❌ | ❌ | ✅ Cookie consent | ❌ | We add security + accessibility |
| axe DevTools | ❌ | ❌ | ❌ | ✅ Manual only | We automate + add other checks |
| **VibeSafe** | ✅ 15 modules | ✅ Deployed | ✅ GDPR | ✅ WCAG | **All-in-one** |

**Key insight**: No competitor offers **automated compliance scanning of deployed websites**. Snyk/FOSSA require repo access. OneTrust requires manual setup. Axe is browser-only.

---

## Risks & Mitigations

### Risk 1: False Positives on License Detection
**Impact**: Flagging MIT libraries as GPL due to transitive dependencies
**Mitigation**: Build dependency tree, only flag direct dependencies; provide "Review in package.json" link

### Risk 2: GDPR Interpretation Varies by Jurisdiction
**Impact**: Claimed violation may not apply in user's country
**Mitigation**: Findings include disclaimer: "Consult legal counsel for your jurisdiction"; focus on EU GDPR as baseline

### Risk 3: Accessibility Checks Require Human Judgment
**Impact**: axe-core detects technical violations but not UX/comprehension issues
**Mitigation**: Label findings as "Automated accessibility check — manual review recommended"

### Risk 4: PCI-DSS Liability if Scan Misses Violation
**Impact**: Site owner relies on our scan, still processes cards incorrectly, faces fine
**Mitigation**: ToS: "VibeSafe is an informational tool, not legal/compliance advice"

---

## Recommended Phasing

### Phase 9A: Core Compliance (Weeks 1–3)
- P9-01: License audit
- P9-02: GDPR basics (tracking without consent, missing privacy policy)
- P9-03: Accessibility (axe-core integration)
- Report "Compliance" tab

### Phase 9B: Advanced Compliance (Weeks 4–6)
- P9-04: PCI-DSS payment forms
- P9-05: COPPA age verification
- P9-06: Copyright infringement
- P9-07: API ToS violations
- LLM-assisted privacy policy analysis
- White-label compliance reports for Agency tier

---

## Success Metrics

**Launch (First 90 Days)**:
- 30%+ of scans surface at least one compliance finding
- Compliance findings shared at 2x rate of security findings (higher virality)
- Pro tier conversion increases by 20% ("I need ongoing GDPR monitoring")

**Growth (Months 4–12)**:
- "Compliance" becomes top-3 feature in user surveys
- Agency tier adoption increases (compliance reports for clients)
- Partnership with legal tech platforms (Ironclad, Juro) for referrals

---

## Conclusion

**Recommendation: Proceed with Phase 9 immediately after Phase 5 (LLM enrichment)**

### Why This Adds Value:
1. ✅ **Market gap**: No competitor scans deployed sites for GDPR + licenses + accessibility
2. ✅ **High urgency**: Legal liability > security bugs for non-technical founders
3. ✅ **Natural audience fit**: Vibe coders don't know they're violating GPL or COPPA
4. ✅ **Low implementation cost**: Reuses existing crawler, adds 7 modules (3–4 weeks)
5. ✅ **High revenue impact**: Strengthens Pro tier value prop, opens agency market

### Sequencing:
- **Phase 5**: LLM enrichment (needed for GDPR policy analysis)
- **Phase 9A**: Core compliance (licenses, GDPR, accessibility) ← **High priority**
- **Phase 6**: Monetization (Stripe, pricing)
- **Phase 9B**: Advanced compliance (PCI, COPPA, copyright)
- **Phase 7**: Hardening
- **Phase 8**: Active testing

---

**Next Steps**:
1. ✅ Review and approve this analysis
2. Create detailed technical spec for Phase 9A modules
3. Add Phase 9 to PHASES.md roadmap
4. Prototype P9-01 (license audit) as proof-of-concept
