# Third-Party Notices

VibeSafe uses third-party dependencies with various licenses. This document provides attribution and license information for all external packages.

## Generation

This file is generated/updated manually from `sbom.json` and `license-report.json`.

To regenerate license data:
```bash
npm run compliance:sbom
npm run compliance:check-licenses
```

---

## Core Dependencies

### Next.js
- **Version**: 14.2.29
- **License**: MIT
- **Homepage**: https://nextjs.org
- **Usage**: Web framework and API routes
- **Attribution**: Copyright (c) 2024 Vercel, Inc.
- **Status**: ✅ Approved

### React & React DOM
- **Version**: ^18
- **License**: MIT
- **Homepage**: https://react.dev
- **Usage**: UI rendering library
- **Attribution**: Copyright (c) Meta Platforms, Inc. and affiliates
- **Status**: ✅ Approved

### Prisma
- **Version**: ^5.22.0
- **License**: Apache-2.0
- **Homepage**: https://www.prisma.io
- **Usage**: Database ORM and migration tool
- **Attribution**: Copyright (c) 2018-2024 Prisma Data, Inc.
- **Status**: ✅ Approved

### BullMQ
- **Version**: ^5.76.6
- **License**: MIT
- **Homepage**: https://docs.bullmq.io
- **Usage**: Queue management for background workers
- **Attribution**: Copyright (c) 2019-2024 Taskforce.sh Inc.
- **Status**: ✅ Approved

### Redis
- **Version**: ^5.12.1
- **License**: MIT
- **Homepage**: https://github.com/redis/node-redis
- **Usage**: Redis client for queue and event bus
- **Attribution**: Copyright (c) 2024 Redis Inc.
- **Status**: ✅ Approved

### Playwright
- **Version**: ^1.59.1
- **License**: Apache-2.0
- **Homepage**: https://playwright.dev
- **Usage**: Browser automation for crawler (Note: currently not used, crawler is Node.js native)
- **Attribution**: Copyright (c) Microsoft Corporation
- **Status**: ✅ Approved
- **Notes**: 
  - Playwright downloads browser binaries during installation
  - Browser redistribution terms: Chromium (BSD-3-Clause), Firefox (MPL-2.0), WebKit (LGPL-2.1/BSD-2-Clause)
  - Currently NOT used in production (crawler uses native Node.js fetch)
  - May be used in Phase 6 for PDF generation

---

## Development Dependencies

### TypeScript
- **Version**: ^5
- **License**: Apache-2.0
- **Homepage**: https://www.typescriptlang.org
- **Usage**: Type checking and compilation
- **Status**: ✅ Approved (dev-only)

### Tailwind CSS
- **Version**: ^3.3.0
- **License**: MIT
- **Homepage**: https://tailwindcss.com
- **Usage**: CSS utility framework
- **Status**: ✅ Approved (dev-only)

### ESLint
- **Version**: ^8
- **License**: MIT
- **Homepage**: https://eslint.org
- **Usage**: Code linting
- **Status**: ✅ Approved (dev-only)

### Prettier
- **Version**: ^3
- **License**: MIT
- **Homepage**: https://prettier.io
- **Usage**: Code formatting
- **Status**: ✅ Approved (dev-only)

---

## Scanner Rule & Fingerprint Attribution

### Secret Detection Patterns
- **Source**: Original patterns developed for VibeSafe
- **License**: MIT (same as VibeSafe)
- **Inspiration**: Pattern structure inspired by gitleaks (MIT license)
- **Attribution**: Not a direct copy; patterns are independently developed
- **Status**: ✅ Original work

### Subdomain Takeover Fingerprints
- **Source**: Original fingerprints developed for VibeSafe
- **Inspiration**: Methodology inspired by can-i-take-over-xyz (public domain patterns)
- **Attribution**: Fingerprint strings and detection logic are original
- **Status**: ✅ Original work

### Sensitive Path Lists
- **Source**: Original wordlist developed for VibeSafe
- **Inspiration**: Common knowledge paths (`.env`, `.git/config`, etc.)
- **Attribution**: Paths are generic and not copyrighted
- **Status**: ✅ Original work

### TLS/Security Header Checks
- **Source**: Original implementation
- **Based on**: Public RFCs and security best practices (not copyrighted)
- **Status**: ✅ Original work

---

## Future Dependencies (Phase 6+)

### Cloudflare R2 SDK (if PDF export enabled)
- **License**: MIT / Apache-2.0 (aws-sdk S3 compatible)
- **Status**: Not yet added

### Stripe SDK (if payments enabled)
- **License**: MIT
- **Status**: Not yet added

### Supabase SDK (if auth enabled, Supabase provider)
- **License**: MIT
- **Status**: Not yet added

### NextAuth (if auth enabled, NextAuth provider)
- **License**: ISC
- **Status**: Not yet added

### Anthropic SDK (Phase 5, LLM enrichment)
- **License**: MIT
- **Status**: Optional dependency, not yet added

---

## Compliance Summary

| Category | Count | Status |
|----------|-------|--------|
| Approved (MIT/Apache-2.0/BSD) | 100% | ✅ |
| Copyleft (GPL/AGPL) | 0 | ✅ |
| Non-commercial | 0 | ✅ |
| Unknown | 0 | ✅ |

Last updated: Auto-generated on each commit (CI pipeline)

---

## Review Process

1. **New dependency intake**: Before adding any npm package, verify license compatibility
2. **CI gate**: `npm run compliance:check-licenses` runs on every PR
3. **Blocked licenses**: GPL, AGPL, SSPL, BUSL, CC-BY-NC (fails CI)
4. **Review required**: MPL, EPL, CDDL (warns but allows)
5. **Manual approval**: Any custom, proprietary, or multi-licensed packages

For questions: See PHASES.md Phase 7 or contact maintainer.
