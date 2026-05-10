# Pre-Launch Compliance Checklist

**Purpose**: Ensure VibeSafe meets all compliance, legal, and security requirements before launching to production or accepting paid customers.

**Owner**: Engineering Lead + Legal Counsel  
**Review Frequency**: Before each major release (beta, paid launch, enterprise)

---

## Phase 6 (Beta Launch) Checklist

### Legal and Policy Documentation

- [ ] **Terms of Service** finalized and published
  - [ ] Authorized-use scanning clause
  - [ ] Rate-limit and abuse terms
  - [ ] Refund policy
  - [ ] Account termination language
  - [ ] File location: `docs/legal/terms-of-service.md`

- [ ] **Privacy Policy** finalized and published
  - [ ] GDPR compliance sections
  - [ ] CCPA compliance sections
  - [ ] Data retention windows
  - [ ] Subprocessor list
  - [ ] User rights (access, deletion, portability)
  - [ ] File location: `docs/legal/privacy-policy.md`

- [ ] **Report Disclaimers** implemented
  - [ ] Displayed on every web report
  - [ ] Included in every PDF export
  - [ ] Severity methodology explained
  - [ ] "Not a certification" language
  - [ ] File location: `docs/legal/report-disclaimers.md`

- [ ] **Abuse Policy** published
  - [ ] Abuse contact email configured
  - [ ] Escalation procedure documented
  - [ ] File location: `docs/legal/abuse-policy.md`

### Open-Source Licensing and SBOM

- [ ] **SBOM generated** and current
  - [ ] Run: `npm run compliance:sbom`
  - [ ] File location: `docs/compliance/sbom.json`

- [ ] **License check passing**
  - [ ] Run: `npm run compliance:check-licenses`
  - [ ] No GPL/AGPL/copyleft licenses in production dependencies
  - [ ] Unknown licenses reviewed and approved
  - [ ] File location: `docs/compliance/license-report.json`

- [ ] **Third-party notices** documented
  - [ ] All dependencies listed with licenses
  - [ ] Scanner rule provenance documented
  - [ ] Fingerprint attribution documented
  - [ ] File location: `docs/compliance/third-party-notices.md`

- [ ] **CI license gate** enabled
  - [ ] GitHub Actions workflow configured
  - [ ] Fails on blocked licenses
  - [ ] File location: `.github/workflows/compliance.yml`

### Data Governance

- [ ] **Data classification** documented
  - [ ] Public, Internal, Confidential, Highly Sensitive categories
  - [ ] File location: `docs/compliance/data-governance.md`

- [ ] **Retention windows** defined and enforced
  - [ ] Scan reports: user-controlled
  - [ ] Raw crawl artifacts: ≤24 hours
  - [ ] Request logs: 90 days
  - [ ] Backups: 30 days
  - [ ] Payment records: 7 years (when Stripe enabled)

- [ ] **Secret redaction** verified
  - [ ] Secrets redacted BEFORE database write
  - [ ] Secrets redacted BEFORE LLM API call (when enabled)
  - [ ] Secrets redacted BEFORE log output
  - [ ] Regression tests pass
  - [ ] Test location: `src/lib/scanner/modules/p1-01-secrets.test.ts` (to be created)

- [ ] **Encryption standards** implemented
  - [ ] TLS 1.2+ enforced for all connections
  - [ ] HSTS enabled with max-age=31536000
  - [ ] Database encryption at rest (AES-256)
  - [ ] R2 storage encryption at rest (when PDF export enabled)

### Vendor Governance

- [ ] **Subprocessor register** complete
  - [ ] All active subprocessors listed
  - [ ] DPA status confirmed for each
  - [ ] Data locations documented
  - [ ] Review dates set
  - [ ] File location: `docs/compliance/subprocessor-register.md`

- [ ] **Anthropic DPA** signed (if LLM enabled)
  - [ ] Commercial terms reviewed
  - [ ] Zero-retention plan evaluated
  - [ ] Data training opt-out confirmed
  - [ ] High-risk content gating implemented

- [ ] **Stripe DPA** signed (if payments enabled)
  - [ ] PCI-DSS compliance confirmed
  - [ ] Payment data flow reviewed (never stored on our servers)

- [ ] **Cloudflare R2 DPA** signed (if PDF export enabled)
  - [ ] Access control via signed URLs
  - [ ] Encryption at rest confirmed

### Security and Hardening

- [ ] **Rate limiting** enforced
  - [ ] Per-IP scan limits configured
  - [ ] Per-user scan limits configured (when auth enabled)
  - [ ] Default: 10 scans/hour per IP

- [ ] **Input validation** hardened
  - [ ] Private IPs blocked (RFC-1918, loopback, link-local)
  - [ ] Cloud metadata endpoints blocked (169.254.169.254)
  - [ ] DNS resolution validated before scanning

