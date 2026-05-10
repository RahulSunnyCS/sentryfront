# Phase 9: Compliance & Legal Risk Detection — Technical Specification

**Version**: 1.0  
**Status**: Proposed  
**Owner**: Engineering  
**Estimated Duration**: 5–6 weeks

---

## Overview

Phase 9 adds **7 compliance detection modules** (P9-01 through P9-07) to identify legal and regulatory risks in deployed websites. These modules detect:

1. Open source license violations (GPL in commercial apps)
2. GDPR & privacy compliance issues
3. WCAG accessibility violations
4. PCI-DSS payment security
5. COPPA age verification
6. Copyright/trademark infringement
7. Third-party API terms of service violations

All modules follow the same architecture as Phase 1–4 security modules: passive detection with deterministic signals, LLM-enriched findings, and AI-ready fix prompts.

---

## Module Specifications

### P9-01: Open Source License Audit

**Module ID**: `P1-01-license-audit`  
**Category**: License Compliance  
**Input**: `CrawlResult`, exposed `package.json`, JS bundle comments  
**Output**: `Finding[]` with GPL/AGPL/restrictive license violations

#### Detection Logic

1. **Attempt to fetch `/package.json`**:
   ```typescript
   const pkgUrl = new URL('/package.json', crawl.finalUrl);
   const res = await fetch(pkgUrl);
   if (res.ok) {
     const pkg = await res.json();
     return analyzeDependencies(pkg.dependencies);
   }
   ```

2. **Parse sourcemap `sources` for `node_modules/` paths**:
   ```typescript
   // If sourcemap exposed, extract package names from paths like:
   // "node_modules/react/cjs/react.production.min.js"
   const packages = extractPackagesFromSourcemap(sourcemap);
   ```

3. **Scan JS bundle headers for license comments**:
   ```typescript
   const licensePattern = /\/\*!?\s*(Licensed under|License:|SPDX-License-Identifier:)\s*([A-Z0-9\-\.]+)/gi;
   const matches = bundle.content.match(licensePattern);
   ```

4. **For each detected package, query npm registry**:
   ```typescript
   const pkgMeta = await fetch(`https://registry.npmjs.org/${pkgName}/latest`);
   const license = pkgMeta.license; // "MIT", "GPL-3.0", etc.
   ```

5. **Flag violations**:
   - **CRITICAL**: GPL-2.0, GPL-3.0, AGPL-3.0 (copyleft in commercial context)
   - **HIGH**: Missing LICENSE file, missing attribution for MIT/BSD
   - **MEDIUM**: Non-commercial licenses (CC BY-NC, trial licenses)

#### Evidence Format

```json
{
  "moduleId": "P9-01",
  "severity": "CRITICAL",
  "category": "License Compliance",
  "title": "GPL-3.0 library in commercial application",
  "location": "node_modules/some-gpl-lib",
  "evidence": "Package: some-gpl-lib@1.2.3, License: GPL-3.0",
  "explanation": "GPL-3.0 is a copyleft license requiring your entire application source code to be open-sourced if distributed.",
  "impact": "Legal liability: copyright infringement, forced open-sourcing, potential lawsuits from library authors.",
  "fixManual": [
    "1. Replace some-gpl-lib with an MIT/Apache alternative",
    "2. Or: open-source your entire application under GPL-3.0",
    "3. Or: contact library author for commercial license"
  ],
  "fixAiPrompt": "Replace the GPL-3.0 library 'some-gpl-lib' with an MIT-licensed alternative. Search npm for similar packages with MIT or Apache-2.0 licenses."
}
```

#### Rate Limits & Caching

- npm registry API: 600 req/min (unauthenticated)
- Cache package metadata in Redis (TTL: 7 days)
- Batch requests: collect all package names, dedupe, fetch in parallel

---

### P9-02: GDPR & Privacy Compliance

**Module ID**: `P9-02-gdpr`  
**Category**: Privacy Compliance  
**Input**: `CrawlResult`, third-party scripts, cookies, localStorage  
**Output**: `Finding[]` with GDPR violations

#### Detection Logic

1. **Detect tracking scripts without consent banner**:
   ```typescript
   const trackers = [
     { name: 'Google Analytics', pattern: /google-analytics\.com\/analytics\.js|gtag\/js/ },
     { name: 'Meta Pixel', pattern: /connect\.facebook\.net\/.*\/fbevents\.js/ },
     { name: 'Hotjar', pattern: /static\.hotjar\.com/ },
   ];
   
   for (const tracker of trackers) {
     if (crawl.html.match(tracker.pattern)) {
       // Check for consent banner patterns
       const hasConsent = crawl.html.match(/cookiebot|onetrust|cookie-consent|gdpr-consent/i);
       if (!hasConsent) {
         findings.push({ severity: 'HIGH', title: `${tracker.name} without GDPR consent` });
       }
     }
   }
   ```

2. **Check for privacy policy**:
   ```typescript
   const privacyUrls = ['/privacy', '/privacy-policy', '/legal/privacy'];
   for (const url of privacyUrls) {
     const res = await fetch(new URL(url, crawl.finalUrl), { method: 'HEAD' });
     if (res.status === 200) {
       privacyPolicyExists = true;
       break;
     }
   }
   if (!privacyPolicyExists) {
     findings.push({ severity: 'HIGH', title: 'Missing privacy policy' });
   }
   ```

3. **Scan localStorage for PII without consent**:
   ```typescript
   // Phase 1-05 already captures storage; extend here
   const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
   for (const [key, value] of Object.entries(localStorage)) {
     if (emailPattern.test(value)) {
       findings.push({
         severity: 'MEDIUM',
         title: 'PII stored in localStorage without consent',
         location: key
       });
     }
   }
   ```

---

### P9-03: Accessibility (WCAG 2.1 AA)

**Module ID**: `P9-03-accessibility`
**Category**: Accessibility Compliance
**Input**: `CrawlResult.html` (DOM)
**Output**: `Finding[]` with WCAG violations

#### Detection Logic

Use **axe-core** library (Deque Systems, 4.10+):

```typescript
import { AxePuppeteer } from '@axe-core/puppeteer';
// Or for standalone HTML:
import { axe } from 'axe-core';

