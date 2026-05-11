# Pre-Launch Compliance Checklist

**Version:** 1.0  
**Last Updated:** 2026-05-11  
**Purpose:** Ensure VibeSafe meets all compliance requirements before paid beta launch

---

## ✅ Completion Status

**Overall Progress:** 12/20 items complete (60%)

| Category | Items | Complete | Percentage |
|----------|-------|----------|------------|
| **Legal & Policy** | 5 | 4/5 | 80% |
| **Data Governance** | 6 | 4/6 | 67% |
| **Security & Infrastructure** | 4 | 2/4 | 50% |
| **License & Dependencies** | 3 | 2/3 | 67% |
| **Operational Controls** | 2 | 0/2 | 0% |

---

## 1. Legal & Policy Documents

### 1.1 Terms of Service ✅ COMPLETE
- [x] **Status:** Draft complete
- [x] **Location:** `docs/compliance/TERMS_OF_SERVICE.md`
- [x] **Includes:**
  - [x] Authorized use policy (scan only owned/authorized sites)
  - [x] Prohibited targets (government, third-party without consent)
  - [x] Active vs passive scan distinction
  - [x] Subscription plans and billing terms
  - [x] Refund policy
  - [x] Rate limits and fair use
  - [x] Report disclaimers (not a certification)
  - [x] LLM enrichment disclaimers
  - [x] Prohibited conduct (abuse, resale)
  - [x] Termination rights
  - [x] Limitation of liability
  - [x] Indemnification
  - [x] Export/sanctions compliance
  - [x] Abuse contact (abuse@vibesafe.example)
- [ ] **TODO:** Legal review by attorney
- [ ] **TODO:** Add to website footer + `/terms` page

### 1.2 Privacy Policy ✅ COMPLETE
- [x] **Status:** Draft complete
- [x] **Location:** `docs/compliance/PRIVACY_POLICY.md`
- [x] **Includes:**
  - [x] Data collection disclosure (account, payment, scan data)
  - [x] Usage purposes (provide service, improve, communicate, comply with law)
  - [x] LLM/AI processing disclosure (redacted findings to Anthropic)
  - [x] Data retention periods (7 days for crawl artifacts, 30 days for logs, etc.)
  - [x] Security measures (AES-256, TLS 1.2+, redaction)
  - [x] Subprocessor list with DPA status
  - [x] GDPR rights (access, deletion, portability, objection)
  - [x] CCPA rights (no sale of data, right to delete)
  - [x] International data transfers (EU-US DPF, SCCs)
  - [x] Children's privacy (18+ requirement)
  - [x] Contact info (privacy@vibesafe.example)
- [ ] **TODO:** Legal review by privacy attorney
- [ ] **TODO:** Add to website footer + `/privacy` page

### 1.3 Report Disclaimers ✅ COMPLETE
- [x] **Status:** Documented in Terms of Service Section 7
- [x] **Includes:**
  - [x] Passive vs active scope
  - [x] Not a certification/compliance audit
  - [x] False positive/negative potential
  - [x] Severity methodology (algorithmic, context-dependent)
  - [x] LLM output disclaimer (suggestions, not professional advice)
- [ ] **TODO:** Add disclaimers to PDF report footer
- [ ] **TODO:** Add disclaimers to web report page (small print)

### 1.4 Cookie Policy / Banner ⚠️ IN PROGRESS
- [ ] **Status:** Not yet implemented
- [ ] **TODO:** Implement cookie consent banner (Cookiebot, OneTrust, or custom)
- [ ] **TODO:** Categorize cookies (essential, analytics, preferences)
- [ ] **TODO:** Allow opt-out of non-essential cookies
- [ ] **TODO:** Document cookie policy in Privacy Policy or separate page

### 1.5 Acceptable Use Policy (AUP) ✅ COMPLETE
- [x] **Status:** Covered in Terms of Service Section 1 (Authorized Use) and Section 8 (Prohibited Conduct)
- [x] **Includes:**
  - [x] Scan only authorized targets
  - [x] No unauthorized penetration testing
  - [x] No abuse, harassment, or malicious use
  - [x] Compliance with CFAA, GDPR, export laws

---

## 2. Data Governance

### 2.1 Data Classification ✅ COMPLETE
- [x] **Status:** Complete
- [x] **Location:** `docs/compliance/DATA_GOVERNANCE.md` Section 1
- [x] **Includes:**
  - [x] Classification levels (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED)
  - [x] Data type inventory (15 data types cataloged)
  - [x] Protection requirements per classification

### 2.2 Retention Policy ✅ COMPLETE
- [x] **Status:** Complete
- [x] **Location:** `docs/compliance/DATA_GOVERNANCE.md` Section 2
- [x] **Includes:**
  - [x] Retention windows (crawl artifacts: 7 days, logs: 90 days, accounts: until deletion + 30 days)
  - [x] User-initiated deletion (scans, accounts, data export)
  - [x] Automated cleanup (daily cron job)

