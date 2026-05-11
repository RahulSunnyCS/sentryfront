# Data Governance Policy

**Version:** 1.0  
**Effective Date:** 2026-05-11  
**Owner:** Engineering & Legal  
**Review Cycle:** Quarterly

This document defines how VibeSafe classifies, handles, stores, and deletes customer and operational data.

---

## 1. Data Classification

### 1.1 Classification Levels

| Level | Description | Examples | Protection Requirements |
|-------|-------------|----------|------------------------|
| **PUBLIC** | Publicly accessible information | Marketing copy, public documentation, published blog posts | None (publicly available) |
| **INTERNAL** | Non-sensitive business data | Feature flags, system logs (anonymized), aggregate statistics | Access controls, TLS in transit |
| **CONFIDENTIAL** | Sensitive business or customer data | Account emails, scan results, IP addresses, usage analytics | Encryption at rest + in transit, access logs, role-based access |
| **RESTRICTED** | Highly sensitive data subject to regulation | Payment data (Stripe), partial secrets (redacted), PII, authentication tokens | Strong encryption, strict access controls, redaction, audit logs, DPA compliance |

### 1.2 Data Type Inventory

| Data Type | Classification | Storage Location | Retention | Encryption |
|-----------|---------------|------------------|-----------|------------|
| **User account data** (email, name, OAuth profile) | CONFIDENTIAL | PostgreSQL (Vercel/Neon) | Until account deletion + 30 days | ✅ AES-256 at rest, TLS 1.2+ in transit |
| **Password hashes** | RESTRICTED | PostgreSQL | Until account deletion + 30 days | ✅ bcrypt hashing, AES-256 at rest |
| **Payment data** (card, billing address) | RESTRICTED | Stripe (PCI-DSS vault) | Per Stripe retention policy | ✅ PCI-DSS Level 1 (Stripe) |
| **Scan target URLs** | CONFIDENTIAL | PostgreSQL | Until scan deletion or account deletion + 30 days | ✅ AES-256 at rest, TLS 1.2+ in transit |
| **Scan findings** (issues, severity, evidence) | CONFIDENTIAL | PostgreSQL | Until scan deletion or account deletion + 30 days | ✅ AES-256 at rest, TLS 1.2+ in transit |
| **Redacted secrets** (first 4 + last 4 chars) | RESTRICTED | PostgreSQL | Until scan deletion or account deletion + 30 days | ✅ AES-256 at rest, redacted before storage |
| **Crawl artifacts** (HTML, screenshots, network logs) | CONFIDENTIAL | Cloudflare R2 (private buckets) | **7 days** (auto-deleted) | ✅ AES-256 at rest, signed URLs |
| **PDF reports** | CONFIDENTIAL | Cloudflare R2 (private buckets) | Until user deletes or account deletion + 30 days | ✅ AES-256 at rest, signed URLs (1-hour expiry) |
| **Server logs** (access logs, error logs) | INTERNAL | Sentry, Vercel Logs | **90 days** (access), **30 days** (errors) | ✅ TLS 1.2+ in transit |
| **Session tokens** | RESTRICTED | PostgreSQL (NextAuth) | Until logout or 30-day expiry | ✅ AES-256 at rest, HttpOnly cookies |
| **LLM prompts** (redacted findings) | CONFIDENTIAL | Anthropic API (ephemeral) | **Zero retention** (Enterprise) / **30 days** (default) | ✅ TLS 1.2+ in transit, no storage per Anthropic policy |
| **Analytics data** (page views, feature usage) | INTERNAL | Internal analytics (anonymized) | Indefinitely (aggregated, no PII) | ✅ TLS 1.2+ in transit |

---

## 2. Data Retention Policy

### 2.1 Retention Windows

| Data Category | Retention Period | Deletion Method | Justification |
|---------------|------------------|-----------------|---------------|
| **Active user accounts** | Until account deletion | Soft delete → hard delete after 30 days | Business necessity |
| **Deleted accounts** | 30 days grace period | Hard delete (irreversible) | GDPR right to erasure |
| **Scan results** | Until user deletes or account deletion + 30 days | Cascade delete on account deletion | Product feature (historical comparison) |
| **Crawl artifacts (temp)** | **7 days** | Automated S3 lifecycle policy | Minimize storage of sensitive data |
| **PDF reports** | Until user deletes or account deletion + 30 days | Cascade delete | User-controlled retention |
| **Payment transaction history** | **7 years** | Archived (Stripe controls) | Tax/accounting compliance (IRS, HMRC) |
| **Access logs** | **90 days** | Rolling deletion | Security monitoring, abuse detection |
| **Error logs** | **30 days** | Rolling deletion (Sentry) | Bug fixing, incident response |
| **Anonymized analytics** | Indefinite | N/A (no PII) | Product improvement |

### 2.2 User-Initiated Deletion
- **Individual scans:** Immediate soft delete, hard delete after 7 days
- **Account deletion:** Immediate logout, hard delete of all data after 30 days (except payment history per tax law)
- **Data export:** Available before deletion (JSON format, GDPR Article 20)

### 2.3 Automated Cleanup
- **Cron job:** Runs daily at 02:00 UTC
- **Deletes:**
  - Crawl artifacts older than 7 days (S3 lifecycle policy)
  - Soft-deleted scans older than 7 days
  - Soft-deleted accounts older than 30 days
  - Server logs older than 90 days

---

## 3. Data Minimization

### 3.1 Principles
- **Collect only necessary data:** No tracking beyond product functionality and security
- **Redact before storage:** Secrets, tokens, cookies redacted to first/last 4 characters
- **Temporary artifacts:** HTML, screenshots, network logs deleted after 7 days
- **No full secrets:** Never store complete API keys, passwords, or session tokens from scans