export async function runAccessibilityModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  // Run axe against HTML string
  const results = await axe.run(crawl.html, {
    runOnly: ['wcag2a', 'wcag2aa'],  // WCAG 2.1 Level A and AA
  });

  for (const violation of results.violations) {
    findings.push({
      moduleId: 'P9-03',
      severity: mapAxeSeverity(violation.impact), // critical → HIGH, serious → MEDIUM
      category: 'Accessibility',
      title: violation.help,
      location: violation.nodes[0]?.target.join(' > ') || 'page',
      evidence: violation.nodes[0]?.html || '',
      explanation: violation.description,
      impact: 'Users with disabilities cannot access this content. Violates ADA Title III, WCAG 2.1 AA.',
      fixManual: violation.nodes[0]?.failureSummary ? [violation.nodes[0].failureSummary] : [],
      fixAiPrompt: `Fix this accessibility violation: ${violation.help}. ${violation.description}`,
    });
  }

  return findings;
}

function mapAxeSeverity(impact: string): string {
  switch (impact) {
    case 'critical': return 'HIGH';
    case 'serious': return 'MEDIUM';
    case 'moderate': return 'LOW';
    default: return 'INFO';
  }
}
```

#### Common Violations Detected

- Missing `alt` attributes on `<img>`
- Color contrast < 4.5:1 for normal text, < 3:1 for large text
- Forms missing `<label>` or `aria-label`
- Missing ARIA landmarks (`role="main"`, `role="navigation"`)
- Keyboard focus issues (tab order, focus traps)

---

### P9-04: PCI-DSS Payment Form Compliance

**Module ID**: `P9-04-pci`
**Category**: Payment Security
**Input**: `CrawlResult.html`
**Output**: `Finding[]` with payment form violations

#### Detection Logic

```typescript
export async function runPCIModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const dom = new DOMParser().parseFromString(crawl.html, 'text/html');

  // Detect payment-related input fields
  const inputs = Array.from(dom.querySelectorAll('input'));
  const suspectInputs = inputs.filter(input => {
    const name = input.getAttribute('name') || '';
    const id = input.getAttribute('id') || '';
    const combined = (name + id).toLowerCase();
    return /card|cvv|credit|expir|cvc|security.?code/.test(combined);
  });

  if (suspectInputs.length === 0) return findings; // No payment form detected

  // Check if inputs are inside Stripe Elements iframe
  const hasStripeElements = crawl.html.includes('js.stripe.com') &&
                            crawl.html.includes('<iframe') &&
                            crawl.html.includes('stripe');

  const hasPayPalSDK = crawl.html.includes('paypal.com/sdk/js');

  if (!hasStripeElements && !hasPayPalSDK) {
    findings.push({
      moduleId: 'P9-04',
      severity: 'CRITICAL',
      category: 'Payment Security',
      title: 'Credit card form without PCI-compliant tokenization',
      location: suspectInputs.map(i => i.getAttribute('name')).join(', '),
      evidence: suspectInputs[0]?.outerHTML || '',
      explanation: 'Raw credit card data is being collected in plain HTML forms without Stripe Elements or PayPal SDK. This violates PCI-DSS requirements.',
      impact: 'Loss of payment processing ability, fines $5,000–$100,000/month, liability for card data breaches.',
      fixManual: [
        '1. Remove raw card number input fields',
        '2. Integrate Stripe Elements or PayPal Checkout SDK',
        '3. Never send raw card data to your server'
      ],
      fixAiPrompt: 'Replace this raw credit card form with Stripe Elements. Use the official Stripe.js library to create a secure iframe for card collection.',
    });
  }

  return findings;
}
```

---

## Implementation Plan

### Week 1: Setup & P9-01
- Add dependencies: `axe-core`, `spdx-license-list`, `validator`
- Create `src/lib/scanner/modules/compliance/` directory
- Implement P9-01 (license audit)
- Unit tests with fixture package.json files

### Week 2: P9-02 & P9-03
- Implement P9-02 (GDPR)
- Implement P9-03 (accessibility with axe-core)
- Integration tests

### Week 3: Report UI
- Add "Compliance" tab to report page
- Update grading algorithm to include compliance
- LLM prompt updates for compliance fix generation

### Week 4–5: Phase 9B Modules
- P9-04 (PCI-DSS)
- P9-05 (COPPA)
- P9-06 (Copyright)
- P9-07 (API ToS)

### Week 6: Polish & Launch
- False positive tuning
- White-label compliance reports (Agency tier)
- Documentation updates
- Marketing materials

---

## Database Schema Changes

**Option A**: Extend `Finding` model with `category` enum:

```prisma
enum FindingCategory {
  SECURITY
  COMPLIANCE
}