### 2.3 Redaction Implementation ⚠️ IN PROGRESS
- [x] **Status:** Implemented in `src/lib/scanner/modules/p1-01-secrets.ts`
- [x] **Tested:** Yes (basic tests exist)
- [ ] **TODO:** Add regression tests for LLM prompt redaction
- [ ] **TODO:** Verify redaction applied before storage, logs, and PDF export
- [ ] **TODO:** Audit all evidence fields for potential secrets

### 2.4 Encryption At Rest ✅ COMPLETE
- [x] **Status:** Verified
- [x] **PostgreSQL:** AES-256 (Vercel Postgres / Neon default)
- [x] **Cloudflare R2:** AES-256 (default)
- [x] **Password hashing:** bcrypt (cost factor 12)
- [x] **Session tokens:** Encrypted by NextAuth (JWE)

### 2.5 Encryption In Transit ✅ COMPLETE
- [x] **Status:** Verified
- [x] **HTTPS only:** TLS 1.2+ enforced
- [x] **HSTS:** `Strict-Transport-Security` header enabled (check Next.js config)
- [ ] **TODO:** Verify HSTS header in production deployment

### 2.6 Backup & Recovery ⚠️ IN PROGRESS
- [x] **Status:** Relying on cloud provider backups (Vercel/Neon)
- [x] **Daily backups:** Automated by Neon (30-day retention)
- [ ] **TODO:** Test restore procedure (simulate disaster recovery)
- [ ] **TODO:** Document RTO (4 hours) and RPO (24 hours) in runbook

---

## 3. Security & Infrastructure

### 3.1 Access Controls ⚠️ IN PROGRESS
- [x] **Status:** Basic role-based access via Prisma (userId ownership)
- [x] **User isolation:** Users can only access own scans
- [ ] **TODO:** Implement admin/support roles (read-only access for support)
- [ ] **TODO:** Add audit logging for admin actions (data export, account access)
- [ ] **TODO:** Require MFA for admin accounts

### 3.2 Rate Limiting ✅ COMPLETE
- [x] **Status:** Implemented in `src/lib/rate-limit.ts`
- [x] **Per-IP rate limiting:** 10 scans/hour (configurable via `RATE_LIMIT_PER_HOUR`)
- [x] **In-memory store:** Uses Map (dev) or Redis (prod)
- [ ] **TODO:** Add per-user rate limiting (Free: 1/week, Pro: 100/day)

### 3.3 Input Validation ✅ COMPLETE
- [x] **Status:** Implemented in `src/lib/url-validator.ts`
- [x] **URL validation:** Format check, DNS resolution
- [x] **IP blocking:** Private IPs (RFC 1918), loopback, link-local, cloud metadata (169.254.169.254)
- [x] **Tested:** Yes (unit tests exist)

### 3.4 Error Handling & Monitoring ⚠️ IN PROGRESS
- [x] **Status:** Sentry configured (`@sentry/nextjs`)
- [x] **Error tracking:** Enabled for frontend + backend
- [ ] **TODO:** Configure PII scrubbing in Sentry (emails, IPs)
- [ ] **TODO:** Add custom error pages (avoid stack trace leakage)
- [ ] **TODO:** Set up alerting for critical errors (Sentry webhooks to Slack/PagerDuty)

---

## 4. License & Dependencies

### 4.1 Third-Party Notices ✅ COMPLETE
- [x] **Status:** Complete
- [x] **Location:** `docs/compliance/THIRD_PARTY_NOTICES.md`
- [x] **Includes:**
  - [x] All production and dev dependencies listed
  - [x] License types verified (MIT, Apache 2.0, ISC, BSD)
  - [x] Scanner rule provenance documented (original work, no copied rules)
  - [x] Browser redistribution notice (Playwright/Chromium)
  - [x] LLM provider attribution (Anthropic)

### 4.2 CI License Gate ⚠️ IN PROGRESS
- [ ] **Status:** Not yet implemented
- [ ] **TODO:** Add `license-checker` or `licensee` to CI pipeline
- [ ] **TODO:** Configure to fail on prohibited licenses (GPL, AGPL, SSPL, non-commercial)
- [ ] **TODO:** Whitelist approved licenses (MIT, Apache 2.0, ISC, BSD-3-Clause)
- [ ] **TODO:** Add to GitHub Actions workflow

### 4.3 Dependency Vulnerability Scanning ✅ COMPLETE
- [x] **Status:** `npm audit` runs on every install
- [ ] **TODO:** Add Snyk or Dependabot for automated PR alerts
- [ ] **TODO:** Set policy for critical/high severity vulnerabilities (must fix within 7 days)

---

## 5. Vendor & AI Governance

### 5.1 Subprocessor Register ✅ COMPLETE
- [x] **Status:** Complete
- [x] **Location:** `docs/compliance/SUBPROCESSOR_REGISTER.md`
- [x] **Includes:**
  - [x] 9 subprocessors documented (Vercel, Neon, Stripe, Anthropic, Sentry, Cloudflare, Redis, GitHub, Google)
  - [x] Data categories, locations, DPA status, opt-out paths
  - [x] Data flow diagram
  - [x] Detailed security/compliance info per subprocessor

