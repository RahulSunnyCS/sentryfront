# Third-Party Software Notices and Licenses

**Last Updated:** 2026-05-11  
**Product:** VibeSafe Web Security Scanner  
**Version:** 0.1.0

This document contains notices and attribution for third-party software included in or used by VibeSafe.

---

## License Summary

VibeSafe uses the following open-source packages. All licenses are permissive (MIT, Apache 2.0, ISC, BSD) and compatible with commercial use.

### ✅ Production Dependencies

| Package | Version | License | Usage | Status |
|---------|---------|---------|-------|--------|
| **Next.js** | 14.2.29 | MIT | Web framework, API routes, frontend | ✅ Approved |
| **React** | 18.x | MIT | UI framework | ✅ Approved |
| **Prisma** | 5.22.0 | Apache 2.0 | Database ORM, type-safe queries | ✅ Approved |
| **Playwright** | 1.59.1 | Apache 2.0 | Browser automation, crawling | ✅ Approved |
| **Lighthouse** | 12.8.2 | Apache 2.0 | Performance, A11y, SEO auditing | ✅ Approved |
| **chrome-launcher** | 1.2.1 | Apache 2.0 | Chrome/Chromium management | ✅ Approved |
| **NextAuth.js** | 4.24.11 | ISC | Authentication (OAuth, magic links) | ✅ Approved |
| **Stripe SDK** | 17.5.0 | MIT | Payment processing integration | ✅ Approved |
| **BullMQ** | 5.76.6 | MIT | Job queue (Redis-backed workers) | ✅ Approved |
| **Redis (node-redis)** | 5.12.1 | MIT | Redis client for caching, pub/sub | ✅ Approved |
| **AWS SDK S3** | 3.709.0 | Apache 2.0 | S3-compatible storage (R2 uploads) | ✅ Approved |
| **Sentry Next.js** | 8.45.1 | MIT | Error tracking, monitoring | ✅ Approved |

### ✅ Development Dependencies

| Package | Version | License | Usage | Status |
|---------|---------|---------|-------|--------|
| **TypeScript** | 5.x | Apache 2.0 | Type safety, development | ✅ Approved |
| **Vitest** | 4.1.5 | MIT | Test framework | ✅ Approved |
| **Testing Library** | 16.3.2 | MIT | React component testing | ✅ Approved |
| **ESLint** | 8.x | MIT | Code linting | ✅ Approved |
| **Prettier** | 3.x | MIT | Code formatting | ✅ Approved |
| **Tailwind CSS** | 3.3.0 | MIT | CSS utility framework | ✅ Approved |
| **Autoprefixer** | 10.x | MIT | CSS vendor prefixing | ✅ Approved |
| **PostCSS** | 8.x | MIT | CSS processing | ✅ Approved |
| **happy-dom / jsdom** | 20.9.0 / 29.1.1 | MIT | DOM testing utilities | ✅ Approved |

---

## Browser Redistribution Notice

**Playwright** downloads and redistributes Chromium browser binaries (licensed under BSD 3-Clause).

- **Usage:** Headless browser for web crawling and screenshot capture
- **Redistribution:** Permitted under Apache 2.0 license for Playwright; Chromium binaries are BSD-licensed
- **Attribution:** Chromium is a trademark of Google LLC
- **Compliance:** VibeSafe uses the official Playwright distribution; no modifications to browser binaries

---

## Scanner Rule Provenance

VibeSafe's security detection modules use the following external datasets:

### **Secret Detection Patterns**
- **Source:** Original patterns developed for VibeSafe
- **Inspiration:** Public OWASP guidelines, industry-standard regex patterns
- **License:** Proprietary to VibeSafe (original work)
- **Attribution:** Not required (no third-party rules copied)

### **Subdomain Takeover Fingerprints**
- **Source:** Original fingerprints for 14 platforms (GitHub Pages, Heroku, Netlify, Vercel, AWS S3, etc.)
- **Methodology:** Public documentation from hosting providers
- **License:** Proprietary to VibeSafe
- **Attribution:** Not required

### **Sensitive Path Lists**
- **Source:** Original compilation based on common web frameworks
- **Inspiration:** Public framework documentation (Next.js, Django, Rails, Laravel, WordPress)
- **License:** Proprietary to VibeSafe
- **Attribution:** Not required

### **WCAG 2.2 Guidelines**
- **Source:** W3C Web Content Accessibility Guidelines 2.2
- **License:** W3C Software and Document License (permissive)
- **Usage:** Reference implementation for accessibility checks
- **Attribution:** © 2023 World Wide Web Consortium (W3C®)
- **Link:** https://www.w3.org/TR/WCAG22/

---

## LLM Provider Attribution

**Anthropic Claude Sonnet**
- **Provider:** Anthropic PBC
- **Model:** claude-sonnet-4-20250514
- **Usage:** Optional AI enrichment for finding explanations and fix prompts
- **Data Processing:** See "AI Governance" section in Privacy Policy
- **Terms:** Anthropic Commercial Terms (https://www.anthropic.com/legal/commercial-terms)
- **DPA Status:** Available upon request for Enterprise tier

---

## License Compliance Policy

### **Prohibited Licenses**
VibeSafe does NOT use dependencies with the following licenses:
- ❌ GPL / AGPL (copyleft/viral)
- ❌ SSPL, BSL, Elastic License (source-available, not open-source)
- ❌ Non-commercial or research-only licenses
- ❌ Custom/unknown licenses without legal review

### **CI License Gate**
- All new dependencies are checked in CI/CD
- Build fails if prohibited licenses detected
- Manual review required for new license types

### **Dependency Review Checklist**
Before adding a new dependency:
1. ✅ Check license compatibility (MIT, Apache 2.0, ISC, BSD preferred)
2. ✅ Verify no copyleft restrictions
3. ✅ Review for security vulnerabilities (npm audit, Snyk)
4. ✅ Document in this file if production dependency
5. ✅ Obtain approval from tech lead for non-standard licenses

---

## Full License Texts

### MIT License (React, Next.js, Stripe, BullMQ, Redis, Testing Library, Vitest, ESLint, Prettier, Tailwind, etc.)
```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License 2.0 (Prisma, Playwright, Lighthouse, TypeScript, AWS SDK)
```
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