model Finding {
  // ... existing fields
  category FindingCategory @default(SECURITY)
}
```

**Option B**: No schema change, use `moduleId` prefix (`P9-*` = compliance)

**Recommendation**: Option B (simpler, no migration needed)

---

## Cost Analysis

### Development Cost
- **5–6 engineer-weeks** (one developer, full-time)

### Operational Cost per Scan
- axe-core: client-side library, zero cost
- npm registry API: free tier, 600 req/min
- LLM token increase: +500 tokens/scan = +$0.005
- **Total: ~$0.01/scan**

### Revenue Impact
- Pro tier conversion: +20% (estimated)
- Average Pro LTV: $49/mo × 6 months = $294
- Break-even: 2–3 Pro conversions cover entire dev cost

---

## Success Criteria

### Launch (Phase 9A Complete)
- ✅ All 3 modules (P9-01, P9-02, P9-03) deployed to production
- ✅ < 10% false positive rate on compliance findings
- ✅ "Compliance" tab renders correctly in reports
- ✅ 30%+ of scans surface at least one compliance finding

### Post-Launch (30 days)
- ✅ Compliance findings shared at 1.5x+ rate vs security findings
- ✅ Zero customer complaints about false positives
- ✅ Pro tier mentions "compliance" in 20%+ of signup reasons

---

## Open Questions

1. **Should compliance findings affect the overall grade (A–F)?**
   - Option A: Separate grades (Security: B, Compliance: D)
   - Option B: Weighted combined (75% security, 25% compliance)
   - **Recommendation**: Option B for simplicity

2. **Should we scan privacy policies with LLM for GDPR language?**
   - Pros: High accuracy, catches missing clauses
   - Cons: +1,500 tokens/scan (+$0.015 cost)
   - **Recommendation**: Phase 9B only (optional deep scan)

3. **White-label compliance reports for Agency tier?**
   - **Recommendation**: Yes, Phase 9B deliverable

---

## Next Actions

1. ✅ Review and approve this spec
2. Create tracking issues for each module (P9-01 through P9-07)
3. Add dependencies to `package.json`
4. Prototype P9-01 (license audit) as proof-of-concept
5. Update PRD with compliance positioning