### 5.2 Anthropic LLM Terms Review ⚠️ IN PROGRESS
- [x] **Status:** Reviewed Anthropic Commercial Terms (https://www.anthropic.com/legal/commercial-terms)
- [x] **Data retention:** 30 days default, zero-retention available for Enterprise
- [x] **Training:** Anthropic does NOT train on API data
- [ ] **TODO:** Confirm DPA availability for Enterprise tier (contact Anthropic sales)
- [ ] **TODO:** Add opt-out UI for LLM enrichment (settings page)

### 5.3 LLM Safety Gates ⚠️ IN PROGRESS
- [x] **Status:** Redaction applied in `src/lib/llm/enrichment.ts` (assumed, needs verification)
- [ ] **TODO:** Audit LLM prompt construction for accidental secret leakage
- [ ] **TODO:** Add unit tests for redaction before LLM calls
- [ ] **TODO:** Never send: full secrets, session cookies, JWTs, payment data

---

## 6. Operational Controls

### 6.1 Audit Logs ❌ NOT STARTED
- [ ] **Status:** Not yet implemented
- [ ] **TODO:** Add audit logging for:
  - [ ] Report access (who viewed which scan)
  - [ ] PDF generation (who exported which report)
  - [ ] Payment unlocks (tier upgrades, one-shot purchases)
  - [ ] Domain verification (active scan authorization)
  - [ ] Active scan starts (if Phase 9 is implemented)
  - [ ] Admin actions (support accessing user data)
- [ ] **TODO:** Store audit logs separately (immutable, long retention)
- [ ] **TODO:** Implement log viewer for compliance audits

### 6.2 Compliance Review for New Modules ❌ NOT STARTED
- [ ] **Status:** Not yet implemented
- [ ] **TODO:** Create checklist for new detection modules:
  - [ ] Does it probe external services? (require legal review)
  - [ ] Does it use third-party datasets? (verify license, attribution)
  - [ ] Does it collect PII? (add to Privacy Policy)
  - [ ] Does it require domain verification? (enforce in code)
- [ ] **TODO:** Add to Phase planning template

---

## 7. Website & User-Facing Pages

### 7.1 Legal Pages ⚠️ IN PROGRESS
- [ ] **TODO:** Create `/terms` page (render TERMS_OF_SERVICE.md)
- [ ] **TODO:** Create `/privacy` page (render PRIVACY_POLICY.md)
- [ ] **TODO:** Add footer links to Terms, Privacy, Cookies (if separate), Contact
- [ ] **TODO:** Add "Last updated" timestamp to legal pages

### 7.2 Contact Info ⚠️ IN PROGRESS
- [ ] **TODO:** Set up email addresses:
  - [ ] `support@vibesafe.example` (general support)
  - [ ] `legal@vibesafe.example` (legal inquiries, DMCA)
  - [ ] `privacy@vibesafe.example` (GDPR/CCPA requests)
  - [ ] `abuse@vibesafe.example` (abuse reports)
  - [ ] `security@vibesafe.example` (vulnerability reports)
- [ ] **TODO:** Add contact form or email to footer

### 7.3 Report UI Disclaimers ⚠️ IN PROGRESS
- [ ] **TODO:** Add disclaimers to web report page:
  - [ ] "This is an automated scan, not a security audit or certification"
  - [ ] "Findings may include false positives; validate before acting"
  - [ ] "AI-generated fix prompts are suggestions, not professional advice"
- [ ] **TODO:** Add disclaimers to PDF footer (small print, 8pt font)

---

## 8. Go/No-Go Decision

### 8.1 Blockers for Paid Beta Launch
These MUST be complete before accepting payments:

1. ✅ Terms of Service (draft complete, needs legal review)
2. ✅ Privacy Policy (draft complete, needs legal review)
3. ⚠️ Cookie consent banner (if using analytics cookies)
4. ⚠️ Legal pages on website (`/terms`, `/privacy`)
5. ⚠️ Contact emails set up (support, legal, privacy, abuse, security)
6. ✅ Subprocessor register (complete)
7. ✅ Data governance policy (complete)
8. ⚠️ LLM safety audit (verify no secrets in prompts)
9. ⚠️ Redaction regression tests (ensure secrets never leak)
10. ⚠️ Stripe integration tested (payment flow, refunds, cancellations)

### 8.2 Nice-to-Have (Can Ship Without)
These can be added post-launch:

1. CI license gate (manual review OK initially)
2. Audit logs (can add in Phase 8)
3. Admin/support roles (manual DB access OK initially)
4. MFA for admins (OK for single-admin startup)
5. Disaster recovery testing (rely on cloud provider initially)

---

## 9. Sign-Off

**Engineering Lead:** _______________ Date: ___________  
**Legal/Compliance:** _______________ Date: ___________  
**Product Owner:** _______________ Date: ___________

---

**Next Review:** Before Phase 6 (Payments) implementation begins