- [ ] **Scan timeout enforcement** implemented
  - [ ] Hard kill at 120 seconds
  - [ ] Partial findings persisted with TIMEOUT status

- [ ] **Error tracking** configured
  - [ ] Sentry or equivalent monitoring
  - [ ] Frontend and backend errors tracked
  - [ ] PII scrubbing enabled in error reports

- [ ] **Structured logging** configured
  - [ ] Axiom or equivalent log aggregation
  - [ ] Secrets redacted in logs
  - [ ] Retention: 90 days

### Feature Flag Validation

- [ ] **Phase 6 features** properly gated
  - [ ] PDF export: `PDF_EXPORT_ENABLED` default false
  - [ ] Stripe: `STRIPE_ENABLED` default false
  - [ ] Auth: `AUTH_ENABLED` default false
  - [ ] Tier gating: `TIER_GATING_ENABLED` default false
  - [ ] Scan diff: `FEATURE_SCAN_DIFF_ENABLED` default false

- [ ] **Client-side flags** match server-side
  - [ ] `NEXT_PUBLIC_*` variables set correctly
  - [ ] UI hides disabled features

- [ ] **Health endpoint** shows feature status
  - [ ] `GET /api/health` returns enabled features
  - [ ] Feature configuration validation working

### Deployment and Infrastructure

- [ ] **Database backups** configured
  - [ ] Automated daily backups
  - [ ] 30-day retention
  - [ ] Restore tested successfully

- [ ] **Environment variables** secured
  - [ ] Production secrets not in git
  - [ ] Vercel/Railway secrets manager used
  - [ ] `.env.example` updated with all required vars

- [ ] **Domain and SSL** configured
  - [ ] Custom domain set up
  - [ ] SSL certificate valid
  - [ ] HSTS headers enabled
  - [ ] Redirects HTTP → HTTPS

### Testing and QA

- [ ] **Type checking** passes
  - [ ] Run: `npm run typecheck`
  - [ ] No TypeScript errors

- [ ] **Linting** passes
  - [ ] Run: `npm run lint`
  - [ ] No ESLint errors

- [ ] **End-to-end flow** tested
  - [ ] Submit URL → Scan completes → Report renders
  - [ ] All 15 detection modules run
  - [ ] Grade calculation correct
  - [ ] Findings display properly

- [ ] **LLM enrichment** tested (if enabled)
  - [ ] Enrichment adds explanations and fix prompts
  - [ ] Scans complete without LLM if API key missing
  - [ ] No full secrets in LLM prompts (verified)

- [ ] **Payment flow** tested (if enabled)
  - [ ] Stripe checkout works
  - [ ] Webhooks update user tier
  - [ ] Tier gating enforced correctly
  - [ ] Refund process tested

---

## Paid Launch (Phase 6 Complete) Additional Checks

- [ ] **Legal review** by attorney
  - [ ] Terms of Service approved
  - [ ] Privacy Policy approved
  - [ ] Liability disclaimers sufficient
  - [ ] Jurisdiction and governing law finalized

- [ ] **Tax compliance** configured
  - [ ] Stripe Tax enabled (for VAT/sales tax)
  - [ ] Business entity registered
  - [ ] EIN or tax ID obtained

- [ ] **Billing system** tested
  - [ ] Subscriptions renew correctly
  - [ ] Failed payments handled gracefully
  - [ ] Cancellation flow works
  - [ ] Invoices generated correctly

- [ ] **Customer support** operational
  - [ ] Support email configured
  - [ ] Response time SLA defined
  - [ ] Refund process documented

---

## Enterprise/Agency Launch (Studio Tier) Additional Checks

- [ ] **White-label PDF export** tested
  - [ ] Custom logo injection works
  - [ ] Custom color schemes apply
  - [ ] Agency branding correct

- [ ] **Custom contracts** available
  - [ ] MSA template prepared
  - [ ] Custom DPA option for enterprise
  - [ ] SLA commitment defined

- [ ] **Admin audit logs** implemented
  - [ ] Report access logged
  - [ ] PDF generation logged
  - [ ] Payment unlocks logged
  - [ ] Domain verification logged

---

## Sign-Off

**Engineering Lead**: _____________________________ Date: __________

**Legal Counsel** (if applicable): _____________________________ Date: __________

**Product Owner**: _____________________________ Date: __________

---

## Emergency Rollback Plan

If critical compliance issues discovered post-launch:

1. **Disable affected features** via environment variables
2. **Notify affected users** within 24 hours
3. **File breach reports** if GDPR/CCPA triggered (within 72 hours)
4. **Post-mortem** within 7 days with remediation plan

---

**Last Updated**: [TO BE DETERMINED]  
**Next Review**: Before each major release

---

**END OF PRE-LAUNCH CHECKLIST**