### 3.2 Redaction Rules

| Data Type | Redaction Method | Example |
|-----------|------------------|---------|
| **API keys, tokens** | First 4 + last 4 chars | `sk_live_1234...abcd` |
| **Passwords in source code** | First 4 + last 4 chars | `MyPa...rd123` |
| **Session cookies** | First 4 + last 4 chars | `sess...4f2a` |
| **Email addresses in evidence** | Domain preserved, local part redacted | `u***@example.com` |
| **Credit card numbers** | First 6 + last 4 (BIN + last 4) | `424242...4242` (Stripe handles this) |
| **IP addresses in logs** | Last octet masked (optionally) | `192.168.1.xxx` |

### 3.3 LLM Safety Gates
**Never send to LLM:**
- Full secrets, tokens, or credentials
- Complete session cookies or JWTs
- Unredacted email addresses or phone numbers
- Payment card numbers or financial data
- Medical or health information

**Always redact before LLM:**
- Evidence strings (apply same redaction as storage)
- Code snippets (check for inline secrets)
- HTTP headers (redact Authorization, Cookie, Set-Cookie)

---

## 4. Encryption Standards

### 4.1 Data at Rest
- **Database:** AES-256 encryption (Vercel Postgres / Neon default)
- **File storage:** AES-256 encryption (Cloudflare R2 default)
- **Password hashing:** bcrypt with cost factor 12
- **Session tokens:** Encrypted by NextAuth (JWE)

### 4.2 Data in Transit
- **HTTPS only:** TLS 1.2+ required for all connections
- **HSTS enabled:** Strict-Transport-Security header with 1-year max-age
- **Certificate pinning:** Not currently implemented (consider for mobile apps)

### 4.3 Key Management
- **Encryption keys:** Managed by cloud provider (Vercel, Neon, R2)
- **API keys:** Stored in environment variables, never committed to git
- **Secrets rotation:** Manual rotation quarterly (or on breach)

---

## 5. Access Controls

### 5.1 Role-Based Access Control (RBAC)

| Role | Access Level | Permissions |
|------|--------------|-------------|
| **User (Customer)** | Own data only | Read/write own scans, account settings, billing |
| **Support** | Read-only customer data | View account info, scan results (for troubleshooting) |
| **Engineering** | Full database access | Read/write all data (for bug fixes, ops) |
| **Admin** | Full system access | Database, infrastructure, deployment |

### 5.2 Access Logging
- **Audit trail:** All database writes logged (timestamp, user, action)
- **Admin actions:** Logged to separate audit log (immutable)
- **Data export requests:** Logged with requester, timestamp, IP address

### 5.3 Principle of Least Privilege
- Support staff cannot modify data (read-only)
- Engineering access requires MFA
- Production database access requires VPN + MFA

---

## 6. Backup and Disaster Recovery

### 6.1 Backup Schedule
- **Database:** Automated daily backups (Vercel/Neon) + point-in-time recovery (7-day window)
- **File storage (R2):** Versioning enabled, deleted objects retained for 30 days
- **Backup encryption:** AES-256 (same as primary storage)

### 6.2 Backup Retention
- **Daily backups:** Retained for 30 days
- **Weekly backups:** Retained for 90 days
- **Monthly backups:** Retained for 1 year

### 6.3 Disaster Recovery
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours (last backup)
- **Failover:** Automatic (Vercel multi-region, Neon HA)

---

## 7. Data Breach Response

### 7.1 Detection
- **Monitoring:** Sentry error tracking, Vercel logs, database audit logs
- **Alerts:** Automated alerts for suspicious activity (mass data export, unauthorized access)

### 7.2 Response Plan
1. **Detect & contain** (within 1 hour)
2. **Assess impact** (within 4 hours)
3. **Notify affected users** (within 72 hours per GDPR)
4. **Report to authorities** (if >500 users affected or high-risk data)
5. **Root cause analysis** (within 7 days)
6. **Implement fixes** (within 30 days)

### 7.3 Notification Requirements
- **GDPR:** 72-hour notification to supervisory authority (if high risk)
- **CCPA:** "Without unreasonable delay" to California AG (if unencrypted data)
- **Users:** Email notification with details, impact, remediation steps

---

## 8. Compliance Checklist

### 8.1 GDPR Compliance
- ✅ Lawful basis for processing (Art. 6: Contract, Consent, Legitimate Interest)
- ✅ Data minimization (Art. 5.1.c)
- ✅ Retention limits (Art. 5.1.e)
- ✅ Encryption (Art. 32)
- ✅ Right to erasure (Art. 17)
- ✅ Data portability (Art. 20)
- ✅ DPA with subprocessors (Art. 28)
- ✅ DPIA (if high risk — TBD for active scans)

### 8.2 CCPA Compliance
- ✅ Privacy policy disclosure (CCPA §1798.100)
- ✅ Right to know (§1798.110)
- ✅ Right to delete (§1798.105)
- ✅ Do not sell personal information (§1798.120) — **we don't sell data**

### 8.3 PCI-DSS Compliance
- ✅ Payment data handled by Stripe (PCI-DSS Level 1 compliant)
- ✅ We do NOT store full card numbers, CVV, or PINs
- ✅ Stripe.js tokenization (no card data touches our servers)

---

## 9. Review and Updates

- **Quarterly review:** Engineering + Legal review this policy
- **Annual audit:** Third-party audit for Enterprise customers (optional)
- **Trigger for update:** New regulations, data breach, significant product changes

**Last reviewed:** 2026-05-11  
**Next review:** 2026-08-11
